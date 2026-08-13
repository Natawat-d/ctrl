import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongo";
import { requireUser, json } from "@/lib/http";

// GET: owner lists payments (optionally by status) to verify.
export async function GET(req) {
  const { user, error } = requireUser(req, ["platform_admin", "owner"]);
  if (error) return error;
  const db = await getDb();
  const f = {};
  if (user.role !== "platform_admin" && user.tid) f.tenant_id = new ObjectId(user.tid);
  const status = new URL(req.url).searchParams.get("status");
  if (status) f.status = status;
  const items = await db.collection("payments").find(f).sort({ created_at: -1 }).toArray();
  return json({ items });
}
