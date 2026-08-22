import { getDb } from "@/lib/mongo";
import { oid } from "@/controllers/resource";
import { tenantFilter } from "@/lib/auth";
import { requireUser, json, httpError, type IdCtx } from "@/lib/http";
import { usageFromRows } from "@/controllers/billingController";

// GET readings for one meter over a time range.
//   ?kind=electric|water  and either ?from=ISO&to=ISO  or  ?hours=N
export async function GET(req: Request, { params }: IdCtx) {
  const { user, error } = requireUser(req);
  if (error) return error;
  const db = await getDb();
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") || "electric";

  // tenants may only read their own unit
  const unit = await db.collection("units").findOne(tenantFilter(user, { _id: oid(params.id) }));
  if (!unit) return httpError(404, "not_found", "ไม่พบล็อก");
  if (user.role === "tenant_user" && String(unit.occupant_user_id) !== user.uid) return httpError(403, "forbidden", "ไม่ใช่ล็อกของคุณ");

  const fromParam = url.searchParams.get("from");
  let from, to;
  if (fromParam) {
    from = new Date(fromParam);
    to = url.searchParams.get("to") ? new Date(url.searchParams.get("to")!) : new Date();
  } else {
    const hours = parseInt(url.searchParams.get("hours") || "24", 10);
    to = new Date();
    from = new Date(to.getTime() - hours * 36e5);
  }
  if (isNaN(from) || isNaN(to)) return json({ kind, points: [], used: 0 });

  const meter = await db.collection("meters").findOne({ unit_id: unit._id, kind });
  if (!meter) return json({ kind, points: [], used: 0 });

  const rows = await db.collection("readings")
    .find({ "meta.meter_id": meter._id, ts: { $gte: from, $lte: to } })
    .sort({ ts: 1 })
    .toArray();

  // segment-aware + clamped (จับการเปลี่ยนมิเตอร์ ไม่โชว์ค่าติดลบ)
  const used = +usageFromRows(rows).toFixed(3);
  // downsample to <= 300 points for a light, readable chart
  const N = Math.max(1, Math.ceil(rows.length / 300));
  const points = rows.filter((_, i) => i % N === 0 || i === rows.length - 1).map((r) => ({ ts: r.ts, v: r.v }));
  return json({ kind, points, used, from, to });
}
