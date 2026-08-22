import { forgotPassword } from "@/controllers/authController";

export const POST = (req: Request) => forgotPassword(req);
