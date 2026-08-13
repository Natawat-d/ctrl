# 📚 arkara_smart_electric — เอกสารออกแบบระบบ

ระบบ **Smart Submetering + Billing** — 2 สายผลิตภัณฑ์

| สาย | เครือข่าย | ตัดน้ำ-ไฟ |
|-----|----------|-----------|
| 🏪 **ตลาด** | ESP32 mesh (ESP-NOW) | ✅ มี |
| 🏢 **คอนโด / ที่พักอาศัย** | RS485 wired (riser) | ❌ **ไม่มี — ผิดกฎหมาย** |

ดูเหตุผลข้อกฎหมายที่ [`../README.md`](../README.md)

## ลำดับการอ่าน
| # | ไฟล์ | เนื้อหา |
|---|------|---------|
| 00 | [00-overview.md](00-overview.md) | ภาพรวมระบบ · actors · สถาปัตยกรรม · tech stack · data flow |
| 01 | [product/market/01-protocol-mesh.md](product/market/01-protocol-mesh.md) | 🏪 โปรโตคอล mesh (ESP-NOW binary packet, short-id, AES, ACK) — **ตลาดเท่านั้น** |
| 02 | [platform/02-protocol-server.md](platform/02-protocol-server.md) | Gateway ↔ Server (MQTT topics, envelope, command flow) |
| 03 | [platform/03-data-model.md](platform/03-data-model.md) | MongoDB schema ทุก collection + index + retention |
| 04 | [platform/04-backend-api.md](platform/04-backend-api.md) | Go backend: โครงโปรเจกต์, REST/WS API, services, cron |
| 05 | [platform/05-frontend.md](platform/05-frontend.md) | Next.js: หน้า/บทบาท, 3D digital twin, realtime, i18n |
| 06 | [platform/06-billing.md](platform/06-billing.md) | เอนจินบิล: เรท, prepaid/postpaid, ค่าปรับ, ตัดน้ำไฟ, state machine |
| 07 | [platform/07-deployment.md](platform/07-deployment.md) | docker-compose (local ก่อน), env, backup, deploy |
| 08 | [08-tasks.md](08-tasks.md) | **Roadmap + checklist ทุกงานที่ต้องทำ** (เริ่มที่นี่เวลาลงมือ) |

## แหล่งอ้างอิงการตัดสินใจ
- [`decisions/decisions.md`](decisions/decisions.md) + [`decisions/decisions_v2.md`](decisions/decisions_v2.md) — การตัดสินใจ (source of truth)
- [`decisions/data_sturture.md`](decisions/data_sturture.md) — สเปกดั้งเดิมจากเจ้าของโปรเจกต์
- [`../hardware/`](../hardware/README.md) — ฮาร์ดแวร์ + BOM (แยก market-mesh / condo-metering)
- [`../hardware/common/diagrams/`](../hardware/common/diagrams/) — ผังระบบ + schematic ระดับขั้วต่อ

## Tech stack (สรุป)
`Next.js (SSR)` + `Go (backend)` + `MongoDB (Time-Series)` + `MQTT (self-host)` + `Docker / Caddy`
เริ่มพัฒนาใน **local Docker** ก่อน → deploy VPS ทีหลัง
