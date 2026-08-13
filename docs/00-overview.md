# 00 — ภาพรวมระบบ (Overview)

## 1. ระบบนี้คืออะไร
Hardware + Software สำหรับ **วัดค่าน้ำ-ไฟรายหน่วยเช่า** (ล็อกตลาด / ห้องเช่า / คอนโด) + **สั่งตัด-ต่อน้ำไฟจากระยะไกล** + **ออกบิลอัตโนมัติ** — เจ้าของไม่ต้องเดินจดมิเตอร์เอง

## 2. รุ่นฮาร์ดแวร์ (2 แบบ, format การส่งต่างกัน — decision #14)
| รุ่น | โครงสร้าง | การเชื่อมต่อ |
|------|-----------|--------------|
| **ตลาด (market)** | แต่ละล็อก = 1 node (ESP32 + มิเตอร์ไฟ/น้ำ + relay/วาล์ว + จอ LCD) | **ESP-NOW mesh** → node ใหญ่ (gateway) กลางตลาด → internet |
| **คอนโด/ห้องเช่า (condo)** | มิเตอร์ไฟหลายตัวรวมที่ตู้ main | ต่อสายรวมที่ main → 1 จุด internet |

> ทั้งสองรุ่นส่งข้อมูลรูปแบบต่างกัน → server แยก schema ตาม `device.type` + `format_version`

## 3. Actors / บทบาท (decision #1 multi-tenant, roles)
```
Platform Admin ── สร้าง/จัดการบัญชี เจ้าของตลาด (tenant)
     │
Tenant (องค์กรเจ้าของ) ── 1 บัญชีลูกค้า = 1 ตลาด/คอนโด หรือหลายที่
     ├── Owner (เจ้าของตลาด/คอนโด) ── คุมทุกอย่างในตลาดตัวเอง
     ├── Staff (พนักงาน/ผู้ช่วย) ── สิทธิ์จำกัด (optional)
     └── Tenant-user (ผู้เช่า) ── ดูค่าน้ำไฟ/บิลของล็อกตัวเอง, แนบสลิป
```
- Login ผู้เช่า: `ID = market_name@xxxxxx`, `pass = xxxxxxx` (เจ้าของออกให้)
- Platform admin ออก ID/pass ให้เจ้าของตอนสมัคร

## 4. โมเดลหลัก (Core entities) — ดูรายละเอียด [03-data-model.md](03-data-model.md)
```
Tenant (org)
 └─ Market (type: market_mesh | condo_wired)  ── billing config, rate, cutoff policy
     └─ Zone (โซน/แถว/ตึก)                      (decision #3: 3 ระดับ)
         └─ Unit (ล็อก/ห้อง)  ── ผู้เช่า, ค่าเช่า, สถานะบิล
             └─ Meter (ไฟ/น้ำ, 1φ/3φ)          (decision #4,#5: กำหนดต่อล็อก)
                 └─ Reading (time-series, 1 นาที/ครั้ง)
Device (node hardware, UUID + short-id)  ──ผูกกับ── Unit / Meter channels
```

## 5. สถาปัตยกรรม (ระดับสูง)
```
┌─ ตลาด (mesh) ───────────────────────────────┐
│  [node ล็อก] ⇄ [node ล็อก] ⇄ ... ⇄ [Gateway] │──4G/WiFi/LAN──┐
└──────────── ESP-NOW (binary+AES+short-id) ───┘               │
                                                                ▼
                                                    ┌──── MQTT broker ────┐
                                                    │  (self-host Docker) │
                                                    └──────────┬──────────┘
                                                               ▼
                                         ┌──── Go Backend ───────────────┐
                                         │  ingest · api · ws · billing  │
                                         │  cron (bill/late/cutoff/rollup)│
                                         └───┬───────────────────┬───────┘
                                             ▼                   ▼
                                      MongoDB (Time-Series)   WebSocket/SSE
                                             │                   ▼
                                             └──────► Next.js (SSR + 3D twin + charts)
```

## 6. Data flow
**ขาขึ้น (telemetry):** node อ่านมิเตอร์ทุก 1 นาที → binary packet (short-id, AES) → gateway ถอด+ห่อ → MQTT → Go ingest → เก็บ MongoDB TS → push realtime ผ่าน WS ขึ้นหน้าเว็บ
**ขาลง (command):** Web กด → Go → MQTT → gateway → ESP-NOW (short-id) → node สั่ง relay/วาล์ว → **ACK กลับ** → อัปเดตสถานะ

## 7. Tech stack + เหตุผล
| ชั้น | เทคโนโลยี | เหตุผล |
|------|-----------|--------|
| Frontend | **Next.js (App Router, SSR)** | SSR, SEO landing, React ecosystem, 3D (react-three-fiber) |
| Backend | **Go** | เร็ว, concurrency ดี (MQTT + WS + cron พร้อมกัน) |
| DB | **MongoDB (Time-Series Collection)** | schema ยืดหยุ่น (market/condo ต่าง format), TS สำหรับ reading |
| Messaging | **MQTT (Mosquitto/EMQX self-host)** | มาตรฐาน IoT, pub/sub, reconnect, LWT online status |
| Reverse proxy | **Caddy** | auto-SSL |
| Container | **Docker Compose** | dev local ก่อน แล้ว deploy VPS |

## 8. Non-functional requirements
- **Sampling:** 1 นาที/node (decision #9)
- **Realtime UI:** อัปเดต ~1 นาที ผ่าน WS/SSE (decision #29)
- **Retention:** เก็บดิบทั้งหมด (อาจ downsample) → export CSV ให้ลูกค้า → ล้างทุก 3 เดือน (decision #15)
- **Security:** AES + replay guard บน mesh (decision #17); JWT + role/tenant scoping บน server; MQTT ACL per tenant
- **Reliability:** command ACK + retry 3 (decision #10); node buffer เมื่อ gateway ล่ม; MQTT LWT บอก offline
- **Multi-tenant isolation:** ทุก query scope ด้วย `tenant_id`
