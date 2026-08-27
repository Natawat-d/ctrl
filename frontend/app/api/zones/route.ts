import { crud } from "@/controllers/resource";
const c = crud("zones");
export const GET = (req: Request) => c.list(req);
export const POST = (req: Request) => c.create(req);
