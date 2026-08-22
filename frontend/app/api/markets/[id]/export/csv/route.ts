import { getDb } from "@/lib/mongo";
import { oid } from "@/controllers/resource";
import { tenantFilter } from "@/lib/auth";
import { requireUser, httpError, type IdCtx } from "@/lib/http";

export async function GET(req: Request, { params }: IdCtx) {
  const { user, error } = requireUser(req, ["platform_admin", "owner"]);
  if (error) return error;
  const db = await getDb();
  const marketId = oid(params.id);
  // ยืนยันว่า market เป็นของ caller ก่อน กัน owner export ข้อมูลมิเตอร์ของ tenant อื่น
  const market = await db.collection("markets").findOne(tenantFilter(user, { _id: marketId }));
  if (!market) return httpError(404, "no_market", "ไม่พบสาขา");
  const url = new URL(req.url);
  const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to")!) : new Date();
  const from = url.searchParams.get("from") ? new Date(url.searchParams.get("from")!) : new Date(Date.now() - 30 * 864e5);
  const rows = await db
    .collection("readings")
    .find({ "meta.market_id": marketId, ts: { $gte: from, $lt: to } })
    .sort({ ts: 1 })
    .toArray();
  let csv = "ts,kind,unit_id,meter_id,value\n";
  for (const r of rows) {
    const m = r.meta || {};
    csv += `${new Date(r.ts).toISOString()},${m.kind || ""},${m.unit_id || ""},${m.meter_id || ""},${r.v || 0}\n`;
  }
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=readings.csv" },
  });
}
