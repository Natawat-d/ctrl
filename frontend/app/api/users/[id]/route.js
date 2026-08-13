import { getDb } from "@/lib/mongo";
import { hashPassword, tenantFilter } from "@/lib/auth";
import { requireUser, json, httpError } from "@/lib/http";
import { oid } from "@/models";
import { recordAudit } from "@/services/audit";

// SEC-2: owner shares tenant_id with every other user, and the old lookup was a
// bare {_id}, so an owner could PATCH/DELETE ANY user in ANY tenant (incl.
// platform_admin / other owners → password reset → account takeover). We now:
//   1. scope the target with tenantFilter (owner limited to their own tenant),
//   2. forbid an owner from touching anything other than a tenant_user.
// platform_admin keeps full reach.
function guardTarget(user, target) {
  if (!target) return httpError(404, "not_found", "ไม่พบผู้ใช้");
  if (user.role === "owner" && target.role !== "tenant_user") {
    return httpError(403, "forbidden", "แก้ไข/ลบได้เฉพาะบัญชีผู้เช่า");
  }
  return null;
}

// PATCH: reset password / reassign unit.
export async function PATCH(req, { params }) {
  const { user, error } = requireUser(req, ["platform_admin", "owner"]);
  if (error) return error;
  const db = await getDb();
  const id = oid(params.id);
  const target = await db.collection("users").findOne(tenantFilter(user, { _id: id }));
  const denied = guardTarget(user, target);
  if (denied) return denied;
  const body = await req.json();
  const set = { updated_at: new Date() };
  if (body.password) { set.password_hash = hashPassword(body.password); set.password_plain = String(body.password); }
  if (body.display_name) set.display_name = body.display_name;
  await db.collection("users").updateOne(tenantFilter(user, { _id: id }), { $set: set });
  await recordAudit({ user, action: "tenant_user.update", target_type: "user", target_id: id, detail: { password_reset: !!body.password } });
  return json({ ok: true });
}

// DELETE: remove renter and unassign their locks.
export async function DELETE(req, { params }) {
  const { user, error } = requireUser(req, ["platform_admin", "owner"]);
  if (error) return error;
  const db = await getDb();
  const id = oid(params.id);
  const u = await db.collection("users").findOne(tenantFilter(user, { _id: id }));
  const denied = guardTarget(user, u);
  if (denied) return denied;
  if (Array.isArray(u.unit_ids)) {
    for (const uid of u.unit_ids) {
      await db.collection("units").updateOne({ _id: uid }, { $set: { occupant_user_id: null, updated_at: new Date() } });
    }
  }
  await db.collection("users").deleteOne(tenantFilter(user, { _id: id }));
  await recordAudit({ user, action: "tenant_user.delete", target_type: "user", target_id: id, target_label: u?.login_id });
  return json({ ok: true });
}
