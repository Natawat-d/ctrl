# 02 — โปรโตคอล Server / Gateway (MQTT)

> ระดับ Gateway ↔ MQTT ↔ Go server · decisions #11,12,13,14

## 1. Gateway บทบาท
- ถอด ESP-NOW binary (§01) → verify AES/MAC/replay → decode
- ห่อเป็น **JSON envelope** ส่งขึ้น MQTT
- รับ command จาก MQTT → encode → ESP-NOW → รอ ACK → publish ผลกลับ
- เก็บ **short-id ↔ uuid map** (sync จาก server ตอน start + subscribe update)
- buffer เมื่อ internet ล่ม (local queue) แล้ว flush เมื่อกลับมา
- uplink เลือกได้: 4G / WiFi / LAN (decision #13) — config ที่ gateway

## 2. MQTT topic structure
```
akr/{tenantId}/{marketId}/{deviceUuid}/telemetry     ← node → server   (QoS1)
akr/{tenantId}/{marketId}/{deviceUuid}/heartbeat      ← node → server   (QoS0)
akr/{tenantId}/{marketId}/{deviceUuid}/ack            ← node → server   (QoS1)
akr/{tenantId}/{marketId}/{deviceUuid}/cmd            ← server → node   (QoS1)
akr/{tenantId}/{marketId}/{deviceUuid}/status         ← gw → server (retained, LWT)
akr/{tenantId}/{marketId}/gateway/status              ← gw online/offline (retained, LWT)
akr/{tenantId}/{marketId}/gateway/event               ← gw → server (join, error, buffer flush)
sys/registry/{deviceUuid}                             ← server → gw (assign short-id, key rotate)
```
- แยก topic ต่อ tenant/market → ทำ **ACL** ได้ (gateway เห็นเฉพาะ market ตัวเอง)

## 3. Envelope (JSON บน MQTT)
### telemetry
```json
{
  "v": 1,
  "uuid": "e0790e1d-...-410c2e",
  "short": 42,
  "market": "665f...",
  "fmt": 1,                       // format_version (1=market1φ, 2=market3φ, 10=condo)
  "ts": 1732000000,               // epoch จาก node
  "rx_ts": 1732000001,            // เวลา gw รับ (กัน clock drift)
  "seq": 12043,
  "data": {                       // decode แล้วเป็นหน่วยจริง
    "elec": { "v": 230.1, "a": 4.2, "w": 966, "kwh": 1234.567, "pf": 0.95, "hz": 50.0 },
    "water": { "m3": 88.123, "flow_lpm": 3.4 },
    "relay": { "power": true, "valve": true },
    "temp": 38, "fw": 1, "flags": []
  }
}
```
### cmd (server → node)
```json
{ "req_id": 17, "channel": "power", "action": "off", "arg": 0,
  "issued_by": "user:...", "reason": "overdue", "expires_at": 1732003600 }
```
### ack (node → server)
```json
{ "req_id": 17, "channel": "power", "result": "ok", "relay": { "power": false } }
```

## 4. QoS / retained / LWT
- telemetry/cmd/ack = **QoS 1** (at-least-once) — server ทำ idempotent ด้วย `(uuid, seq)` / `(uuid, req_id)`
- `.../status`, `gateway/status` = **retained + LWT** → รู้ online/offline ทันที
- heartbeat = QoS 0 (หายได้)

## 5. Auth / ACL (broker)
- แต่ละ **gateway** มี MQTT username/password (หรือ client-cert) ผูกกับ `(tenant, market)`
- ACL: gateway publish/subscribe ได้เฉพาะ `akr/{tenant}/{market}/#`
- **Go server** = superuser (subscribe `akr/#`, publish cmd)
- เก็บ credential ใน `mqtt_credentials` (ดู [03](03-data-model.md))

## 6. Server ingest pipeline (Go)
```
MQTT sub akr/+/+/+/telemetry
  → validate envelope (schema by fmt)
  → dedup (uuid, seq) ผ่าน cache
  → resolve device→unit→meters (cache)
  → เขียน readings (Time-Series) 1 doc/มิเตอร์/นาที
  → update device.last_seen / online
  → update prepaid credit (ถ้า prepaid) + trigger cutoff check
  → publish ขึ้น WS hub (realtime หน้าเว็บ)
```

## 7. Command pipeline (Go)
```
API POST /control (web) → validate role + 2-step confirm (decision #27)
  → create device_commands doc (status=pending, req_id)
  → publish akr/{t}/{m}/{uuid}/cmd  (QoS1)
  → รอ ack topic (timeout 8s รวม gw retry)
  → update device_commands (ok/failed) + relay_state
  → log control_event (actor, reason, override?) (decision #26)
  → push WS อัปเดตสถานะล็อก
```

## 8. Gateway ↔ registry sync
- ตอน gw start → subscribe `sys/registry/#` + ขอ snapshot ผ่าน `gateway/event {type:"sync_req"}`
- server ตอบ map `{uuid, short_id, market_key_id}` ต่อ device ในตลาดนั้น
- เพิ่ม device ใหม่ → server publish `sys/registry/{uuid}` (retained) → gw อัปเดต map
- key rotation → publish key ใหม่ (encrypt ด้วย gw cert) → gw กระจายลง node ผ่าน CONFIG

## 9. เวลาและ clock
- gateway เป็น time source (มี NTP ผ่าน internet) → broadcast TIME_SYNC ลง mesh
- server ใช้ `rx_ts` ของ gw เป็นหลักถ้า node clock เพี้ยน (เก็บทั้งคู่)

## 10. condo format (format_version = 10)
- ตู้ main อ่านหลายมิเตอร์ (เช่น SDM120 หลายตัว ผ่าน RS485/Modbus) — ไม่ใช่ mesh
- gateway คอนโด = ตัวอ่าน Modbus + push ตรง MQTT (ไม่มี ESP-NOW layer)
- envelope: `data.meters: [{ channel, kwh, v, a, w }, ...]` (array) — ไม่มี water/valve (หรือมีตาม config)
