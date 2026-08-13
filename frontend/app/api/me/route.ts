import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongo";
import { requireUser, json } from "@/lib/http";

// GET: the logged-in renter's own locks + bills.
export async function GET(req: Request) {
  const { user, error } = requireUser(req);
  if (error) return error;
  const db = await getDb();
  let uid;
  try {
    uid = new ObjectId(user.uid);
  } catch {
    return json({ units: [], bills: [] });
  }
  const units = await db.collection("units").find({ occupant_user_id: uid }).toArray();
  const unitIds = units.map((u) => u._id);
  // a bill belongs to a unit — the occupant sees all bills for units they hold
  const bills = unitIds.length
    ? await db.collection("bills").find({ unit_id: { $in: unitIds } }).sort({ issued_at: -1 }).toArray()
    : [];
  // attach latest payment status per bill so the UI can show "รอตรวจสอบ" etc.
  const billIds = bills.map((b) => b._id);
  const pays = billIds.length ? await db.collection("payments").find({ bill_id: { $in: billIds } }).sort({ created_at: 1 }).toArray() : [];
  const payByBill = {};
  for (const p of pays) payByBill[String(p.bill_id)] = { status: p.status, at: p.created_at, slip: p.slip_image_url || "" };
  const billsOut = bills.map((b) => ({ ...b, payment: payByBill[String(b._id)] || null }));
  return json({ units, bills: billsOut });
}
