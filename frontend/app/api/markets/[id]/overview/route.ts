import { getDb } from "@/lib/mongo";
import { oid } from "@/controllers/resource";
import { tenantFilter } from "@/lib/auth";
import { requireUser, json, httpError, type IdCtx } from "@/lib/http";
import { calcUsage } from "@/controllers/billingController";
import { isOnline } from "@/lib/device";

export async function GET(req: Request, { params }: IdCtx) {
  const { user, error } = requireUser(req);
  if (error) return error;
  const db = await getDb();
  const marketId = oid(params.id);
  // ยืนยัน market อยู่ใน scope ของ tenant ก่อน — sub-query ด้านล่าง query ด้วย market_id ล้วน
  const market = await db.collection("markets").findOne(tenantFilter(user, { _id: marketId }));
  if (!market) return httpError(404, "no_market", "ไม่พบสาขา");
  const f = tenantFilter(user, { market_id: marketId });
  const units = await db.collection("units").countDocuments(f);
  const occupied = await db.collection("units").countDocuments({ ...f, status: "occupied" });

  const devs = await db.collection("devices").find({ market_id: marketId }).toArray();
  const online = devs.filter(isOnline).length;
  const offline = devs.length - online;

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const meters = await db.collection("meters").find({ market_id: marketId }).toArray();
  let elec = 0, water = 0;
  for (const m of meters) {
    const u = await calcUsage(db, m._id, from, now);
    if (m.kind === "water") water += u;
    else elec += u;
  }
  return json({ units, occupied, vacant: units - occupied, devices: devs.length, online, offline, elec_kwh_today: elec, water_m3_today: water });
}
