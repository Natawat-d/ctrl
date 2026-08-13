import { getDb } from "@/lib/mongo";
import { oid } from "@/controllers/resource";
import { tenantFilter } from "@/lib/auth";
import { requireUser, json, httpError, type IdCtx } from "@/lib/http";
import { calcUsage } from "@/controllers/billingController";
import { deviceView } from "@/lib/device";

export async function GET(req: Request, { params }: IdCtx) {
  const { user, error } = requireUser(req);
  if (error) return error;
  const db = await getDb();
  const unitId = oid(params.id);
  const unit = await db.collection("units").findOne(tenantFilter(user, { _id: unitId }));
  if (!unit) return httpError(404, "not_found", "ไม่พบล็อก");
  if (user.role === "tenant_user" && String(unit.occupant_user_id) !== user.uid) {
    return httpError(403, "forbidden", "ไม่ใช่ล็อกของคุณ");
  }

  const meters = await db.collection("meters").find({ unit_id: unitId }).toArray();
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const out: { kind: string; last_value?: number; last_ts?: Date; usage_today: number; unit?: string }[] = [];
  for (const m of meters) {
    out.push({
      kind: m.kind,
      last_value: m.last_value,
      last_ts: m.last_ts,
      usage_today: await calcUsage(db, m._id, from, now),
      unit: m.unit_of_measure,
    });
  }
  const bill = await db.collection("bills").find({ unit_id: unitId }).sort({ issued_at: -1 }).limit(1).next();
  const devs = await db.collection("devices").find({ unit_id: unitId }).toArray();
  const devices = {};
  for (const d of devs) devices[d.kind || "unknown"] = deviceView(d);
  return json({
    unit: { id: unitId, code: unit.code, name: unit.name, rent: unit.rent, floor: unit.floor ?? null, common_fee: unit.common_fee || 0 },
    meters: out,
    devices,
    bill,
  });
}
