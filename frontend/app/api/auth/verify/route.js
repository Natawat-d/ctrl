import { verify } from "@/controllers/authController";

export const GET = (req) => verify(req);
