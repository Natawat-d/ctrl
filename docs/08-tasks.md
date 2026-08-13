# 08 — Roadmap & Tasks (ทุกอย่างที่ต้องทำ)

> เริ่มลงมือที่ไฟล์นี้ · เรียงตาม dependency · hardware ทำเฟสท้าย (decision) · dev บน local Docker ก่อน (decision #30)
> เครื่องหมาย: `[ ]` ยังไม่ทำ · `[~]` กำลังทำ · `[x]` เสร็จ

## Phase 0 — Foundation / โครง
- [ ] init repo: `backend/` (Go modules), `frontend/` (Next.js), `docs/`, `infra/`
- [ ] `docker-compose.yml` (mongo, mosquitto, backend, frontend, caddy) + `.env.example`
- [ ] Caddyfile + Mosquitto config (ACL, auth file)
- [ ] backend skeleton: config loader, logger, mongo connect, `/healthz`
- [ ] frontend skeleton: Next.js App Router, tailwind, i18n(th), layout + landing (1-2-3-4 + ปุ่ม login)
- [ ] Makefile / scripts (`up`, `seed`, `test`)

## Phase 1 — Data model + Auth + CRUD
- [ ] สร้าง collections + indexes ตาม [03-data-model.md](03-data-model.md) (migration/ensureIndexes)
- [ ] readings เป็น **Time-Series collection** + TTL/retention setup
- [ ] repo layer (mongo) ทุก entity
- [ ] auth: login/refresh/logout, JWT, password hash
- [ ] middleware: auth, **tenant-scope**, rbac, error format
- [ ] CRUD API: tenants, markets, zones, units, meters, devices
- [ ] seed script: platform admin + tenant/market ตัวอย่าง + โซน + ล็อก + มิเตอร์
- [ ] unit tests: auth, tenant isolation, usage calc

## Phase 2 — Ingest / MQTT / Devices
- [ ] MQTT client service (subscribe `akr/#`)
- [ ] codec: decode telemetry ตาม `format_version` (market1φ/3φ, condo) [01](01-protocol-mesh.md)
- [ ] ingest pipeline: validate → dedup(uuid,seq) → resolve device→unit→meter → เขียน TS → update device
- [ ] device provisioning API: register uuid → assign short_id → publish `sys/registry`
- [ ] **device simulator** (mock publisher ทุก 1 นาที) — ทดสอบไม่ต้องมี hardware
- [ ] mesh status API + offline scan cron
- [ ] tests: ingest idempotent, dedup, decode ทุก format

## Phase 3 — Realtime + Dashboard + 3D twin
- [ ] WS hub (subscribe market, fan-out telemetry/status/control_result)
- [ ] owner dashboard: การ์ดสรุป + กราฟ (แยกน้ำ-ไฟ วัน/สัปดาห์/เดือน)
- [ ] readings/usage API (minute/hour/day) + charts
- [ ] **3D digital twin** (react-three-fiber): เรนเดอร์โซน→แถว→ล็อก, สีตามสถานะ, คลิกดูรายละเอียด
- [ ] twin layout editor (จัดตำแหน่ง/ตั้งชื่อโซน) + `GET/PUT /markets/:id/twin`
- [ ] realtime อัปเดต twin/tiles ทุก ~1 นาที

## Phase 4 — Control (ตัด-ต่อ)
- [ ] control service: create command → publish cmd → track ACK/timeout/retry
- [ ] `device_commands` audit + `control_events` log
- [ ] API: `/units/:id/control` (2-step confirm), `/override`, `/control/history`
- [ ] UI: ปุ่มเปิด-ปิด น้ำ/ไฟ + modal ยืนยัน 2 ชั้น + แสดงผล ACK realtime
- [ ] simulator ตอบ ACK (ok/fail/timeout) เพื่อทดสอบ flow

## Phase 5 — Billing engine
- [ ] usage calc (start/end + offset guard + prorate)
- [ ] cron `billing.generate` (รอบตาม cycle_day) → บิลแยกบรรทัด + ค่าเช่า
- [ ] cron `billing.late_fee` (ต่อวัน)
- [ ] cron `billing.auto_cutoff` (เกิน grace → ตัดน้ำ+ไฟ)
- [ ] payment: แนบสลิป (upload) → owner verify → paid → เปิดคืน
- [ ] override flow (log + expiry) + cron หมดอายุ
- [ ] UI: bills list/detail, generate, verify สลิป, tenant แนบสลิป
- [ ] tests: usage, late fee, cutoff, state machine, edge cases (partial, rollover, prorate)

## Phase 6 — Prepaid + Credit
- [ ] credit balance + txns; หัก near-realtime จาก ingest
- [ ] cron `prepaid.check` (≤0 ตัด, ≤threshold แจ้ง)
- [ ] topup API + UI; payment_mode both (per-unit)

## Phase 7 — Retention / Export
- [ ] rollup cron (รายชม./วัน)
- [ ] export CSV ต่อ market (async → ลิงก์)
- [ ] purge ดิบทุก 3 เดือน (หลัง export) (decision #15)

## Phase 8 — Platform admin + polish
- [ ] platform admin: สร้าง/ระงับ tenant, ออก ID/pass เจ้าของ
- [ ] audit_logs ครบ action สำคัญ
- [ ] แจ้งเตือน (บิลใหม่, ใกล้ตัด, ถูกตัด, credit ต่ำ) — in-app / LINE (ทีหลัง)
- [ ] i18n สมบูรณ์, สกุลเงินบาท, responsive
- [ ] rate-limit, security review, healthcheck/monitoring

## Phase 9 — Hardware / Firmware (decision: ทำทีหลัง)
- [ ] ESP32 firmware: espnow, AES-CCM, packet codec, meter drivers (PZEM Modbus, pulse, DS18B20)
- [ ] relay/valve control + LCD + fan(อุณหภูมิ)
- [ ] provisioning (JOIN) + offline buffer + 1-min scheduler(jitter)
- [ ] gateway firmware: ESP-NOW↔MQTT bridge, short-id map, buffer, uplink(4G/WiFi/LAN)
- [ ] condo variant: Modbus multi-meter → MQTT
- [ ] OTA (ท้ายสุด)

## Phase 10 — Deploy จริง (VPS)
- [ ] Caddy auto-SSL โดเมนจริง, MQTT TLS(8883)
- [ ] mongo auth + backup cron นอกเครื่อง
- [ ] monitoring/alert, CI/CD

---
## ลำดับแนะนำเริ่มลงมือ
`Phase 0 → 1 → 2 (+ simulator) → 3 → 4 → 5` ก่อน (ได้ระบบครบวงจรบน mock)
แล้วค่อย `6 → 7 → 8`, ส่วน `9 (hardware)` ขนานไปได้เมื่อพร้อม, `10` ตอน go-live
