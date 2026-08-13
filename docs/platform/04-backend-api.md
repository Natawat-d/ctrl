# 04 — Backend (Go)

> decisions: Go (เร็ว), MQTT, Mongo TS, WS realtime, cron billing/cutoff/retention

## 1. โครงโปรเจกต์
```
backend/
  cmd/server/main.go            # entrypoint
  internal/
    config/                     # env, secrets
    http/                       # REST handlers + router
      middleware/               # auth(JWT), tenant-scope, rbac, ratelimit
    ws/                         # WebSocket hub (realtime)
    mqtt/                       # client, ingest, publisher
    domain/                     # entities + interfaces
    repo/                       # mongo repositories
    service/
      auth/  billing/  control/  metering/  rollup/  export/
    codec/                      # decode telemetry by format_version
    cron/                       # scheduled jobs
  pkg/                          # utils (id, crypto, logger)
  go.mod
```
**Framework:** `chi` (router) + `net/http` (เบา เร็ว) หรือ `Fiber` (fasthttp) — เลือก **chi** (มาตรฐาน, ecosystem ดี). Mongo driver ทางการ, MQTT = `eclipse/paho.golang`, WS = `nhooyr/websocket`, JWT = `golang-jwt`.

## 2. Auth (JWT + role/tenant scope)
- `POST /auth/login` → access token (15 นาที) + refresh (7 วัน, httpOnly cookie)
- ทุก request → middleware ตรวจ JWT → ใส่ `user{id, role, tenant_id}` ใน ctx
- **tenant-scope middleware:** บังคับ query filter `tenant_id` = user.tenant_id (ยกเว้น platform_admin)
- **rbac middleware:** map (role → allowed actions)

## 3. REST API (สรุป endpoint หลัก)
> ทุก path ขึ้นต้น `/api/v1` · 🔒 = ต้อง login · บทบาทในวงเล็บ

### Auth
```
POST /auth/login              login_id + password → tokens
POST /auth/refresh            หมุน token
POST /auth/logout
GET  /auth/me            🔒    ข้อมูล user + สิทธิ์
```
### Platform (platform_admin)
```
POST /tenants                 สร้าง tenant + owner (ตอนสมัคร)
GET  /tenants
PATCH /tenants/:id            suspend/activate
```
### Market / Zone / Unit  (owner, staff read)
```
GET/POST      /markets                 (owner)
GET/PATCH     /markets/:id             ตั้ง rate/billing/cutoff/payment_mode
GET/POST      /markets/:id/zones
GET/POST      /markets/:id/units
GET/PATCH     /units/:id               ตั้งค่าเช่า, ผูกผู้เช่า, meters
GET           /units/:id/summary       ใช้ไฟ/น้ำวันนี้-เดือนนี้, บิลล่าสุด, สถานะ
```
### Devices / provisioning (owner/staff)
```
POST  /devices                 register uuid → assign short_id (แล้ว sync gw)
GET   /devices/:id
PATCH /devices/:id             ผูก unit / channels
GET   /markets/:id/mesh        สถานะ mesh (online, rssi, hops)
```
### Readings / charts (owner + tenant ของตัวเอง)
```
GET /units/:id/readings?from&to&res=minute|hour|day&kind=elec|water
GET /units/:id/usage/summary?period=day|week|month
GET /markets/:id/overview       รวมทั้งตลาด (กราฟการเงิน, การใช้, แนวโน้ม)
```
### Rates / Billing (owner)
```
GET/PUT /markets/:id/rate
POST /markets/:id/bills/generate?cycle=YYYY-MM   สร้างบิลรอบนั้น (หรือ cron อัตโนมัติ)
GET  /markets/:id/bills?status=&cycle=
GET  /bills/:id
POST /bills/:id/void
```
### Payments
```
POST  /bills/:id/payments        (tenant) แนบสลิป (decision #23)
GET   /bills/:id/payments
POST  /payments/:id/verify       (owner) ยืนยัน → bill=paid → เปิดน้ำไฟถ้าเคยตัด
POST  /payments/:id/reject
```
### Credit (prepaid) (owner/tenant)
```
GET  /units/:id/credit
POST /units/:id/credit/topup
```
### Control (owner/staff) — decision #10,#25,#27
```
POST /units/:id/control        body:{channel:power|water|both, action:on|off, confirm_token, reason}
      → 2-step: ขอ confirm_token ก่อน (POST /units/:id/control/prepare) แล้วยืนยัน
POST /units/:id/override        body:{enable, reason, expires_at}   (decision #26)
GET  /units/:id/control/history
```
### Digital twin (decision #28)
```
GET  /markets/:id/twin          layout + สถานะล็อกเรียลไทม์
PUT  /markets/:id/twin          แก้ตำแหน่ง/โซน
```
### Export (decision #15)
```
POST /markets/:id/export/csv?from&to    export readings เป็น CSV (async → ลิงก์ดาวน์โหลด)
```

## 4. WebSocket / realtime (decision #29)
```
WS /api/v1/ws?token=...
  subscribe: { type:"sub", market_id }  (ตรวจสิทธิ์)
  server push:
    { type:"telemetry", unit_id, elec, water, ts }   ทุก ~1 นาที
    { type:"status", unit_id, service_state, online }
    { type:"control_result", unit_id, channel, result }
```
- WS hub เก็บ connection ต่อ (user, market) → fan-out จาก ingest/control

## 5. Services
- **metering** — ingest MQTT → decode(codec by fmt) → เขียน TS → update device/meter → push WS
- **control** — สร้าง command, publish, track ACK/timeout, log control_event
- **billing** — generate bills, คิด line items, late fee (ดู [06](06-billing.md))
- **rollup/export** — downsample TS → rollup, export CSV, purge 3 เดือน
- **auth** — login, token, rbac

## 6. Cron jobs (decisions #15,#20,#22,#24)
| job | ตาราง | ทำอะไร |
|-----|-------|--------|
| `billing.generate` | ทุกวัน 00:05 | ถ้าวันนี้ = `cycle_day` ของ market → ออกบิลทุก unit |
| `billing.late_fee` | ทุกวัน 00:10 | บิล overdue → บวกค่าปรับต่อวัน |
| `billing.auto_cutoff` | ทุกวัน 00:15 | เกิน `grace_until` + ยังไม่จ่าย + auto → สั่งตัด (power+water) |
| `prepaid.check` | ทุก 5 นาที | credit ≤ 0 → ตัด; ≤ threshold → แจ้งเตือน |
| `readings.rollup` | ทุกชม. | สร้าง rollup รายชม./วัน |
| `readings.export_purge` | ทุกวัน 01:00 | export CSV ที่ครบ 3 เดือน แล้วลบดิบ |
| `mesh.offline_scan` | ทุก 2 นาที | device ไม่ส่ง > X → mark offline + แจ้ง |

## 7. Config / env (ดู [07](07-deployment.md))
`MONGO_URI, MQTT_URL, MQTT_USER/PASS, JWT_SECRET, AES_KEK (encrypt market keys), STORAGE_PATH (slip/csv), TZ=Asia/Bangkok`

## 8. Validation & errors
- request validate ด้วย struct tags; error format `{ "error": { "code", "message", "fields" } }`
- idempotency: ingest `(uuid,seq)`, command `(device,req_id)`
