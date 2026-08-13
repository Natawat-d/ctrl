import { getDb } from "@/lib/mongo";
import { oid } from "@/controllers/resource";
import { tenantFilter } from "@/lib/auth";
import { requireUser, json, httpError, type IdCtx } from "@/lib/http";
import { generateForMarket, prevCycle } from "@/controllers/billingController";
import { recordAudit } from "@/services/audit";

// POST: manually issue bills for a cycle.
// Rules: only on the market's billing day (cycle_day), and once per cycle
// (no duplicate/re-generate). platform_admin may pass ?force=1 to override.
// Default cycle = เดือนที่เพิ่งจบ (กดวันที่ 1 → เก็บหน่วยเดือนก่อนหน้าเต็มเดือน
// ไม่ใช่เดือนที่เพิ่งเริ่มซึ่งยังแทบไม่มีหน่วย)
export async function POST(req: Request, { params }: IdCtx) {
  const { user, error } = requireUser(req, ["platform_admin", "owner"]);
  if (error) return error;
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1" && user.role === "platform_admin";
  const db = await getDb();
  const mid = oid(params.id);
  // scope ด้วย tenantFilter กัน owner ออกบิลบน market ของ tenant อื่น
  const market = await db.collection("markets").findOne(tenantFilter(user, { _id: mid }));
  if (!market) return httpError(404, "no_market", "ไม่พบสาขา");

  const cycleParam = url.searchParams.get("cycle");
  if (cycleParam && !/^\d{4}-(0[1-9]|1[0-2])$/.test(cycleParam)) {
    return httpError(400, "bad_cycle", "รูปแบบ cycle ต้องเป็น YYYY-MM");
  }
  const cycle = cycleParam || prevCycle();
  const cycleDay = market.billing?.cycle_day || 1;
  const today = new Date().getDate();
  if (today !== cycleDay && !force) {
    return httpError(400, "not_bill_day", `ออกบิลได้เฉพาะวันที่ ${cycleDay} ของเดือน (วันนี้วันที่ ${today})`);
  }
  const existing = await db.collection("bills").countDocuments({ market_id: mid, cycle });
  if (existing > 0 && !force) {
    return httpError(409, "already_generated", `ออกบิลรอบ ${cycle} ไปแล้ว (${existing} ใบ) — กดออกซ้ำไม่ได้`);
  }

  const n = await generateForMarket(db, mid, cycle, { overwrite: force });
  await recordAudit({ user, action: "bill.generate", target_type: "market", target_id: params.id, market_id: params.id, detail: { cycle, generated: n } });
  return json({ generated: n, cycle });
}
