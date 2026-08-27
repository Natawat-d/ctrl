import { requireUser, json } from "@/lib/http";
import { buildReport, reportCsv } from "@/controllers/reportController";

export async function GET(req: Request) {
  const { user, error } = requireUser(req, ["platform_admin", "owner"]);
  if (error) return error;
  const url = new URL(req.url);
  const marketId = url.searchParams.get("market_id");
  const cycle = url.searchParams.get("cycle");
  const { data, error: e2 } = await buildReport(user, marketId, cycle);
  if (e2) return e2;
  if (url.searchParams.get("format") === "csv") {
    return new Response(reportCsv(data), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="report-${data.cycle}.csv"` },
    });
  }
  return json(data);
}
