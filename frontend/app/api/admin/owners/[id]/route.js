import { requireUser } from "@/lib/http";
import { patchOwner } from "@/controllers/adminController";

export async function PATCH(req, { params }) {
  const { user, error } = requireUser(req, ["platform_admin"]);
  if (error) return error;
  return patchOwner(req, params.id, user);
}
