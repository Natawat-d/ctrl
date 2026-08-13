import { requireUser } from "@/lib/http";
import { crud } from "@/controllers/resource";
import { registerDevice } from "@/controllers/deviceController";

const c = crud("devices");
export const GET = (req) => c.list(req);

export async function POST(req) {
  const { user, error } = requireUser(req, ["platform_admin", "owner"]);
  if (error) return error;
  const body = await req.json();
  return registerDevice(user, body);
}
