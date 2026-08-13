# 📋 สรุปโปรเจกต์ CTRL — Frontend + Server

> ระบบ **Smart Submetering + Billing** — มอนิเตอร์น้ำ-ไฟรายห้อง/รายแผง + ออกบิลรายเดือนอัตโนมัติ
> เอกสารนี้สรุปเฉพาะส่วน **เว็บแอป (frontend) + เซิร์ฟเวอร์ (API/DB)** — ไม่รวมฮาร์ดแวร์
> repo: <https://github.com/Natawat-d/ctrl> · live: <http://147.50.254.104/ctrl>

---

## 1. ภาพรวม

เว็บแอปตัวเดียวทำหน้าที่ทั้ง **frontend + backend** ผ่าน Next.js App Router
(หน้าเว็บ = React, API = Route Handlers ในโปรเจกต์เดียวกัน)

หน้าที่หลัก:
- **รับค่ามิเตอร์** (telemetry) จาก gateway/poller ทาง **REST** → เก็บลง MongoDB
- **มอนิเตอร์** การใช้น้ำ-ไฟรายห้อง/แผง แบบเรียลไทม์
- **ออกบิลรายเดือน** อัตโนมัติจากค่าที่วัดได้ + จัดการชำระเงิน
- **แยกสิทธิ์** เจ้าของไซต์ / ผู้เช่า / แอดมินแพลตฟอร์ม (multi-tenant)

> **หมายเหตุ (CTRL web pivot):** เว็บโฟกัสแค่ **monitor + billing** · รับค่าเข้าทาง REST ingest ·
> **ไม่มี** ฟังก์ชันตัดน้ำ-ตัดไฟ และ **ไม่ใช้ MQTT** ในเส้นทางหลัก (แม้ docker-compose ยังมี service mosquitto ติดมา)

---

## 2. Tech Stack

| ชั้น | เทคโนโลยี |
|------|-----------|
| Framework | **Next.js 14** (App Router, `output: standalone`) |
| Language | JavaScript (ESM) |
| UI | React 18 + **Redux Toolkit** (`@reduxjs/toolkit`, `react-redux`) |
| Database | **MongoDB** (driver `mongodb` โดยตรง — ไม่มี ODM) |
| Auth | **JWT** (`jsonwebtoken`) + **bcryptjs** |
| Email | `nodemailer` (forgot-password reset link) |
| Deploy | Docker Compose + **Caddy** (reverse proxy) บน VPS |
| Timezone | `Asia/Bangkok` |

**Scripts** (`frontend/package.json`):
```
npm run dev     # next dev -p 3000
npm run build   # next build
npm run start   # next start -p 3000
npm run seed    # node scripts/seed.mjs   → seed ข้อมูลตัวอย่าง
npm run mock    # node scripts/espmock.mjs → จำลอง gateway ยิง telemetry
```

---

## 3. สถาปัตยกรรม (Layered + Redux)

โค้ดแยกเป็นชั้นชัดเจน — **route = HTTP adapter บางๆ**, ตรรกะอยู่ใน controller, ข้อมูลผ่าน model เท่านั้น

```
app/api/**/route.js   ── HTTP adapter (parse req → เรียก controller → json response)
        │
        ▼
controllers/*.js      ── business logic (auth check, tenant scope, validation)
        │
        ├─► models/           ── repository ต่อ 1 collection (makeRepo)
        ├─► services/         ── ingest / audit / notify
        └─► lib/              ── auth, mongo, http, device, labels, api

store/  (Redux)       ── state ฝั่ง client (authSlice, marketSlice)
```

**กติกา:** โค้ดใหม่ต้องวางให้ถูกชั้น — data access ทุกจุดผ่าน `models/` (ไม่ยิง mongo ตรงจาก route)

### โฟลเดอร์ `frontend/`
| โฟลเดอร์ | หน้าที่ |
|----------|---------|
| `app/` | หน้าเว็บ (pages) + `app/api/` (REST endpoints) |
| `components/` | React components ใช้ร่วม |
| `controllers/` | business logic แยกตาม domain |
| `models/` | `index.js` (รายชื่อ repo) + `repository.js` (`makeRepo`, `oid`) |
| `services/` | `ingest.js` · `audit.js` · `notify.js` |
| `lib/` | `auth.js` · `mongo.js` · `http.js` · `device.js` · `labels.js` · `api.js` |
| `store/` | Redux — `authSlice` · `marketSlice` · `Provider` · `hooks` |
| `scripts/` | `seed.mjs` (seed data) · `espmock.mjs` (mock gateway) |
| `public/` | static assets (SVG พื้นหลัง, โลโก้) |

---

## 4. Data Model (MongoDB collections)

ประกาศใน `models/index.js` — 1 repository ต่อ 1 collection:

| Collection | เก็บอะไร |
|-----------|---------|
| `users` | ผู้ใช้ + role + `tenant_id` |
| `tenants` | องค์กร/เจ้าของไซต์ (ขอบเขต multi-tenant) |
| `markets` | ตลาด/โครงการ (ไซต์) |
| `zones` | โซน/ชั้น ภายในไซต์ |
| `units` | ห้อง/แผงค้า (`occupant_user_id` = ผู้เช่าที่ผูก) |
| `meters` | มิเตอร์ (น้ำ/ไฟ) ผูกกับ unit |
| `devices` | อุปกรณ์ gateway/มิเตอร์ (มี pool สำหรับ UUID ที่ยังไม่ผูก) |
| `readings` | ค่าที่วัดได้ตามเวลา (telemetry) |
| `bills` | บิลรายรอบ |
| `payments` | การชำระเงิน (มี verify/reject) |
| `credits` | เครดิต/ยอดยกมา |
| `notifications` | การแจ้งเตือน |
| `control_events` · `device_commands` | เหตุการณ์/คำสั่งอุปกรณ์ |
| `audit_logs` | บันทึกการกระทำ (auditable) |

---

## 5. สิทธิ์ผู้ใช้ (Roles) & Auth

**3 บทบาท:**
| Role | ขอบเขต |
|------|--------|
| `platform_admin` | ผู้ดูแลแพลตฟอร์ม — เห็นทุกไซต์ (เห็นรหัสผ่าน owner ได้) |
| `owner` | เจ้าของไซต์ — จัดการ unit/มิเตอร์/บิลของ tenant ตัวเอง |
| `tenant_user` | ผู้เช่า — เห็นเฉพาะ **ห้องของตัวเอง** เท่านั้น |

**Auth flow** (`lib/auth.js`):
- Login → ออก **JWT** (payload: `uid`, `role`, `tid`), หมดอายุ 24 ชม.
- รหัสผ่าน hash ด้วย **bcrypt** (cost 10)
- **SEC-1 fail-closed:** production ต้องตั้ง `JWT_SECRET` เสมอ — เช็คแบบ **lazy** (ตอนใช้ token จริง ไม่ใช่ตอน import) เพื่อไม่ให้ `next build` พัง
- **Multi-tenant scoping:** ทุก query กรองด้วย `tenant_id` อัตโนมัติ (`tenantFilter`)
- **SEC-3 occupant scoping (กัน IDOR):** ผู้เช่า share `tenant_id` กับเจ้าของ+ผู้เช่าคนอื่น → `tenantFilter` อย่างเดียวไม่พอ · `occupantScope()` จำกัดผู้เช่าให้เห็นเฉพาะ unit/bill/meter/reading ของ `occupant_user_id` ตัวเอง · collection อื่น (zones, devices, payments) ผู้เช่าอ่านตรงไม่ได้

**Forgot password:** ส่งลิงก์รีเซ็ตทางอีเมล (owner เท่านั้น) ผ่าน `nodemailer` — โค้ดพร้อม รอผูก SMTP จริง

---

## 6. REST API (`app/api/`)

~43 endpoints จัดกลุ่มตาม domain:

### Auth — `api/auth/`
`login` · `signup` · `me` · `verify` · `forgot` · `reset`

### รับค่ามิเตอร์ — `api/ingest` (POST)
gateway/poller ยิง JSON มาทีละมิเตอร์:
```json
{ "uuid": "...", "kind": "electric|water", "ts": 1785708000,
  "data": { "kwh": 123.4, "v": 220, "a": 5, "w": 1100, "pf": 0.98, "hz": 50 } }
```
- UUID **ไม่รู้จัก** → เข้า **device pool** (`unit_id = null`) รอเจ้าของผูกในหน้าตั้งค่า
- UUID **ผูกแล้ว** → เขียนลง `readings` ของมิเตอร์นั้น
- `parseTs()` รองรับ ts หลายรูปแบบ (epoch วินาที/มิลลิ, string ISO) — **กันเคสเพี้ยนเป็นปี 1970** (PIPE-1 fix)
- **SEC-4 fail-closed:** ต้องมี ingest key จึงรับข้อมูล

### จัดการทรัพยากร (CRUD + tenant scope)
`markets` · `zones` · `units` · `meters` · `devices` · `tenants` · `users`
(แต่ละตัวมี `[id]` สำหรับ get/update/delete)

**เฉพาะทาง:**
- `markets/[id]/overview` · `markets/[id]/bills/generate` · `markets/[id]/export/csv`
- `units/[id]/summary` · `units/[id]/readings` · `units/[id]/device`
- `devices/pool` (อุปกรณ์รอผูก)

### บิล & ชำระเงิน
- `bills` · `bills/[id]` · `bills/[id]/payments`
- `payments` · `payments/[id]/verify` · `payments/[id]/reject` (**BILL-3:** ตรวจสิทธิ์เจ้าของก่อน verify)

### แอดมิน & รายงาน
- `admin/overview` · `admin/health` · `admin/owners` (+`[id]`)
- `reports` · `audit` · `me`

---

## 7. เอนจินบิล (Billing)

- คิดหน่วยที่ใช้ = ค่าอ่านล่าสุด − ค่าอ่านต้นรอบ ต่อมิเตอร์
- **BILL-1 fix:** `calcUsage` กันเคสมิเตอร์ถูกรีเซ็ต / ค่าอ่านห่าง (ไม่คืน 0 ผิดๆ)
- ออกบิลรายไซต์ทีเดียว: `POST markets/[id]/bills/generate`
- รอบบิลมี validation (กันรอบซ้อน/ผิด)
- Export CSV: `markets/[id]/export/csv`

---

## 8. ความปลอดภัยที่ทำแล้ว (Security Hardening)

| รหัส | สิ่งที่ทำ |
|------|----------|
| **SEC-1** | JWT fail-closed — prod ไม่มี `JWT_SECRET` = ปฏิเสธ (กันปลอม token เป็น admin) |
| **SEC-2** | `users/[id]` จำกัดขอบเขตตาม tenant |
| **SEC-3** | occupant scoping กัน IDOR — ผู้เช่าเห็นเฉพาะของตัวเอง |
| **SEC-4** | `ingest` fail-closed — ต้องมี key |
| **BILL-3** | verify payment ตรวจความเป็นเจ้าของก่อน |
| — | rate-limit + validation รอบบิล |

ทุกการกระทำสำคัญบันทึกลง `audit_logs` (`services/audit.js`) — auditable

---

## 9. หน้าเว็บ (`app/`)

| หน้า | เนื้อหา |
|------|--------|
| `login` · `signup` · `forgot` · `reset` | เข้าสู่ระบบ / สมัคร / ลืมรหัส |
| `dashboard` | ภาพรวมการใช้น้ำ-ไฟ |
| `units` · `units/[id]` | รายการห้อง/แผง + รายละเอียด+ค่าอ่าน |
| `bills` | บิล |
| `tenants` | ผู้เช่า |
| `reports` | รายงาน |
| `settings` | ตั้งค่า + ผูกอุปกรณ์จาก pool |
| `me` | โปรไฟล์ผู้ใช้ |
| `admin` | หน้าแอดมินแพลตฟอร์ม |
| `audit` | บันทึกการกระทำ |
| `terms` | ข้อกำหนด |

---

## 10. Deployment

**Docker Compose** (`docker-compose.yml`) — 4 service:
| Service | Image | Port |
|---------|-------|------|
| `mongo` | mongo:7 | 27017 |
| `mqtt` | eclipse-mosquitto:2 | 1883 / 9001 *(ไม่ใช้ในเส้นทางหลักแล้ว)* |
| `web` | build `./frontend` | 3000 |
| `caddy` | caddy:2 | 80 (reverse proxy) |

**VPS จริง:** live ที่ `http://147.50.254.104/ctrl` (อยู่หลัง **Caddy**, path matching **case-insensitive** → `/CTRL` = `/ctrl`)

**basePath:** ตั้งผ่าน `NEXT_PUBLIC_BASE_PATH` (bake ตอน build) — รันใต้ subpath ได้ · `next.config.mjs` เปิด `basePath` แบบมีเงื่อนไข

**Env vars สำคัญ:**
```
MONGO_URI      mongodb://mongo:27017
DB_NAME        akr
JWT_SECRET     ← ต้องตั้งใน production (fail-closed)
TZ             Asia/Bangkok
NEXT_PUBLIC_BASE_PATH   /ctrl  (ถ้ารันใต้ subpath)
# SMTP (forgot-password) — รอผูกจริง
```

---

## 11. เริ่มรันเครื่อง dev

```bash
cd frontend
npm install
npm run seed      # (ครั้งแรก) สร้างข้อมูลตัวอย่าง — ต้องมี MongoDB รันอยู่
npm run dev       # http://localhost:3000
npm run mock      # (อีก terminal) จำลอง gateway ยิง telemetry เข้า /api/ingest
```

---

*อัปเดต: ส.ค. 2026 · สรุปจากโค้ดจริงใน `frontend/`*
