import { resetPassword } from "@/controllers/authController";

export const POST = (req) => resetPassword(req);
