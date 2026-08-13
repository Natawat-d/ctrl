// Runs once when the Next.js server boots — starts the billing cron.
// Telemetry now arrives via REST (POST /api/ingest); no MQTT broker.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startCron } = await import("./services/ingest");
    startCron();
    console.log("[instrumentation] billing cron started (ingest = REST)");
  }
}
