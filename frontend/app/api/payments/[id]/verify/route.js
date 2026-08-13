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
  const pay = await db.collection("payments").findOne(tenantFilter(user, { _id: payId }));
  if (!pay) return httpError(404, "not_found", "ไม่พบรายการชำระ");
  const now = new Date();
  await db.collection("payments").updateOne({ _id: payId }, { $set: { status: "verified", verified_by: user.uid, verified_at: now } });
  const bill = await db.collection("bills").findOne({ _id: pay.bill_id });
  if (bill) {
    await db.collection("bills").updateOne({ _id: bill._id }, { $set: { status: "paid", paid_amount: bill.total, updated_at: now } });
  }
  await recordAudit({ user, action: "payment.verify", target_type: "payment", target_id: payId, market_id: pay.market_id, detail: { amount: pay.amount, bill_id: String(pay.bill_id || "") } });
  return json({ ok: true });
}
