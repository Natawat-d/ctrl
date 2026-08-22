import { crud } from "@/controllers/resource";
const c = crud("bills");
export const GET = (req: Request) => c.list(req);
