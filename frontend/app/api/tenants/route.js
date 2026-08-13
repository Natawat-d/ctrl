import { getDb } from "@/lib/mongo";
import { json, requireUser } from "@/lib/http";

export async function GET(req) {
  const { error } = requireUser(req, ["platform_admin"]);
  if (error) return error;
  const db = await getDb();
  const items = await db.collection("tenants").find({}).toArray();
  return json({ items });
}

export async function POST(req) {
  const { error } = requireUser(req, ["platform_admin"]);
  if (error) return error;
  const db = await getDb();
  const doc = await req.json();
  delete doc._id;
  doc.created_at = new Date();
  doc.updated_at = new Date();
  const r = await db.collection("tenants").insertOne(doc);
  return json({ ...doc, _id: r.insertedId }, 201);
}
