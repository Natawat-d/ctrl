import { crud } from "@/controllers/resource";
const c = crud("zones");
export const GET = (req) => c.list(req);
export const POST = (req) => c.create(req);
