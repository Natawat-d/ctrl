import { getDb } from "@/lib/mongo";
import { oid } from "@/controllers/resource";
import { tenantFilter } from "@/lib/auth";
import { requireUser, json, httpError, type IdCtx } from "@/lib/http";

export async function POST(req: Request, { params }: IdCtx) {
  const { user, error } = requireUser(req);
  if (error) return error;
  const { amount, slip_image_url } = await req.json();
  const db = await getDb();
  const billId = oid(params.id);

  // BILL-3 / M4: ownership check — tenant_user จ่ายได้เฉพาะบิลของล็อกที่ตนครอบครอง
  // owner/platform_admin ทำได้ภายใน tenant ของตน (scope ด้วย tenantFilter)
  let bill;
  if (user.role === "tenant_user") {
    bill = await db.collection("bills").findOne({ _id: billId! });
    if (!bill) return httpError(404, "not_found", "ไม่พบบิล");
    const myUnits = await db.collection("units").find({ occupant_user_id: oid(user.uid) }).toArray();
    const owns = myUnits.some((u) => String(u._id) === String(bill.unit_id));
    if (!owns) return httpError(403, "forbidden", "ไม่ใช่บิลของล็อกคุณ");
  } else {
    bill = await db.collection("bills").findOne(tenantFilter(user, { _id: billId }));
    if (!bill) return httpError(404, "not_found", "ไม่พบบิล");
  }

  // ห้ามแนบสลิปกับบิลที่ปิดยอดแล้ว
  if (bill.status === "paid") return httpError(409, "already_paid", "บิลนี้ชำระครบแล้ว");

  // validate amount: ต้องเป็นตัวเลข finite > 0, cap ที่ยอดคงค้าง
  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0) {
    return httpError(400, "bad_amount", "จำนวนเงินต้องเป็นตัวเลขมากกว่า 0");
  }
  const outstanding = Number(bill.total || 0) - Number(bill.paid_amount || 0);
  const amt = Math.min(num, outstanding);

  const doc = {
    tenant_id: bill.tenant_id, market_id: bill.market_id, unit_id: bill.unit_id,
    bill_id: billId, user_id: user.uid, amount: amt, slip_image_url,
    status: "submitted", created_at: new Date(), updated_at: new Date(),
  };
  const r = await db.collection("payments").insertOne(doc);
  return json({ ...doc, _id: r.insertedId }, 201);
}
