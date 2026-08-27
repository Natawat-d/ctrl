import { requireUser, type IdCtx } from "@/lib/http";
import { statusForUnit, assignToUnit, unassignUnit } from "@/controllers/deviceController";

export async function GET(req: Request, { params }: IdCtx) {
  const { user, error } = requireUser(req);
  if (error) return error;
  return statusForUnit(user, params.id);
}

export async function POST(req: Request, { params }: IdCtx) {
  const { user, error } = requireUser(req, ["platform_admin", "owner"]);
  if (error) return error;
  const body = await req.json();
  return assignToUnit(user, params.id, body);
}

export async function DELETE(req: Request, { params }: IdCtx) {
  const { user, error } = requireUser(req, ["platform_admin", "owner"]);
  if (error) return error;
  const kind = new URL(req.url).searchParams.get("kind");
  return unassignUnit(user, params.id, kind);
}
