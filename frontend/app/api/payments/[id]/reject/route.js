import { getDb } from "@/lib/mongo";
import { oid } from "@/controllers/resource";
import { tenantFilter } from "@/lib/auth";
import { requireUser, json, httpError } from "@/lib/http";
import { recordAudit } from "@/services/audit";

export async function POST(req, { params }) {
  const { user, error } = requireUser(req, ["platform_admin", "owner"]);
  if (error) return error;
  const db = await getDb();
  const payId = oid(params.id);
  // scope ด้วย tenantFilter กัน owner คนละ tenant มา reject ข้าม tenant
  const pay = await db.collection("payments").findOne(tenantFilter(user, { _id: payId }));
  if (!pay) return httpError(404, "not_found", "ไม่พบรายการชำระ");
  await db.collection("payments").updateOne({ _id: payId }, { $set: { status: "rejected", verified_by: user.uid, verified_at: new Date() } });
  await recordAudit({ user, action: "payment.reject", target_type: "payment", target_id: params.id });
  return json({ ok: true });
}
