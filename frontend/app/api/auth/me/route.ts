import { requireUser, json } from "@/lib/http";

export async function GET(req: Request) {
  const { user, error } = requireUser(req);
  if (error) return error;
  return json({ id: user.uid, role: user.role, tenant_id: user.tid });
}
