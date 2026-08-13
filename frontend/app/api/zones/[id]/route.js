import { crud } from "@/controllers/resource";
const c = crud("zones");
export const GET = (req, { params }) => c.get(req, params.id);
export const PATCH = (req, { params }) => c.update(req, params.id);
export const DELETE = (req, { params }) => c.del(req, params.id);
