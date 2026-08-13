import { getDb } from "@/lib/mongo";
import { oid } from "@/controllers/resource";
import { tenantFilter } from "@/lib/auth";
import { requireUser, json, httpError, type IdCtx } from "@/lib/http";
import { recordAudit } from "@/services/audit";
import { applyPayment } from "@/controllers/billingController";

export async function POST(req: Request, { params }: IdCtx) {
  const { user, error } = requireUser(req, ["platform_admin", "owner"]);
  if (error) return error;
  const db = await getDb();
  const payId = oid(params.id);
  const pay = await db.collection("payments").findOne(tenantFilter(user, { _id: payId }));
  if (!pay) return httpError(404, "not_found", "ไม่พบรายการชำระ");
  // BILL-2: verify ต้อง idempotent — ยิงซ้ำเดิมจะบวก amount เข้าบิลซ้ำ
  if (pay.status === "verified") return httpError(409, "already_verified", "รายการนี้ยืนยันแล้ว");
  const now = new Date();
  await db.collection("payments").updateOne({ _id: payId! }, { $set: { status: "verified", verified_by: user.uid, verified_at: now } });
  const bill = await db.collection("bills").findOne({ _id: pay.bill_id });
  if (bill) {
    // BILL-2: เดิม set paid_amount = total เสมอ → จ่ายบางส่วนกลายเป็นจ่ายครบ เงินส่วนต่างหายเงียบ
    const { paid_amount, status } = applyPayment(bill, pay.amount);
    await db.collection("bills").updateOne({ _id: bill._id }, { $set: { status, paid_amount, updated_at: now } });
  }
  await recordAudit({ user, action: "payment.verify", target_type: "payment", target_id: payId, market_id: pay.market_id, detail: { amount: pay.amount, bill_id: String(pay.bill_id || "") } });
  return json({ ok: true });
}
