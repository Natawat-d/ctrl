import { requireUser } from "@/lib/http";
import { listPool } from "@/controllers/deviceController";

export async function GET(req: Request) {
  const { user, error } = requireUser(req, ["platform_admin", "owner"]);
  if (error) return error;
  return listPool(user);
}
