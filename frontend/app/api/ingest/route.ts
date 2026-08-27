import { ingestTelemetry } from "@/services/ingest";

// POST /api/ingest — gateway/poller ยิง telemetry ทีละมิเตอร์ (หรือ array)
// header: X-Ingest-Key ต้องตรงกับ env INGEST_KEY (ถ้าตั้งไว้)
export async function POST(req: Request) {
  const need = process.env.INGEST_KEY;
  // SEC-4: fail-closed — production ที่ไม่ตั้ง INGEST_KEY ให้ปฏิเสธทั้งหมด (กันปลอม telemetry ปั่นบิล)
  if (!need) {
    if (process.env.NODE_ENV === "production") {
      return Response.json({ error: { code: "ingest_not_configured", message: "ingest key not configured" } }, { status: 503 });
    }
    // non-production ไม่มี key = เปิดไว้ให้ dev/demo
  } else if (req.headers.get("x-ingest-key") !== need) {
    return Response.json({ error: { code: "bad_key", message: "invalid ingest key" } }, { status: 401 });
  }
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: { code: "bad_json", message: "invalid JSON" } }, { status: 400 });
  }
  const items = Array.isArray(body) ? body : [body];
  const results: any[] = [];
  for (const t of items) results.push(await ingestTelemetry(t));
  return Response.json(Array.isArray(body) ? { results } : results[0]);
}
