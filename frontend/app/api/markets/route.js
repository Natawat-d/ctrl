import { crud } from "@/controllers/resource";
import { requireUser } from "@/lib/http";
import { createSite } from "@/controllers/siteController";

const c = crud("markets");
export const GET = (req) => c.list(req);

export async function POST(req) {
  const { user, error } = requireUser(req, ["platform_admin", "owner"]);
  if (error) return error;
  const body = await req.json();
  return createSite(user, body);
}
