import { signup } from "@/controllers/authController";

export const POST = (req: Request) => signup(req);
