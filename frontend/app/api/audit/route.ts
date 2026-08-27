import { requireUser, json } from "@/lib/http";
import { listAudit, auditCsv } from "@/controllers/auditController";

export async function GET(req: Request) {
  const { user, error } = requireUser(req, ["platform_admin", "owner"]);
  if (error) return error;
  const url = new URL(req.url);
  const rows = await listAudit(user, url);
  if (url.searchParams.get("format") === "csv") {
    return new Response(auditCsv(rows), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="audit-${new Date().toISOString().slice(0, 10)}.csv"` },
    });
  }
  return json({ items: rows });
}
