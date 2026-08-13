import { crud } from "@/controllers/resource";
const c = crud("bills");
export const GET = (req) => c.list(req);
