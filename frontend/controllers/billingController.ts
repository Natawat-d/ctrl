// relative (ไม่ใช่ alias @/) เพื่อให้ scripts/check-billing.mjs รันด้วย node ตรง ๆ ได้
// Next resolve relative import เหมือนกันทุกประการ
import { notifyTenant } from "../services/notify.ts";
import type { BillLine } from "@/models/types";

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
    // ponytail: สมมติว่ามิเตอร์ตัวใหม่เริ่มนับจาก 0 — ถ้าเอามิเตอร์มือสองที่ค้างค่า 800 มาใส่
    // ผู้เช่าจะโดนคิด 800 หน่วยทันที. จากสตรีมค่าอย่างเดียวแยก "reset เป็น 0" กับ "มิเตอร์ใหม่
    // ที่ 800" ไม่ได้ ต้องบันทึก meter.initial_value ตอนเปลี่ยนมิเตอร์แล้วหักออกตรงนี้
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
    // BILL-5: แม้สั่ง overwrite ก็ห้ามทับบิลที่เก็บเงินมาแล้ว — เดิม force=1 รีเซ็ต
    // status:"issued" + paid_amount:0 ทั้งที่ payments ยัง verified อยู่ = บิลโชว์ค้างซ้ำ
    if (existed && (!overwrite || (existed.paid_amount || 0) > 0)) continue;
    const rate = effRate(mk, u);
    const bcfg = effBilling(mk, u);
    const due = new Date(issued.getTime() + bcfg.due_days * 864e5);
    const grace = new Date(due.getTime() + bcfg.grace_days * 864e5);

    const meters = await db.collection("meters").find({ unit_id: u._id }).toArray();
    const lines: BillLine[] = [];
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

// applyPayment: บวกยอดที่จ่ายจริงเข้าบิล แล้วสรุปสถานะ — ยอดยังไม่ครบ = partially_paid
// (เดิม verify route set paid_amount = total เสมอ ทำให้จ่ายบางส่วนกลายเป็นจ่ายครบ)
export function applyPayment(bill, amount) {
  // amount ที่ parse ไม่ได้ต้องเป็น 0 ไม่ใช่ NaN — NaN บวกเข้าไปทีเดียวทำให้ยอดทั้งใบพัง
  const add = Number(amount);
  const paid = (bill.paid_amount || 0) + (Number.isFinite(add) ? add : 0);
  return { paid_amount: paid, status: paid >= (bill.total || 0) ? "paid" : "partially_paid" };
}

export async function accrueLateFees(db) {
  const now = new Date();
  const bills = await db.collection("bills").find({ status: { $in: ["issued", "overdue", "partially_paid"] }, due_at: { $lt: now } }).toArray();
  const mkCache = {}, uCache = {};
  for (const b of bills) {
    // BILL-4: นับจาก grace_until (ออกบิลเก็บไว้แล้วแต่ไม่เคยถูกอ่าน) ไม่ใช่ due_at
    // — เดิมเก็บค่าปรับทับช่วงผ่อนผัน grace_days (ดีฟอลต์ 3 วัน)
    // prefilter due_at ด้านบนยังใช้ได้ เพราะ grace_until >= due_at เสมอ (superset)
    const daysLate = Math.floor((now.getTime() - new Date(b.grace_until || b.due_at).getTime()) / 864e5);
    if (daysLate < 1) continue;
    const mkey = String(b.market_id);
    let mk = mkCache[mkey] || (mkCache[mkey] = await db.collection("markets").findOne({ _id: b.market_id }));
    const ukey = String(b.unit_id);
    let u = uCache[ukey] || (uCache[ukey] = (await db.collection("units").findOne({ _id: b.unit_id })) || {});
    const bcfg = effBilling(mk || {}, u);
    const perDay = bcfg.late_fee_per_day || 0;
    // BILL-4: percent คิดจากยอดค้างจริง ไม่ใช่ subtotal เต็ม (จ่ายบางส่วนแล้วยังโดนปรับเต็ม)
    const outstanding = Math.max(0, (b.subtotal || 0) - (b.paid_amount || 0));
    const fee = bcfg.late_fee_type === "percent" ? ((outstanding * perDay) / 100) * daysLate : perDay * daysLate;
    // BILL-4: อย่าทับ partially_paid ให้กลายเป็น overdue เฉย ๆ — เก็บข้อมูลว่าจ่ายมาบางส่วนไว้
    const status = (b.paid_amount || 0) > 0 ? "partially_paid" : "overdue";
    await db.collection("bills").updateOne({ _id: b._id }, { $set: { late_fee: fee, total: (b.subtotal || 0) + fee, status, updated_at: now } });
  }
}
