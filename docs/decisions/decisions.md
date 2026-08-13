# ✅ สรุปการตัดสินใจออกแบบระบบ (30 ข้อ)

> ที่มาจากคำถาม `spec-questions.md` · ใช้เป็น source of truth ในการออกแบบ protocol / data model / code

## A. โครงสร้างข้อมูล
1. **Multi-tenant SaaS** — รองรับหลายตลาด/เจ้าของบน platform เดียว
2. **Collection เดียว `Unit`** — field `type = market_lock | condo_room`
3. ลำดับชั้น **ตลาด/อาคาร → โซน → ล็อก** (3 ระดับ)
4. **มิเตอร์กำหนดต่อล็อกได้** (บางล็อกไฟอย่างเดียว / บางล็อกไฟ+น้ำ)
5. รองรับ **1 เฟส + 3 เฟส** (field `phase`)

## B. โปรโตคอล Mesh
6. **ESP-NOW** (เลือกเพราะส่งไกลสุด — ใช้ Long-Range mode ได้)
7. Packet = **binary struct**
8. **short id 4–8 ไบต์** ใน mesh → map เป็น UUID เต็มที่ server
9. Telemetry = **push ทุก 1 นาที**
10. คำสั่ง relay = **ACK + retry 3 ครั้ง** (timeout 2 วิ)

## C. Server / Gateway
11. Gateway ↔ Server = **MQTT**
12. Broker = **self-host (Mosquitto/EMQX ใน Docker)**
13. Gateway uplink = **เลือกได้ต่อไซต์ (4G / WiFi / LAN)**
14. ตลาด vs คอนโด = **แยก schema ต่อ device type + field version** (`fw_version` / `format_version`)

## D. จัดเก็บ & ความปลอดภัย
15. Retention = **เก็บดิบทั้งหมด (อาจลด sample) → export CSV ให้ลูกค้า → ล้างทิ้งทุก 3 เดือน**
16. Time-series = **MongoDB Time-Series Collection**
17. Security mesh = **AES เข้ารหัส payload (key/ตลาด) + กัน replay (sequence)**

## E. บิล & เรท
18. เรท = **เรทเดียวทั้งตลาด** (ไม่แยกต่อล็อก)
19. บิล = **แยกบรรทัด** (ค่าไฟ / ค่าน้ำ / ค่าบริการ) **+ ค่าเช่าแผง (ตลาด) / ค่าห้อง (คอนโด)**
20. รอบบิล = **กำหนดวัน/เดือน ต่อตลาด**
21. **รองรับทั้ง Prepaid + Postpaid**
22. ค่าปรับจ่ายช้า = **คิดต่อวัน**
23. ตรวจสลิป = **แนบรูป + เจ้าของกดยืนยันเอง (manual)**

## F. การควบคุม / ตัดน้ำไฟ
24. ตัด auto = **กำหนดจำนวนวันผ่อนผันเองต่อตลาด**
25. ค้างจ่าย → **ตัดทั้งน้ำ + ไฟ**
26. Override (เปิดทั้งที่ค้าง) = **บันทึก log + เหตุผล + วันหมดอายุ**
27. ตัด/ต่อ manual = **ยืนยัน 2 ชั้น** (พิมพ์ยืนยัน/OTP)

## G. หน้าเว็บ / UX
28. หน้าล็อก = **3D digital twin ตั้งแต่แรก**
29. อัปเดตค่า/กราฟ = **near-realtime ทุก ~1 นาที** (WebSocket/SSE)

## H. Deploy
30. เริ่ม **ลองใน local Docker ก่อน** (dev) → ค่อย deploy VPS (Docker Compose + Caddy) ทีหลัง

---

## 🎯 ผลต่อสถาปัตยกรรม (สรุปสั้น)
- **Stack:** Next.js (SSR) + Go (backend) + MongoDB (Time-Series) + MQTT + Docker/Caddy · เริ่ม local
- **Data flow:** ESP-NOW node → (binary, short-id, AES) → Gateway → MQTT → Go server → MongoDB → Next.js (WS realtime + 3D twin)
- **Control flow:** Web → Go → MQTT → Gateway → ESP-NOW (short-id) → node relay → ACK กลับ
- **Billing:** rate/ตลาด, บิลแยกบรรทัด+ค่าเช่า, prepaid+postpaid, ปรับต่อวัน, ตัดทั้งน้ำ+ไฟตามวันผ่อนผัน
