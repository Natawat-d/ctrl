# 06 — Billing Engine

> decisions #18–27 · หัวใจของฝั่ง software

## 1. เรท (decision #18 — เรทเดียวทั้งตลาด)
- เก็บที่ `markets.rate`: `elec_per_kwh`, `water_per_m3`, `service_fee`
- ทุกล็อกในตลาดใช้เรทเดียวกัน (มี `effective_from` เผื่อปรับเรทในอนาคต → เก็บ history)

## 2. การคิดหน่วยที่ใช้ (usage)
```
usage = end_reading - start_reading      // จากค่าสะสม (kWh/m³)
```
- start = ค่าสะสม ณ ต้นรอบ (จาก readings/rollup), end = ณ สิ้นรอบ
- **guard:** ถ้า end < start (มิเตอร์ reset/rollover/เปลี่ยนมิเตอร์) → ใช้ `meter.offset` ชดเชย + flag ให้ตรวจ
- ย้ายเข้า/ออกกลางรอบ → prorate ตามวันจริง

## 3. รอบบิล (decision #20)
```
cron billing.generate (ทุกวัน 00:05):
  for market where today == billing.cycle_day:
    period = เดือนที่แล้ว (from..to)
    for unit in market.units where occupied:
      lines = []
      for meter in unit.meters:
        usage = calcUsage(meter, period)
        lines += { type: meter.kind, usage, rate, amount = usage*rate }
      lines += { type: rent, amount: unit.rent }          // decision #19
      if market.rate.service_fee: lines += { type: service, ... }
      bill = { cycle, period, lines, subtotal, total,
               issued_at, due_at = issued_at + due_days,
               grace_until = due_at + grace_days,          // decision #24
               status: issued }
      send bill → tenant account (แจ้งเตือน)
```

## 4. Postpaid flow (decision #21)
```
issued ──(ถึง due_at ยังไม่จ่าย)──▶ overdue
overdue ──(ทุกวัน)──▶ + late_fee_per_day            (decision #22)
overdue ──(เกิน grace_until, auto)──▶ CUTOFF (power+water)   (decisions #24,#25)
any ──(ผู้เช่าแนบสลิป → เจ้าของ verify)──▶ paid → เปิดน้ำไฟ    (decision #23)
overdue/cutoff ──(เจ้าของ override)──▶ allowed_unpaid (log+expiry)  (decision #26)
```

## 5. Prepaid flow (decision #21 — รองรับด้วย)
```
unit.payment_mode = prepaid:
  ingest telemetry → คำนวณ usage delta → หัก credit.balance ตามเรท (near-realtime)
  credit ≤ low_threshold → แจ้งเตือนผู้เช่า
  credit ≤ 0 → cron prepaid.check → CUTOFF (power+water)
  topup → เติม balance → ถ้าเคยตัด → เปิดคืน
```
> `payment_mode = both`: unit เลือกโหมดต่อล็อกได้ (default จาก market)

## 6. ค่าปรับจ่ายช้า (decision #22 — ต่อวัน)
```
cron billing.late_fee (ทุกวัน):
  for bill in overdue:
    days_late = today - due_at
    fee = (late_fee_type==fixed) ? late_fee_per_day * days_late
                                 : total * (late_fee_per_day/100) * days_late
    bill.late_fee = fee ; bill.total = subtotal + fee
```

## 7. Cutoff logic (decisions #24,#25,#27)
```
auto_cutoff (cron):
  for bill overdue where today > grace_until and not paid and not override.active:
    channels = market.cutoff.on_overdue    // ["power","water"] ตัดทั้งคู่
    control.send(unit, channels, action=off, trigger=auto_overdue)
    unit.service_state = cutoff ; log control_event

manual (owner):
  require 2-step confirm (decision #27) → control.send(..., trigger=manual)

reconnect:
  on payment verified / topup / override → control.send(..., action=on, trigger=...)
  unit.service_state = on|override
```

## 8. Override (decision #26)
```
POST /units/:id/override { enable:true, reason, expires_at }
  → unit.override = { active:true, reason, by, expires_at }
  → เปิดน้ำไฟ (แม้ค้างจ่าย) ; service_state = override
  → log control_event(trigger=override)
cron: override.expires_at ผ่าน → active=false → ถ้ายังค้าง → กลับเข้า cutoff flow
```

## 9. State machines
**bill.status:** `draft → issued → overdue → (paid | void)` ; `partially_paid` ถ้าจ่ายบางส่วน
**unit.service_state:** `on ⇄ cutoff ⇄ override` (+ `vacant` ถ้าไม่มีผู้เช่า)

## 10. Edge cases ที่ต้องจัดการ
- จ่ายบางส่วน (partial) → `paid_amount`, ยังไม่เปิดถ้ายังไม่ครบ (owner ตัดสิน)
- มิเตอร์ reset/rollover → offset + flag
- ย้ายเข้า-ออกกลางรอบ → prorate + ปิดยอดล็อกเดิม
- node offline ตอนออกบิล → ใช้ reading ล่าสุด + flag ประมาณการ
- เปลี่ยนเรทกลางรอบ → คิดตาม effective_from (แยกช่วง)
- เขต timezone → คิดรอบตาม Asia/Bangkok
