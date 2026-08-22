import { requireUser } from "@/lib/http";
import { overview } from "@/controllers/adminController";

export async function GET(req: Request) {
  const { error } = requireUser(req, ["platform_admin"]);
  if (error) return error;
  return overview();
}
