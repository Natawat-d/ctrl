import type { IdCtx } from "@/lib/http";
import { crud } from "@/controllers/resource";
const c = crud("meters");
export const GET = (req: Request, { params }: IdCtx) => c.get(req, params.id);
export const PATCH = (req: Request, { params }: IdCtx) => c.update(req, params.id);
export const DELETE = (req: Request, { params }: IdCtx) => c.del(req, params.id);
