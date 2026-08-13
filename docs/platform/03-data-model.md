# 03 — Data Model (MongoDB)

> ทุก collection มี `_id (ObjectId)`, `created_at`, `updated_at` · ทุก doc (ยกเว้น platform-level) มี `tenant_id` เพื่อ isolation (decision #1) · index ระบุท้ายแต่ละหัวข้อ

## หลักการ
- **Multi-tenant:** ทุก query กรอง `tenant_id` เสมอ (middleware บังคับ)
- **Unit เดียว** market_lock/condo_room (decision #2)
- **Time-series แยก** สำหรับ reading (decision #16) + retention (decision #15)

---

## 1. `tenants` — องค์กรลูกค้า (เจ้าของตลาด/คอนโด)
```
{ _id, name, plan, status: active|suspended,
  contact: { email, phone }, created_at }
```
idx: `{status:1}`

## 2. `users` — บัญชีผู้ใช้ (auth)
```
{ _id, tenant_id?,               // null = platform admin
  role: platform_admin|owner|staff|tenant_user,
  login_id,                      // ผู้เช่า: "market_name@xxxxxx"
  password_hash,                 // bcrypt/argon2
  display_name, phone, email?,
  unit_ids: [ObjectId],          // tenant_user ผูกกับล็อก (decision: 1 คน หลายล็อกได้)
  permissions: [string],         // staff สิทธิ์ย่อย
  status, last_login }
```
idx: `{login_id:1} unique`, `{tenant_id:1, role:1}`

## 3. `markets` — ตลาด/คอนโด (1 ไซต์)
```
{ _id, tenant_id, name, type: market_mesh|condo_wired,
  address, timezone: "Asia/Bangkok",
  market_short: 0x0001,          // ใช้ใน mesh packet
  aes_key_ref,                   // อ้าง secret (ไม่เก็บ key ตรงๆ)
  rate: {                        // decision #18: เรทเดียวทั้งตลาด
    elec_per_kwh: 8.0, water_per_m3: 18.0,
    service_fee: 0, effective_from },
  billing: {                     // decision #20
    cycle_day: 1,                // ออกบิลวันที่ N ของเดือน
    due_days: 7,                 // ครบกำหนดกี่วันหลังออกบิล
    grace_days: 3,               // decision #24: ผ่อนผัน (กำหนดเอง)
    late_fee_per_day: 20,        // decision #22: ค่าปรับต่อวัน (บาท หรือ %)
    late_fee_type: fixed|percent },
  cutoff: {                      // decision #25
    on_overdue: ["power","water"],   // ตัดทั้งน้ำ+ไฟ
    auto: true,
    require_2step: true },       // decision #27
  payment_mode: postpaid|prepaid|both,  // decision #21
  layout_ref }                   // อ้าง digital twin layout (decision #28)
```
idx: `{tenant_id:1}`, `{market_short:1} unique`

## 4. `zones` — โซน/แถว/ตึก (decision #3)
```
{ _id, tenant_id, market_id, name, order, kind: row|building|zone }
```
idx: `{market_id:1, order:1}`

## 5. `units` — ล็อก/ห้อง
```
{ _id, tenant_id, market_id, zone_id,
  type: market_lock|condo_room,
  code: "A-12", name,
  rent: 3000,                    // decision #19: ค่าเช่าแผง/ค่าห้อง
  occupant_user_id,              // ผู้เช่าปัจจุบัน (null=ว่าง)
  meters: [                      // decision #4: กำหนดต่อล็อก
    { meter_id, kind: electric|water } ],
  status: occupied|vacant,
  service_state: on|cutoff|override,   // สถานะน้ำไฟปัจจุบัน
  override: { active, reason, by, expires_at },  // decision #26
  twin: { x, y, z, w, h, zone_slot } , // ตำแหน่งใน 3D
  payment_mode }                 // override ระดับ market ได้
```
idx: `{market_id:1, zone_id:1}`, `{occupant_user_id:1}`, `{tenant_id:1, code:1}`

## 6. `devices` — hardware node
```
{ _id, tenant_id, market_id,
  uuid: "e0790e1d-...",          // UUIDv4 บนตัว hardware (QR)
  short_id: 42,                  // decision #8: map ใน mesh
  device_type: market_node|condo_main,
  fw_version, format_version,    // decision #14
  unit_id,                       // ผูกกับล็อก (market: 1:1)
  channels: {                    // hardware → logical meter
    elec: { meter_id }, water: { meter_id },
    relay_power: 0, relay_valve: 1, relay_fan: 2 },
  mesh: { role: node|gateway, parent_short, rssi, hops },
  status: { online, last_seen, last_seq, temp, relay_state },
  provisioned_at }
```
idx: `{market_id:1, short_id:1} unique`, `{uuid:1} unique`, `{unit_id:1}`

## 7. `meters` — มิเตอร์เชิงตรรกะ
```
{ _id, tenant_id, market_id, unit_id, device_id,
  kind: electric|water,
  phase: 1|3,                    // decision #5
  channel,                       // ช่องบน device
  unit_of_measure: kWh|m3,
  pulse_factor?,                 // น้ำ pulse: ลิตร/พัลส์
  last_value, last_ts,
  offset }                       // ค่าเริ่ม/หลังเปลี่ยนมิเตอร์
idx: `{unit_id:1, kind:1}`, `{device_id:1}`
```

## 8. `readings` — **Time-Series Collection** (decision #16)
สร้างด้วย: `timeField: "ts"`, `metaField: "meta"`, `granularity: "minutes"`
```
{ ts: ISODate,                   // decision #9: ทุก 1 นาที
  meta: { tenant_id, market_id, unit_id, meter_id, kind },
  v,                             // ค่าอ่าน (kWh สะสม / m³ สะสม)
  rate_flow?,                    // อัตราไหล/กำลัง ณ ขณะนั้น
  raw: { volt, amp, watt, pf, hz, temp } }  // เก็บดิบ (decision #15)
```
- **Retention (decision #15):** เก็บดิบทั้งหมด → job รายวัน downsample + **export CSV ต่อ market** → **TTL/ลบทิ้งทุก 3 เดือน** (`expireAfterSeconds ≈ 7776000` บน field `ts` หรือ job ลบ + rollup)
idx: อัตโนมัติจาก TS (meta + ts)

## 9. `readings_rollup` — สรุปรายชม./วัน (คงไว้นานกว่า)
```
{ meta:{...}, period: hour|day, bucket: ISODate,
  usage,             // หน่วยที่ใช้ในช่วง (delta)
  start_v, end_v, min, max, avg_flow, samples }
```
idx: `{ "meta.unit_id":1, period:1, bucket:1 }`

## 10. `bills` — บิล (ดูตรรกะ [06-billing.md](06-billing.md))
```
{ _id, tenant_id, market_id, unit_id, occupant_user_id,
  cycle: "2026-07", period: { from, to },
  issued_at, due_at, grace_until,
  lines: [                        // decision #19 แยกบรรทัด
    { type: electric, usage: 120.5, rate: 8, amount: 964 },
    { type: water,    usage: 12.3,  rate: 18, amount: 221.4 },
    { type: rent,     amount: 3000 },
    { type: service,  amount: 0 },
    { type: late_fee, amount: 60, meta:{ days:3 } } ],
  subtotal, late_fee, total,
  status: draft|issued|overdue|paid|void|partially_paid,
  paid_amount, cutoff_state }
```
idx: `{unit_id:1, cycle:1} unique`, `{market_id:1, status:1}`, `{due_at:1}`

## 11. `payments`
```
{ _id, tenant_id, market_id, bill_id, unit_id, user_id,
  amount, method, slip_image_url,        // decision #23: แนบสลิป
  status: submitted|verified|rejected,
  verified_by, verified_at, note }
idx: `{bill_id:1}`, `{status:1}`
```

## 12. `credits` — กระเป๋าเครดิต prepaid (decision #21)
```
{ _id, tenant_id, market_id, unit_id, balance,
  low_threshold, updated_at }
// transactions:
credit_txns: { credit_id, type: topup|consume|adjust, amount, ref, ts }
idx: `{unit_id:1} unique`
```

## 13. `control_events` — log สั่งตัด/ต่อ (decision #26)
```
{ _id, tenant_id, market_id, unit_id, device_id,
  channel: power|water, action: on|off,
  trigger: manual|auto_overdue|prepaid_zero|override,
  actor_user_id, reason,
  override_expires_at,
  req_id, result: ok|failed, at }
idx: `{unit_id:1, at:-1}`, `{market_id:1, at:-1}`
```

## 14. `device_commands` — audit คำสั่ง (idempotent)
```
{ _id, device_id, req_id, channel, action,
  status: pending|acked|failed|timeout, retries,
  issued_by, issued_at, acked_at, result }
idx: `{device_id:1, req_id:1}`
```

## 15. `mqtt_credentials` — auth ต่อ gateway
```
{ _id, tenant_id, market_id, username, password_hash,
  acl: ["akr/{t}/{m}/#"], enabled }
```

## 16. `audit_logs` — action สำคัญทุกอย่าง (rate เปลี่ยน, บิล void, login...)
```
{ _id, tenant_id, actor_user_id, action, target, before, after, ip, at }
```

## 17. Secrets (ไม่เก็บใน Mongo ตรงๆ)
- AES market keys, JWT secret, MQTT superuser → **env / docker secret / vault** (ดู [07](07-deployment.md))
- `markets.aes_key_ref` เก็บแค่ reference/key-id

---
## ความสัมพันธ์ (ER ย่อ)
```
tenant 1─* market 1─* zone 1─* unit 1─* meter 1─* reading(TS)
market 1─* device *─1 unit ;  unit 1─* bill 1─* payment ; unit 1─1 credit
```
