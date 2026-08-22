import { requireUser, type IdCtx } from "@/lib/http";
import { patchOwner } from "@/controllers/adminController";

export async function PATCH(req: Request, { params }: IdCtx) {
  const { user, error } = requireUser(req, ["platform_admin"]);
  if (error) return error;
  return patchOwner(req, params.id, user);
}
