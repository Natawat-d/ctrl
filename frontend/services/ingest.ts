import { getDb } from "@/lib/mongo";

// Telemetry เข้าทาง REST (POST /api/ingest) — ไม่มี MQTT broker แล้ว
// gateway/poller ยิง JSON มาทีละมิเตอร์:
//   { uuid, kind: "electric"|"water", ts?, data: { kwh,v,a,w,pf,hz } | { m3, flow_lpm } }
//
// UUID ที่ระบบไม่รู้จัก → ลงทะเบียนเข้า pool (unit_id = null) รอเจ้าของผูกในหน้า ตั้งค่า
// UUID ที่ผูกแล้ว → เขียนค่าลง readings ของมิเตอร์นั้น

const G = globalThis;
G.__akrIngest ||= { stats: { total: 0, last: null, times: [] } };
const S = G.__akrIngest;

// parseTs รองรับทุกรูปแบบที่ firmware/gateway ส่งมาจริง แล้วคืนเวลาให้ถูก:
//   number วินาที (< 2e10) → ×1000 · number มิลลิ (>= 2e10) → ตรง
//   string ตัวเลขล้วน "1785708000" → epoch (sec/ms) · string ISO "2026-08-02T10:00:00Z" → Date.parse
// กันเคส seconds ถูกอ่านเป็น ms (เพี้ยนเป็นปี 1970 แล้วโดน TTL ลบทิ้ง): ถ้าได้เวลา < ปี 2000 → ใช้ fallback
export function parseTs(raw, fallback) {
  if (raw == null || raw === "") return fallback;
  let ms: number | null = null;
  if (typeof raw === "number") {
    ms = raw < 2e10 ? raw * 1000 : raw;
  } else if (typeof raw === "string") {
    const s = raw.trim();
    if (/^\d+(\.\d+)?$/.test(s)) {
      const n = Number(s);
      ms = n < 2e10 ? n * 1000 : n;
    } else {
      ms = Date.parse(s); // NaN ถ้า parse ไม่ได้
    }
  }
  if (ms == null || Number.isNaN(ms) || ms < 9.46e11) return fallback; // 9.46e11 = 2000-01-01
  return new Date(ms);
}

export function ingestStatus() {
  const now = Date.now();
  S.stats.times = S.stats.times.filter((t) => now - t < 300000); // rolling 5 นาที
  const min1 = S.stats.times.filter((t) => now - t < 60000).length;
  return {
    transport: "rest",
    total_ingested: S.stats.total,
    last_ingest: S.stats.last,
    msgs_last_min: min1,
    msgs_last_5min: S.stats.times.length,
    rate_per_sec: +(min1 / 60).toFixed(2),
  };
}

export async function ingestTelemetry(t) {
  if (!t || !t.uuid) return { ok: false, error: "no_uuid" };
  S.stats.total++;
  S.stats.last = new Date();
  S.stats.times.push(Date.now());

  const db = await getDb();
  const now = new Date();
  const ts = parseTs(t.ts, now);
  const kind = t.kind === "water" ? "water" : t.kind === "electric" ? "electric" : null;

  let dev = await db.collection("devices").findOne({ uuid: String(t.uuid) });
  if (!dev) {
    // อุปกรณ์ใหม่ → เข้า pool รอผูก
    await db.collection("devices").insertOne({
      uuid: String(t.uuid), kind, tenant_id: null, market_id: null, unit_id: null, meter_id: null,
      device_type: "meter_node", fw_version: t.fw || 1, format_version: 1,
      status: { online: true, last_seen: now, flags: t.data?.flags || [] },
      first_seen: now, created_at: now, updated_at: now,
    });
    return { ok: true, pooled: true };
  }

  const set: Record<string, any> = { "status.online": true, "status.last_seen": now, updated_at: now };
  if (kind && !dev.kind) set.kind = kind;
  if (t.data?.flags) set["status.flags"] = t.data.flags;
  if (t.data?.w != null) set["status.watt"] = t.data.w;
  await db.collection("devices").updateOne({ _id: dev._id }, { $set: set });

  if (!dev.unit_id || !dev.meter_id) return { ok: true, pooled: true };

  const meta = { tenant_id: dev.tenant_id, market_id: dev.market_id, unit_id: dev.unit_id, meter_id: dev.meter_id, kind: dev.kind };
  const d = t.data || {};
  let doc: Record<string, any> | null = null, lastValue = 0;
  if (dev.kind === "water") {
    if (d.m3 == null) return { ok: false, error: "no_m3" };
    lastValue = Number(d.m3) || 0;
    doc = { ts, meta, v: lastValue, rate_flow: d.flow_lpm != null ? Number(d.flow_lpm) : undefined };
  } else {
    if (d.kwh == null) return { ok: false, error: "no_kwh" };
    lastValue = Number(d.kwh) || 0;
    doc = { ts, meta, v: lastValue, raw: { volt: d.v, amp: d.a, watt: d.w, pf: d.pf, hz: d.hz } };
  }
  await db.collection("readings").insertOne(doc);
  // PIPE-2: เขียน last_value ตามลำดับ ts ไม่ใช่ลำดับที่ packet มาถึง — packet มาช้า/replay
  // จะทำให้ค่าปัจจุบันบนแดชบอร์ดถอยหลัง (ไม่กระทบบิล: calcUsage อ่านจาก readings ไม่ใช่ค่านี้)
  await db.collection("meters").updateOne(
    { _id: dev.meter_id, $or: [{ last_ts: { $exists: false } }, { last_ts: null }, { last_ts: { $lt: ts } }] },
    { $set: { last_value: lastValue, last_ts: ts } }
  );
  return { ok: true };
}

// cron รายชั่วโมง: ออกบิลตามรอบ + คิดค่าปรับล่าช้า
export function startCron() {
  const tick = async () => {
    try {
      const db = await getDb();
      const { accrueLateFees, generateForMarket, prevCycle } = await import("@/controllers/billingController");
      const today = new Date().getDate();
      // รอบที่ออก = เดือนที่เพิ่งจบ (เวลาท้องถิ่น) · generateForMarket ข้ามห้องที่มีบิลรอบนี้แล้ว
      // ดังนั้น tick ซ้ำทุกชั่วโมงของวันตัดบิลจะไม่ล้างสถานะจ่ายของบิลที่ออกไปแล้ว
      const markets = await db.collection("markets").find({}).toArray();
      for (const mk of markets) {
        if ((mk.billing?.cycle_day || 1) === today) await generateForMarket(db, mk._id, prevCycle());
      }
      await accrueLateFees(db);
    } catch (e: any) {
      console.error("[cron]", e.message);
    }
  };
  setInterval(tick, 60 * 60 * 1000);
  setTimeout(tick, 8000);
}
