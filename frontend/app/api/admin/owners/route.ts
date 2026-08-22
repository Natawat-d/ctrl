import { requireUser } from "@/lib/http";
import { createOwner } from "@/controllers/adminController";

export async function POST(req: Request) {
  const { user, error } = requireUser(req, ["platform_admin"]);
  if (error) return error;
  return createOwner(req, user);
}
