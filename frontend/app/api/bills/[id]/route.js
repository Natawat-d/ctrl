import { crud } from "@/controllers/resource";
const c = crud("bills");
export const GET = (req, { params }) => c.get(req, params.id);
