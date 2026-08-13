# 01 — โปรโตคอล Mesh (ESP-NOW)

> ระดับ node ↔ node ↔ gateway ในตลาด · decisions #6,7,8,9,10,17

## 1. Topology
- ทุกล็อก = 1 **node** (ESP32, ESP-NOW, Long-Range mode)
- 1 ตลาดมี **1 Gateway** (node ใหญ่กลางตลาด) — bridge ESP-NOW ↔ MQTT
- โหนดที่ไกล gateway → **hop ผ่านโหนดข้างๆ** (multi-hop)
- ทุกโหนดในตลาดเดียวใช้ **AES key เดียวกัน** (per-market key) + `market_short` เดียวกัน

## 2. Addressing (decision #8)
- ในอากาศใช้ **short-id ขนาด 2 ไบต์** (uint16) ต่อ device ภายในตลาด (รองรับ 65k โหนด/ตลาด)
- `0x0000` = gateway, `0xFFFF` = broadcast
- server เก็บ map `(market_id, short_id) ↔ device_uuid (UUIDv4)` — ดู [03-data-model.md](03-data-model.md) `devices`
- short-id ถูก assign ตอน provision (ดู §9)

## 3. Binary packet format (decision #7)
Little-endian. ทุก packet:
```
┌────────────── HEADER (12 bytes, plaintext) ──────────────┐┌ ENCRYPTED ┐┌ TAG ┐
│ magic │ ver │ type │ flags │ market │ src  │ dst  │ seq  ││  payload  ││ MAC │
│  1B   │ 1B  │  1B  │  1B   │  2B    │ 2B   │ 2B   │ 2B   ││   0..200B ││ 8B  │
└──────────────────────────────────────────────────────────┘└───────────┘└─────┘
```
| field | ขนาด | ความหมาย |
|-------|------|----------|
| `magic` | 1B | `0xA6` (คงที่ กันขยะ) |
| `ver` | 1B | protocol version (เริ่ม `0x01`) |
| `type` | 1B | ชนิดข้อความ (ดู §4) |
| `flags` | 1B | bit0=encrypted, bit1=ack_required, bit2=is_relayed, bit3=long_range |
| `market` | 2B | market_short (แยกตลาด กันชนกัน) |
| `src` | 2B | short-id ต้นทาง |
| `dst` | 2B | short-id ปลายทาง (0xFFFF=broadcast) |
| `seq` | 2B | sequence number (กัน replay + จับคู่ ACK) |
| `payload` | 0–200B | เข้ารหัส AES (ถ้า flags.encrypted) |
| `MAC` | 8B | tag ยืนยันความถูกต้อง (ดู §6) |

> HEADER ไม่เข้ารหัส (ให้ relay routing ได้) แต่ถูก **auth ด้วย MAC** (AAD) กันแก้ไข

## 4. Message types
| type | ชื่อ | ทิศทาง | payload |
|------|------|--------|---------|
| `0x01` | TELEMETRY | node → gw | ค่ามิเตอร์ (ดู §5) |
| `0x02` | COMMAND | gw → node | สั่ง relay/วาล์ว (ดู §7) |
| `0x03` | ACK | node → gw | ผลของ command |
| `0x04` | HEARTBEAT | node → gw | มีชีวิต + สถานะย่อ (ทุก N นาที) |
| `0x05` | JOIN_REQ | node → gw | ตอน node เพิ่ง boot (uuid, fw) |
| `0x06` | JOIN_ACK | gw → node | แจก short-id + time sync |
| `0x07` | TIME_SYNC | gw → node | epoch ปัจจุบัน (broadcast) |
| `0x08` | CONFIG | gw → node | ตั้งค่า (interval, thresholds) |
| `0x0A` | OTA_* | gw ↔ node | อัปเดต firmware (เฟสหลัง) |

## 5. TELEMETRY payload (decision #14 — market format v1)
```
struct TelemetryMarketV1 {          // format_version = 1 (market)
  uint32 epoch;         // 4B  unix time (วินาที)
  // ---- ไฟฟ้า ----
  uint16 voltage_dV;    // 2B  แรงดัน ×0.1 V   (2300 = 230.0V)
  uint16 current_mA;    // 2B  กระแส ×0.001 A  (ถ้า >65A ใช้ scale flag)
  uint16 power_dW;      // 2B  กำลัง ×0.1 W
  uint32 energy_Wh;     // 4B  พลังงานสะสม (Wh)  ← ใช้ออกบิล
  uint8  pf_pct;        // 1B  power factor ×0.01 (95 = 0.95)
  uint8  freq_dHz;      // 1B  ความถี่ - 500 ×0.1 (0=50.0Hz)  [offset]
  // ---- น้ำ ----
  uint32 water_L;       // 4B  ปริมาตรสะสม (ลิตร) ← ใช้ออกบิล
  uint16 flow_Lpm;      // 2B  อัตราไหล ×0.1 L/min
  // ---- สถานะ ----
  uint8  relay_state;   // 1B  bit0=ไฟ on, bit1=น้ำ(วาล์ว) open
  int8   temp_C;        // 1B  อุณหภูมิในตู้ (°C)
  uint8  fw_version;    // 1B
  uint8  status_flags;  // 1B  bit0=power_alarm, bit1=leak, bit2=door_open...
}                        // รวม ~29 ไบต์
```
> 3 เฟส: ใช้ `format_version = 2` (มี V/A/W ต่อเฟส L1/L2/L3) — schema แยก
> คอนโด: `format_version = 10+` (หลายมิเตอร์ต่อ packet, ไม่มีน้ำ/วาล์ว) — นิยามใน [02](02-protocol-server.md)

## 6. Encryption + Auth (decision #17)
- **AES-128-CCM** (หรือ AES-CTR + HMAC-SHA256 ตัด 8B) — key = per-market 16 ไบต์
- **Nonce (13B for CCM):** `market(2) ‖ src(2) ‖ seq(2) ‖ epoch(4) ‖ pad(3)` — ห้ามซ้ำ
- **AAD (authenticated, not encrypted):** ทั้ง HEADER 12 ไบต์
- **MAC 8B:** ต่อท้าย — ผู้รับ verify ก่อนถอด ถ้าไม่ผ่าน = ทิ้ง
- **Replay guard:** server/gw เก็บ `last_seq` ต่อ (market, src); รับเฉพาะ seq ใหม่กว่า (มี sliding window 32) + ตรวจ epoch ไม่ย้อน > 5 นาที
- key แจกตอน provision (ไม่ hardcode) — เก็บใน NVS ของ ESP32

## 7. COMMAND + ACK (decision #10)
```
struct Command {
  uint8  req_id;        // 1B  จับคู่กับ ACK (idempotent — สั่งซ้ำ req_id เดิม = ไม่ทำซ้ำ)
  uint8  channel;       // 1B  0=ไฟ(contactor), 1=น้ำ(วาล์ว), 2=พัดลม
  uint8  action;        // 1B  0=OFF/close, 1=ON/open, 2=toggle, 3=pulse
  uint16 arg;           // 2B  เช่น pulse ms / เวลาหน่วง
}
struct Ack {
  uint8  req_id;        // จับคู่ command
  uint8  channel;
  uint8  result;        // 0=ok, 1=fail, 2=busy, 3=unknown_cmd
  uint8  relay_state;   // สถานะจริงหลังทำ (ยืนยัน)
}
```
**Flow (gw ↔ node):**
1. gw ส่ง COMMAND (flags.ack_required=1), เก็บ `req_id` + timer
2. รอ ACK **timeout 2 วิ** → ถ้าไม่ได้ **retry สูงสุด 3 ครั้ง** (req_id เดิม)
3. ครบ 3 ครั้งไม่ได้ ACK → mark `command failed` ส่งขึ้น server → แจ้งเตือน
4. ได้ ACK → ยืนยัน `relay_state` ตรงกับที่สั่ง → mark success

## 8. Timing / airtime
- Telemetry ทุก **60 วินาที** + **jitter สุ่ม 0–5 วิ** ต่อโหนด (กันชนกันพร้อมกัน)
- Heartbeat ทุก 5 นาที (ถ้าไม่มี telemetry)
- โหลดจริง ~1–4 kbps ต่อตลาด → เหลือเฟือ (ดูที่คุยเรื่อง capacity)

## 9. Provisioning / lifecycle ของ node
```
[unprovisioned] ── boot ครั้งแรก, ยังไม่มี short-id
      │ ส่ง JOIN_REQ (uuid, fw) แบบ broadcast/รอ gw
      ▼
[joining] ── gw เห็น → ถาม server ว่ารู้จัก uuid ไหม
      │ server assign short_id + market_key (ถ้า device ถูก register)
      │ gw ส่ง JOIN_ACK (short_id, key_id, epoch)
      ▼
[active] ── ส่ง telemetry ปกติ, รับ command
      │ (offline > X นาที → gw mark node offline ผ่าน server)
      ▼
[decommissioned] ── ปลดออก, คืน short-id
```
- **การ register device:** admin/owner เพิ่ม device ด้วย UUID (พิมพ์/สแกน QR บนตัว node) ในระบบ แล้วผูกกับ unit → server ถึงจะ assign short-id

## 10. Offline buffering
- ถ้า gateway/mesh ล่ม → node **เก็บ reading ลง ring buffer** (RAM หรือ flash, ~หลายชั่วโมง)
- พอกลับมา online → ส่ง backlog พร้อม epoch จริง (server เก็บย้อนหลังได้)

## 11. Gateway หน้าที่ (สรุป — รายละเอียด [02](02-protocol-server.md))
- ถอด/ห่อ AES, ตรวจ MAC + replay
- แปลง short-id ↔ uuid (cache map จาก server)
- bridge ESP-NOW ↔ MQTT
- buffer เมื่อ internet ล่ม
- relay COMMAND จาก server ลง mesh + ส่ง ACK/timeout กลับ

## 12. Firmware modules (ESP32) ที่ต้องเขียน (ทำภายหลัง — hardware)
`espnow_mac` · `crypto (AES-CCM)` · `packet codec` · `meter drivers (PZEM Modbus, pulse counter, DS18B20)` · `relay/valve control` · `LCD driver` · `fan controller` · `scheduler (1-min sample + jitter)` · `provisioning` · `offline buffer` · `OTA (later)`
