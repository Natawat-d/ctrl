import { crud } from "@/controllers/resource";
import { requireUser } from "@/lib/http";
import { createUnit } from "@/controllers/unitController";

const c = crud("units");
export const GET = (req: Request) => c.list(req);

export async function POST(req: Request) {
  const { user, error } = requireUser(req, ["platform_admin", "owner"]);
  if (error) return error;
  const body = await req.json();
  return createUnit(user, body);
}
