import { getDb } from "@/lib/mongo";
import { tenantFilter } from "@/lib/auth";
import { httpError } from "@/lib/http";
import { Markets, Units, Meters, Bills, oid } from "@/models";
import { calcUsage, effRate } from "@/controllers/billingController";
import { isOnline } from "@/lib/device";

function monthRange(cycle) {
  let base = new Date(cycle + "-01T00:00:00");
  if (isNaN(base.getTime())) base = new Date();
  const from = new Date(base.getFullYear(), base.getMonth(), 1);
  let to = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  const now = new Date();
  if (to > now) to = now;
  return [from, to];
}

// buildReport summarizes usage, revenue and device uptime for one site + cycle.
export async function buildReport(user, marketId, cycle) {
  const _id = oid(marketId);
  const market = await Markets.findOne(tenantFilter(user, { _id }));
  if (!market) return { error: httpError(404, "no_market", "ไม่พบสาขา") };
  cycle = cycle || new Date().toISOString().slice(0, 7);
  const [from, to] = monthRange(cycle);
  const db = await getDb();

  const units = await Units.find({ market_id: _id });
  const devices = await db.collection("devices").find({ market_id: _id }).toArray();
  const online = devices.filter(isOnline).length;
  const bills = await Bills.find({ market_id: _id, cycle });
  const billByUnit = Object.fromEntries(bills.map((b) => [String(b.unit_id), b]));

  // ต้นทุนต่อหน่วยที่เจ้าของจ่ายให้การไฟฟ้า/ประปา (config รายอาคาร) — กำไร = รายได้(เก็บผู้เช่า) − ต้นทุน
  const r0 = market.rate || {};
  const eCost = Number(r0.elec_cost_per_kwh) || 0;
  const wCost = Number(r0.water_cost_per_m3) || 0;

  let elecTot = 0, waterTot = 0, elecRev = 0, waterRev = 0;
  const per_unit: any[] = [];
  for (const u of units) {
    const b = billByUnit[String(u._id)];
    let e = 0, w = 0, eR = 0, wR = 0;
    if (b && b.lines) {
      // ออกบิลแล้ว → ใช้หน่วย/ยอดจากบิลจริง (สะท้อนเรตรายห้อง + เงินที่เรียกเก็บจริง)
      const eL = b.lines.find((l) => l.type === "electric");
      const wL = b.lines.find((l) => l.type === "water");
      e = eL?.usage || 0; w = wL?.usage || 0; eR = eL?.amount || 0; wR = wL?.amount || 0;
    } else {
      // ยังไม่ออกบิล → ประมาณการจาก readings × เรตขายปัจจุบัน
      const meters = await Meters.find({ unit_id: u._id });
      for (const m of meters) {
        const usage = await calcUsage(db, m._id, from, to);
        if (m.kind === "water") w += usage; else e += usage;
      }
      const r = effRate(market, u);
      eR = e * (r.elec_per_kwh || 0); wR = w * (r.water_per_m3 || 0);
    }
    elecTot += e; waterTot += w; elecRev += eR; waterRev += wR;
    per_unit.push({
      code: u.code, name: u.name,
      elec_kwh: +e.toFixed(2), water_m3: +w.toFixed(2),
      elec_rev: +eR.toFixed(2), water_rev: +wR.toFixed(2),
      elec_cost: +(e * eCost).toFixed(2), water_cost: +(w * wCost).toFixed(2),
      bill_total: b ? b.total : 0, status: b ? b.status : "-",
    });
  }

  const elecCost = elecTot * eCost, waterCost = waterTot * wCost;
  const R2 = (n) => +n.toFixed(2);
  const utility = {
    elec: { units: R2(elecTot), revenue: R2(elecRev), cost: R2(elecCost), profit: R2(elecRev - elecCost), sell_rate: Number(r0.elec_per_kwh) || 0, cost_rate: eCost },
    water: { units: R2(waterTot), revenue: R2(waterRev), cost: R2(waterCost), profit: R2(waterRev - waterCost), sell_rate: Number(r0.water_per_m3) || 0, cost_rate: wCost },
    total: { revenue: R2(elecRev + waterRev), cost: R2(elecCost + waterCost), profit: R2(elecRev + waterRev - elecCost - waterCost) },
    has_cost: eCost > 0 || wCost > 0,
  };

  const billed = bills.reduce((s, b) => s + (b.total || 0), 0);
  const paidBills = bills.filter((b) => b.status === "paid");
  const paid = paidBills.reduce((s, b) => s + (b.total || 0), 0);

  return {
    data: {
      market: { name: market.name, type: market.type }, cycle,
      units: { total: units.length, occupied: units.filter((u) => u.status === "occupied").length },
      devices: { total: devices.length, online },
      usage: { elec_kwh: +elecTot.toFixed(2), water_m3: +waterTot.toFixed(2) },
      utility,
      revenue: { billed, paid, outstanding: billed - paid, bills: bills.length, paid_bills: paidBills.length },
      per_unit,
    },
  };
}

export function reportCsv(d) {
  const esc = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const lines: any[] = [];
  lines.push([`รายงานสาขา ${d.market.name}`, `รอบ ${d.cycle}`].map(esc).join(","));
  lines.push([`ไฟรวม (kWh)`, d.usage.elec_kwh, `น้ำรวม (m3)`, d.usage.water_m3].map(esc).join(","));
  lines.push([`ออกบิลรวม`, d.revenue.billed, `เก็บได้`, d.revenue.paid, `ค้างชำระ`, d.revenue.outstanding].map(esc).join(","));
  lines.push("");
  const u = d.utility;
  if (u) {
    lines.push(["สรุปกำไรค่าน้ำ-ไฟ", "หน่วยรวม", "รายได้ (เก็บผู้เช่า)", "ต้นทุน", "กำไร", "ต้นทุน/หน่วย", "ขาย/หน่วย"].map(esc).join(","));
    lines.push(["ไฟฟ้า", u.elec.units, u.elec.revenue, u.elec.cost, u.elec.profit, u.elec.cost_rate, u.elec.sell_rate].map(esc).join(","));
    lines.push(["น้ำ", u.water.units, u.water.revenue, u.water.cost, u.water.profit, u.water.cost_rate, u.water.sell_rate].map(esc).join(","));
    lines.push(["รวม", "", u.total.revenue, u.total.cost, u.total.profit, "", ""].map(esc).join(","));
    lines.push("");
  }
  lines.push(["รหัส", "ชื่อ", "ไฟ (kWh)", "น้ำ (m3)", "ค่าไฟ (เก็บ)", "ค่าน้ำ (เก็บ)", "ต้นทุนไฟ", "ต้นทุนน้ำ", "ยอดบิล", "สถานะ"].map(esc).join(","));
  for (const r of d.per_unit) lines.push([r.code, r.name, r.elec_kwh, r.water_m3, r.elec_rev, r.water_rev, r.elec_cost, r.water_cost, r.bill_total, r.status].map(esc).join(","));
  return "﻿" + lines.join("\r\n");
}
