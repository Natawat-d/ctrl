import { resetPassword } from "@/controllers/authController";

export const POST = (req: Request) => resetPassword(req);
