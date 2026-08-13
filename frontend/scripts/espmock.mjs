// Gateway mock (Node): จำลอง gateway ยิง telemetry เข้าระบบทาง REST
// (POST /api/ingest) ทีละมิเตอร์ — 1 UUID = มิเตอร์ 1 ตัว (ไฟ หรือ น้ำ)
// อุปกรณ์ที่ seed ผูกไว้แล้วจะส่งค่าต่อจาก last_value เดิม · อุปกรณ์ pool ก็ส่งด้วย
import { MongoClient } from "mongodb";

const uri = process.env.MONGO_URI || "mongodb://localhost:27017";
const base = process.env.INGEST_URL || "http://localhost:3001/api/ingest";
const key = process.env.INGEST_KEY || "";
const r3 = (f) => Math.round(f * 1000) / 1000;
const rnd = Math.random;

const client = new MongoClient(uri);
await client.connect();
const db = client.db(process.env.DB_NAME || "akr");

const devices = await db.collection("devices").find({ device_type: "meter_node" }).toArray();
if (!devices.length) {
  console.log("no devices — run: npm run seed");
  process.exit(1);
}
const meterIds = devices.map((d) => d.meter_id).filter(Boolean);
const meters = await db.collection("meters").find({ _id: { $in: meterIds } }).toArray();
const lastVal = Object.fromEntries(meters.map((m) => [String(m._id), m.last_value || 0]));

const nodes = devices.map((d, i) => ({
  uuid: d.uuid,
  kind: d.kind || (i % 2 ? "water" : "electric"),
  cum: d.meter_id ? lastVal[String(d.meter_id)] || 0 : rnd() * 100,
  flaky: i % 7 === 5, // บางตัวหลุดเป็นช่วง
}));
await client.close();

console.log(`mock gateway → ${base} · ${nodes.length} มิเตอร์ (ผูกแล้ว ${devices.filter((d) => d.unit_id).length} · pool ${devices.filter((d) => !d.unit_id).length})`);

async function tick() {
  const batch = [];
  for (const n of nodes) {
    if (n.flaky && rnd() < 0.4) continue;
    if (n.kind === "water") {
      const flow = rnd() < 0.15 ? 0 : rnd() * 4; // ลิตร/นาที
      n.cum += (flow * (5 / 60)) / 1000; // m3 ใน 5 วิ
      batch.push({ uuid: n.uuid, kind: "water", ts: Math.floor(Date.now() / 1000), data: { m3: r3(n.cum), flow_lpm: r3(flow) } });
    } else {
      const w = 50 + rnd() * 1200;
      n.cum += (w / 1000) * (5 / 3600); // kWh ใน 5 วิ
      batch.push({ uuid: n.uuid, kind: "electric", ts: Math.floor(Date.now() / 1000), data: { kwh: r3(n.cum), v: r3(228 + rnd() * 6 - 3), a: r3(w / 230), w: Math.round(w), pf: 0.95, hz: 50 } });
    }
  }
  try {
    const res = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json", ...(key ? { "X-Ingest-Key": key } : {}) }, body: JSON.stringify(batch) });
    if (!res.ok) console.log("ingest", res.status);
    else process.stdout.write(".");
  } catch (e) {
    console.log("ingest error:", e.message);
  }
}
setInterval(tick, 5000);
tick();
