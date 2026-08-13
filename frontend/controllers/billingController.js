import { notifyTenant } from "@/services/notify";

// usageFromRows: รวมหน่วยจากมิเตอร์สะสม (cumulative counter) แบบทนต่อการเปลี่ยนมิเตอร์
// - baseV = ค่าตั้งต้นก่อนช่วงนี้ (reading สุดท้ายก่อน from) ถ้ามี — ครอบคลุมหน่วยคาบเกี่ยวขอบเดือน
//   และแก้เคส "เดือนนี้มี reading เดียว" (คำนวณเทียบกับ baseline เดือนก่อนได้)
// - delta >= 0 : ใช้ผลต่างปกติ
// - delta < 0  : มิเตอร์ถูกเปลี่ยน/รีเซ็ตกลางช่วง → นับ segment ใหม่จาก 0 ถึงค่าปัจจุบัน (ไม่ทิ้งทั้งเดือน)
export function usageFromRows(rows, baseV = null) {
  if (!rows || !rows.length) return 0;
  let total = 0;
  let base = baseV != null ? baseV : (rows[0].v || 0);
  const start = baseV != null ? 0 : 1; // ไม่มี baseline ก่อนหน้า → ใช้จุดแรกเป็น baseline
  for (let i = start; i < rows.length; i++) {
    const v = rows[i].v || 0;
    const d = v - base;
    total += d >= 0 ? d : v; // reset → หน่วยของ segment ใหม่ = ค่าปัจจุบัน (จาก 0)
    base = v;
  }
  return total < 0 ? 0 : total;
}

export async function calcUsage(db, meterId, from, to) {
  const coll = db.collection("readings");
  // baseline = reading สุดท้ายก่อน from (ถ้ามี) เพื่อไม่ทิ้งหน่วยคาบเกี่ยวขอบเดือน
  const prev = await coll.find({ "meta.meter_id": meterId, ts: { $lt: from } }).sort({ ts: -1 }).limit(1).next();
  const rows = await coll.find({ "meta.meter_id": meterId, ts: { $gte: from, $lt: to } }).sort({ ts: 1 }).toArray();
  return usageFromRows(rows, prev ? (prev.v || 0) : null);
}

// prevCycle: รอบบิลที่ "เพิ่งจบ" — กดตัดบิลวันที่ 1 จะเก็บหน่วยของเดือนก่อนหน้าเสมอ
// (คำนวณจากเวลาท้องถิ่น ไม่ใช้ toISOString เพราะ UTC ทำให้ข้ามเดือนผิดช่วงหัวค่ำวันที่ 1)
export function prevCycle(d = new Date()) {
  const p = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, "0")}`;
}

function monthRange(cycle) {
  let base = new Date(cycle + "-01T00:00:00");
  if (isNaN(base.getTime())) {
    const n = new Date();
    base = new Date(n.getFullYear(), n.getMonth(), 1);
  }
  const from = new Date(base.getFullYear(), base.getMonth(), 1);
  const to = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  return [from, to];
}

// effRate/effBilling resolve per-unit overrides on top of the market defaults.
export function effRate(mk, u) {
  const base = mk.rate || {};
  const o = u.rate_override || {};
  return {
    elec_per_kwh: o.elec_per_kwh != null && o.elec_per_kwh !== "" ? Number(o.elec_per_kwh) : base.elec_per_kwh || 0,
    water_per_m3: o.water_per_m3 != null && o.water_per_m3 !== "" ? Number(o.water_per_m3) : base.water_per_m3 || 0,
    service_fee: base.service_fee || 0,
  };
}
export function effBilling(mk, u) {
  const base = mk.billing || {};
  const o = u.billing_override || {};
  const pick = (k, d) => (o[k] != null && o[k] !== "" ? o[k] : base[k] != null ? base[k] : d);
  return {
    due_days: Number(pick("due_days", 7)),
    grace_days: Number(pick("grace_days", 3)),
    late_fee_per_day: Number(pick("late_fee_per_day", 20)),
    late_fee_type: pick("late_fee_type", "fixed"),
  };
}

export async function generateForMarket(db, marketId, cycle, { overwrite = false } = {}) {
  const mk = await db.collection("markets").findOne({ _id: marketId });
  if (!mk) return 0;
  const [from, to] = monthRange(cycle);
  const issued = new Date();

  const units = await db.collection("units").find({ market_id: marketId, status: "occupied" }).toArray();
  let count = 0;
  for (const u of units) {
    // ห้ามเขียนทับบิลที่ออกไปแล้ว (สถานะจ่าย/ค่าปรับจะถูกล้าง) — cron ชั่วโมงถัดไปของวันตัดบิลจะข้ามเอง
    const existed = await db.collection("bills").findOne({ unit_id: u._id, cycle });
    if (existed && !overwrite) continue;
    const rate = effRate(mk, u);
    const bcfg = effBilling(mk, u);
    const due = new Date(issued.getTime() + bcfg.due_days * 864e5);
    const grace = new Date(due.getTime() + bcfg.grace_days * 864e5);

    const meters = await db.collection("meters").find({ unit_id: u._id }).toArray();
    const lines = [];
    let subtotal = 0;
    for (const m of meters) {
      const usage = await calcUsage(db, m._id, from, to);
      const r = m.kind === "water" ? rate.water_per_m3 : rate.elec_per_kwh;
      const amount = usage * r;
      lines.push({ type: m.kind, usage, rate: r, amount });
      subtotal += amount;
    }
    if (u.rent > 0) { lines.push({ type: "rent", amount: u.rent }); subtotal += u.rent; }
    if (u.common_fee > 0) { lines.push({ type: "common", amount: u.common_fee }); subtotal += u.common_fee; }
    if (rate.service_fee > 0) { lines.push({ type: "service", amount: rate.service_fee }); subtotal += rate.service_fee; }

    await db.collection("bills").updateOne(
      { unit_id: u._id, cycle },
      {
        $set: {
          tenant_id: mk.tenant_id, market_id: marketId, unit_id: u._id, occupant_user_id: u.occupant_user_id || null,
          cycle, period: { from, to }, issued_at: issued, due_at: due, grace_until: grace,
          lines, subtotal, late_fee: 0, total: subtotal, status: "issued", paid_amount: 0, updated_at: new Date(),
        },
        $setOnInsert: { created_at: new Date() },
      },
      { upsert: true }
    );
    if (!existed) {
      await notifyTenant(db, u._id, `บิลใหม่ รอบ ${cycle}`, `${u.name || u.code}: ยอดรวม ฿${subtotal.toLocaleString()} กำหนดชำระ ${due.toLocaleDateString("th-TH")}`);
    }
    count++;
  }
  return count;
}

export async function accrueLateFees(db) {
  const now = new Date();
  const bills = await db.collection("bills").find({ status: { $in: ["issued", "overdue", "partially_paid"] }, due_at: { $lt: now } }).toArray();
  const mkCache = {}, uCache = {};
  for (const b of bills) {
    const daysLate = Math.floor((now - new Date(b.due_at)) / 864e5);
    if (daysLate < 1) continue;
    const mkey = String(b.market_id);
    let mk = mkCache[mkey] || (mkCache[mkey] = await db.collection("markets").findOne({ _id: b.market_id }));
    const ukey = String(b.unit_id);
    let u = uCache[ukey] || (uCache[ukey] = (await db.collection("units").findOne({ _id: b.unit_id })) || {});
    const bcfg = effBilling(mk || {}, u);
    const perDay = bcfg.late_fee_per_day || 0;
    const fee = bcfg.late_fee_type === "percent" ? ((b.subtotal * perDay) / 100) * daysLate : perDay * daysLate;
    await db.collection("bills").updateOne({ _id: b._id }, { $set: { late_fee: fee, total: b.subtotal + fee, status: "overdue", updated_at: now } });
  }
}
