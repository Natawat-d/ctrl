# Arkara — เกณฑ์มาตรฐาน UX/UI & Enterprise (วัดได้ อ้างอิงได้)

เอกสารนี้คือ "ไม้บรรทัด" ที่ใช้วัดงานดีไซน์และฟีเจอร์ระดับองค์กรของระบบ — อ้างอิงมาตรฐานสากล
ไม่คิดเอง ทุกข้อมี (ก) มาตรฐานอ้างอิง (ข) เกณฑ์วัด (ค) วิธีที่ระบบทำตาม

---

## 1) Usability — Nielsen Norman Group 10 Heuristics (1994, ปรับ 2020)

อ้างอิง: NN/g — *10 Usability Heuristics for User Interface Design* — https://www.nngroup.com/articles/ten-usability-heuristics/

| # | Heuristic | ระบบทำตาม |
|---|-----------|-----------|
| 1 | Visibility of system status | สถานะ online/offline (dot), spinner ตอนสั่งงาน, toast แจ้งผล, การ์ด "สถานะระบบ MQTT + data rate" เรียลไทม์ |
| 2 | Match real world | ภาษาไทยตรงงานจริง (แผง/ห้อง/โซน/ตึก/ตัดน้ำ-ไฟ) ไม่ใช้ศัพท์เทคนิค |
| 3 | User control & freedom | ปุ่มยกเลิกทุก modal, ยืนยัน 2 ชั้นก่อนตัดไฟ (ยกเลิกได้) |
| 4 | Consistency & standards | ใช้ design tokens ชุดเดียว (ดูข้อ 3), เลย์เอาต์ sidebar ตามมาตรฐาน enterprise (ข้อ 5) |
| 5 | Error prevention | ยืนยัน 2 ชั้น (control/prepare→confirm), confirm ก่อนลบ, validate ฟอร์มก่อนบันทึก |
| 6 | Recognition > recall | เมนูมีป้ายข้อความชัด, ตัวสลับสาขาแสดงชื่อ+ไอคอน, ค่าปัจจุบันเติมในฟอร์มให้เห็น |
| 7 | Flexibility & efficiency | mock-login ปุ่มเดียว, สลับสาขาเร็ว, CSV export, ปุ่มลัด |
| 8 | Aesthetic & minimalist | ตารางแน่น เน้นข้อมูล ลดสิ่งรบกวน |
| 9 | Recognize/diagnose/recover errors | ข้อความ error ภาษาคน (`.err`), แจ้ง "อุปกรณ์ไม่ตอบสนอง (timeout)" ไม่หลอกว่าสำเร็จ |
| 10 | Help & documentation | hint ใต้หัวข้อ, เอกสารนี้ + docs/ |

---

## 2) Accessibility — WCAG 2.2 ระดับ AA

อ้างอิง: W3C WAI — *Understanding SC 1.4.3 Contrast (Minimum)* — https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html · WebAIM Contrast — https://webaim.org/articles/contrast/

เกณฑ์วัด (ต้องผ่าน):
- **ข้อความปกติ ≥ 4.5:1**, ข้อความใหญ่ (≥24px หรือ ≥18.66px ตัวหนา) ≥ 3:1 (SC 1.4.3)
- **องค์ประกอบไม่ใช่ข้อความ/เส้นขอบ input ≥ 3:1** (SC 1.4.11)
- **Focus มองเห็นได้** ทุกจุดโต้ตอบ (SC 2.4.7) + ไม่ถูกบัง (2.4.11)
- **เป้าคลิก ≥ 24×24px** (SC 2.5.8 Target Size, ใหม่ใน 2.2)

ระบบทำตาม → design tokens ปรับสีข้อความให้ผ่าน 4.5:1 (`--text`, `--muted`, `--faint` ผ่าน AA), badge ใช้สี "ink" เข้ม, ทุกปุ่ม/ลิงก์/เมนูมี `:focus-visible` ring, ปุ่ม sm สูง ≥ 30px, แถวตาราง/ปุ่มไอคอน ≥ 32px

---

## 3) Spacing & Tokens — 8-Point Grid

อ้างอิง: Atlassian Design (Spacing) — https://atlassian.design/foundations/spacing · IBM Carbon, Salesforce Lightning, Microsoft Fluent, Shopify Polaris (ต่างบังคับ spacing เป็น token คูณ 4/8)

เกณฑ์วัด: ระยะห่าง/ขนาดทั้งหมดมาจากสเกลเดียว — **4, 8, 12, 16, 24, 32, 48, 64** (rhythm 8pt)
ขนาดคอมโพเนนต์: ปุ่ม 32/40px · input 40px · ไอคอน 16/20/24px · การ์ด padding 16/24px · radius 8/12/16

ระบบทำตาม → ประกาศ `--sp-1..--sp-10`, `--r-sm/md/lg`, `--shadow-1/2` ใน `:root` และใช้ทั่วทั้ง `globals.css`

---

## 4) Visual system — Material Design 3

อ้างอิง: Google — *Material Design 3, Styles* — https://m3.material.io/styles

นำมาใช้: **color roles** (primary / surface / semantic + สีคู่ "on-*" ที่คอนทราสต์ผ่าน), **elevation** เป็นเงาชั้น (level 0–2), **type scale** แบบมี role (display/headline/title/body/label), **shape scale** (มุมโค้งเป็นสเกล) — ปรับให้เข้ากับความหนาแน่นแบบ data-dense

---

## 5) Enterprise layout — Ant Design Pro / Carbon

อ้างอิง: Ant Design — *Navigation spec* — https://ant.design/docs/spec/navigation/ · Ant Design Pro — https://pro.ant.design/

เกณฑ์วัด: แอปข้อมูลหนาแน่นใช้ **navigation แนวตั้ง (sidebar)** — ยืดหยุ่น รองรับหลายระดับ, ป้ายยาวได้; **ความลึกเมนู ≤ 3** (ไม่เกิน 5); ใช้ **Table เป็นหลัก** สำหรับข้อมูลหนาแน่น
ระบบทำตาม → sidebar ซ้าย + topbar + ตัวสลับสาขา, ทุกลิสต์ข้อมูลเป็น `<table>`, เมนูลึก ≤ 2

---

## 6) Enterprise-ready — ตั้งได้ · ตามสืบได้ · รายงานได้

อ้างอิง: EnterpriseReady — *Audit Log* — https://www.enterpriseready.io/features/audit-log/

- **ตั้งได้ (Configurable):** เรท/รอบบิล/ค่าปรับ/ค่าเช่า/ส่วนกลาง/โหมดจ่าย ตั้งได้ระดับไซต์และรายห้อง; สร้างสาขา/โซน/ตึก/แผง/ห้องเองได้; 1 บัญชี = หลายสาขา
- **ตามสืบได้ (Auditable):** `audit_logs` แบบ append-only บันทึก **ใคร/ทำอะไร/เมื่อไร/ที่ไหน/ค่าก่อน→หลัง** ทุกการกระทำสำคัญ (login, ตัด-ต่อ, ออกบิล, ตรวจสลิป, จัดการผู้ใช้/โครงสร้าง/ตั้งค่า) + หน้าดู/กรอง/ส่งออก CSV; RBAC เห็นเฉพาะไซต์ตนเอง (admin เห็นทั้งหมด); เก็บ 1–3 ปี
- **รายงานได้ (Reportable):** รายงานการใช้ไฟ-น้ำ, รายได้ (ออกบิล/เก็บได้/ค้าง), อุปกรณ์ออนไลน์ ต่อสาขา/ช่วงเวลา + ส่งออก CSV

---

## เช็กลิสต์ผ่าน/ไม่ผ่าน (ใช้ตรวจงานทุกครั้ง)
- [ ] สีข้อความทุกจุด ≥ 4.5:1 (meta ≥ 4.5:1, badge ใช้ ink เข้ม)
- [ ] ทุกจุดโต้ตอบมี focus ring และเป้า ≥ 24px
- [ ] ระยะห่าง/ขนาดมาจากสเกล 8pt เท่านั้น
- [ ] ทุกลิสต์ข้อมูลเป็นตาราง, เมนูลึก ≤ 3
- [ ] การกระทำสำคัญถูกบันทึกลง audit_logs (ใคร/อะไร/เมื่อไร)
- [ ] มีรายงาน + ส่งออกได้
- [ ] ค่าตั้งได้ทุกระดับ (ไซต์/ห้อง), 1 บัญชีหลายสาขา
