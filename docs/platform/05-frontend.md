# 05 — Frontend (Next.js)

> decisions #28 (3D twin ตั้งแต่แรก), #29 (near-realtime) · ref UI สไตล์ hostatom.com

## 1. โครงโปรเจกต์ (App Router, SSR)
```
frontend/
  app/
    (public)/page.tsx            # landing: อธิบายระบบ 1-2-3-4 + ปุ่ม login บนขวา
    login/page.tsx
    (owner)/                     # เจ้าของตลาด/คอนโด
      dashboard/page.tsx         # overview การเงิน + การใช้ + แนวโน้ม
      twin/page.tsx              # 3D digital twin (โซน/แถว/ล็อก)
      units/[id]/page.tsx        # รายละเอียดล็อก + กราฟ + ควบคุม
      bills/page.tsx             # รายการบิล + generate/ส่ง
      payments/page.tsx          # ตรวจสลิป (verify)
      settings/rate/page.tsx     # ตั้งเรท
      settings/billing/page.tsx  # รอบบิล/ผ่อนผัน/ค่าปรับ/ตัดน้ำไฟ
      devices/page.tsx           # provision hardware + สถานะ mesh
    (tenant)/                    # ผู้เช่า
      home/page.tsx              # ใช้ไฟ/น้ำ กี่บาท, มีบิลไหม
      bills/[id]/page.tsx        # บิล + แนบสลิป
    (admin)/tenants/page.tsx     # platform admin
  components/  (charts, twin, tiles, bill, ...)
  lib/  (api client, ws client, auth, i18n)
  next.config.js  (SSR, i18n th)
```
**Libs:** `react-three-fiber` + `drei` (3D), `recharts` หรือ `visx` (กราฟ), `zustand`/`tanstack-query` (state/data), `tailwind` (UI), `next-intl` (ไทย).

## 2. UI flow (จาก data_sturture.md)
- ยังไม่ login (ไม่มี cookie) → หน้า landing อธิบายระบบ **1 2 3 4** + ปุ่ม **Login มุมขวาบน**
- login แล้ว → เห็นเมนู/ฟังก์ชันตาม role ของ account

## 3. หน้าเจ้าของ (owner)
- **Dashboard:** การ์ดสรุป (ใช้ไฟ/น้ำวันนี้-เดือนนี้, รายรับ, ค้างจ่าย, ล็อกที่ถูกตัด), กราฟแนวโน้ม (แยกน้ำ-ไฟ, วัน/สัปดาห์/เดือน)
- **3D Twin (decision #28):** เรนเดอร์ตลาดเป็นโซน→แถว→ล็อก; แต่ละล็อกสีตามสถานะ (เขียว=ปกติ, เหลือง=ค้างจ่าย, แดง=ถูกตัด, เทา=ว่าง); คลิกล็อก → panel รายละเอียด + ปุ่มควบคุม; ตั้งชื่อโซน/จัดตำแหน่งได้
- **ตั้งเรท / รอบบิล / ผ่อนผัน / ค่าปรับ / ตัดน้ำไฟ** → ฟอร์มผูกกับ `markets.rate/billing/cutoff`
- **ควบคุม:** ปุ่มเปิด-ปิด น้ำ/ไฟต่อล็อก → **ยืนยัน 2 ชั้น** (modal พิมพ์ยืนยัน/OTP, decision #27)
- **บิล:** generate รอบนี้, ดูสถานะ, กด verify สลิป → เปลี่ยนเป็นจ่ายแล้ว → เปิดน้ำไฟถ้าเคยตัด
- **Override:** เปิดใช้ทั้งที่ค้าง (กรอกเหตุผล + วันหมดอายุ, decision #26)

## 4. หน้าผู้เช่า (tenant)
- ใช้ไฟ/น้ำเดือนนี้กี่หน่วย/กี่บาท (near-realtime), กราฟย้อนหลัง
- บิล: ดูรายการ, **แนบสลิป** (upload), สถานะ (ค้าง/รอตรวจ/จ่ายแล้ว)
- เห็นเฉพาะล็อกของตัวเอง (อาจหลายล็อก)

## 5. Platform admin
- สร้าง/ระงับ tenant, ออก ID/pass เจ้าของ

## 6. Realtime (decision #29)
- เปิด WS `/api/v1/ws` หลัง login → subscribe market
- อัปเดต twin + tiles + กราฟล่าสุด ทุก ~1 นาที (จาก push); กราฟย้อนหลังโหลดผ่าน REST
- แสดง online/offline ของ node จาก status event

## 7. i18n / currency
- ภาษาไทยหลัก, สกุลเงิน **บาท (THB)**, timezone Asia/Bangkok
- ตัวเลขหน่วย kWh / m³

## 8. Auth handling
- access token เก็บใน memory, refresh ใน httpOnly cookie; middleware Next ตรวจ session สำหรับหน้า SSR
- redirect ตาม role หลัง login
