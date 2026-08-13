import type { IdCtx } from "@/lib/http";
import { crud } from "@/controllers/resource";
const c = crud("bills");
export const GET = (req: Request, { params }: IdCtx) => c.get(req, params.id);
