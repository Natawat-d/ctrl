import { requireUser, type IdCtx } from "@/lib/http";
import { crud } from "@/controllers/resource";
import { updateDeviceKind, removeDevice } from "@/controllers/deviceController";

const c = crud("devices");
export const GET = (req: Request, { params }: IdCtx) => c.get(req, params.id);

export async function PATCH(req: Request, { params }: IdCtx) {
  const { user, error } = requireUser(req, ["platform_admin", "owner"]);
  if (error) return error;
  const { kind } = await req.json();
  return updateDeviceKind(user, params.id, kind);
}

export async function DELETE(req: Request, { params }: IdCtx) {
  const { user, error } = requireUser(req, ["platform_admin", "owner"]);
  if (error) return error;
  return removeDevice(user, params.id);
}
