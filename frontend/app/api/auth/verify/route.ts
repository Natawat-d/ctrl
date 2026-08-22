import { verify } from "@/controllers/authController";

export const GET = (req: Request) => verify(req);
