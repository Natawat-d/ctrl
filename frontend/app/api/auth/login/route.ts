import { login } from "@/controllers/authController";

export const POST = (req: Request) => login(req);
