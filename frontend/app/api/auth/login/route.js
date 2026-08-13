import { login } from "@/controllers/authController";

export const POST = (req) => login(req);
