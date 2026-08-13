import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongo";
import { hashPassword } from "@/lib/auth";
import { requireUser, json, httpError } from "@/lib/http";
import { recordAudit } from "@/services/audit";

// GET: owner lists renter (tenant_user) accounts in their tenant.
export async function GET(req) {
  const { user, error } = requireUser(req, ["platform_admin", "owner"]);
  if (error) return error;
  const db = await getDb();
  const f = { role: "tenant_user" };
  if (user.role !== "platform_admin" && user.tid) f.tenant_id = new ObjectId(user.tid);
  const users = await db.collection("users").find(f).project({ password_hash: 0 }).sort({ created_at: -1 }).toArray();
  return json({ items: users });
}

// POST: owner creates a renter account and assigns it to a lock.
export async function POST(req) {
  const { user, error } = requireUser(req, ["platform_admin", "owner"]);
  if (error) return error;
  const { login_id, password, first_name, last_name, national_id, phone, display_name, unit_id, email, line_id } = await req.json();
  if (!login_id || !password) return httpError(400, "bad_input", "ต้องมี login_id และ password");
  const db = await getDb();

  const tid = user.tid ? new ObjectId(user.tid) : null;
  const unitOid = unit_id ? new ObjectId(unit_id) : null;

  // ID ผู้เช่าต้องเป็นรูปแบบ "<ชื่อที่พัก>@xxxx" — ผูก prefix จาก slug ของที่พัก (จากห้องที่ผูก หรือ tenant) เสมอ
  let market = null;
  if (unitOid) {
    const unit = await db.collection("units").findOne({ _id: unitOid });
    if (unit) market = await db.collection("markets").findOne({ _id: unit.market_id });
  }
  if (!market && tid) market = await db.collection("markets").find({ tenant_id: tid }).sort({ market_short: 1 }).limit(1).next();
  const slug = (market?.slug || "site").toLowerCase();
  const raw = String(login_id).trim().toLowerCase();
  const local = (raw.includes("@") ? raw.slice(raw.indexOf("@") + 1) : raw).replace(/[^a-z0-9._-]/g, "") || "user";
  const finalLogin = `${slug}@${local}`;
  if (await db.collection("users").findOne({ login_id: finalLogin })) return httpError(409, "duplicate", `ไอดี ${finalLogin} มีผู้ใช้แล้ว`);
  const nid = String(national_id || "").replace(/[^0-9]/g, "");
  if (nid && nid.length !== 13) return httpError(400, "bad_nid", "เลขบัตรประชาชนต้องมี 13 หลัก");
  const fullName = [first_name, last_name].filter(Boolean).join(" ").trim();
  const doc = {
    tenant_id: tid, role: "tenant_user", login_id: finalLogin, password_hash: hashPassword(password), password_plain: String(password),
    first_name: first_name || "", last_name: last_name || "", national_id: nid || "",
    phone: String(phone || "").trim(),
    display_name: fullName || display_name || login_id, email: email || "", line_id: line_id || "", verified: true, status: "active",
    unit_ids: unitOid ? [unitOid] : [], created_at: new Date(), updated_at: new Date(),
  };
  const r = await db.collection("users").insertOne(doc);
  if (unitOid) {
    await db.collection("units").updateOne({ _id: unitOid }, { $set: { occupant_user_id: r.insertedId, status: "occupied", updated_at: new Date() } });
  }
  await recordAudit({ user, action: "tenant_user.create", target_type: "user", target_id: r.insertedId, target_label: finalLogin, detail: { unit_ids: doc.unit_ids.map(String) } });
  return json({ _id: r.insertedId, login_id: finalLogin, display_name: doc.display_name, role: "tenant_user", unit_ids: doc.unit_ids }, 201);
}
