// seed — CTRL: หอพัก/คอนโด (monitor + billing เท่านั้น ไม่มีตัดน้ำ-ไฟ)
import { MongoClient, ObjectId } from "mongodb";
import bcrypt from "bcryptjs";

const uri = process.env.MONGO_URI || "mongodb://localhost:27017";
const dbName = process.env.DB_NAME || "akr";
const hash = (p) => bcrypt.hashSync(p, 10);

const client = new MongoClient(uri);
await client.connect();
const db = client.db(dbName);

await db.collection("users").createIndex({ login_id: 1 }, { unique: true }).catch(() => {});
await db.collection("markets").createIndex({ slug: 1 }, { unique: true, sparse: true }).catch(() => {});
await db.collection("devices").createIndex({ uuid: 1 }, { unique: true, sparse: true }).catch(() => {});
// กันบิลซ้ำรอบเดียวกัน: generateForMarket ใช้ findOne→upsert ซึ่งไม่ atomic
// cron ชนกับกดออกบิลเองพร้อมกันอาจ insert สองใบ — unique index กันที่ชั้น DB
await db.collection("bills").createIndex({ unit_id: 1, cycle: 1 }, { unique: true }).catch(() => {});

const existingTS = await db.listCollections({ name: "readings" }).toArray();
if (existingTS.length === 0) {
  await db.createCollection("readings", { timeseries: { timeField: "ts", metaField: "meta", granularity: "minutes" }, expireAfterSeconds: 7776000 }).catch((e) => console.log("readings TS:", e.message));
}

const now = new Date();
await db.collection("users").updateOne(
  { login_id: "admin" },
  { $setOnInsert: { role: "platform_admin", login_id: "admin", password_hash: hash("admin1234"), display_name: "Platform Admin", email: "admin@ctrl.local", verified: true, status: "active", created_at: now, updated_at: now } },
  { upsert: true }
);

const NODES = []; // {unitId, marketId, eM, wM, rent, common, code}
let short = 10;
async function makeRoom({ tenantId, marketId, zoneId, code, name, floor, rent, common }) {
  const unitId = new ObjectId(), eM = new ObjectId(), wM = new ObjectId();
  await db.collection("meters").insertMany([
    { _id: eM, tenant_id: tenantId, market_id: marketId, unit_id: unitId, kind: "electric", phase: 1, unit_of_measure: "kWh", last_value: 0, created_at: now, updated_at: now },
    { _id: wM, tenant_id: tenantId, market_id: marketId, unit_id: unitId, kind: "water", unit_of_measure: "m3", last_value: 0, created_at: now, updated_at: now },
  ]);
  await db.collection("units").insertOne({
    _id: unitId, tenant_id: tenantId, market_id: marketId, zone_id: zoneId, type: "condo_room", code, name,
    floor: floor ?? null, rent, common_fee: common || 0,
    meters: [{ meter_id: eM, kind: "electric" }, { meter_id: wM, kind: "water" }],
    status: "occupied", created_at: now, updated_at: now,
  });
  await db.collection("devices").insertMany([
    { tenant_id: tenantId, market_id: marketId, uuid: new ObjectId().toString(), short_id: short++,
      device_type: "meter_node", kind: "electric", fw_version: 1, format_version: 1, unit_id: unitId, meter_id: eM,
      status: { online: false }, first_seen: now, created_at: now, updated_at: now },
    { tenant_id: tenantId, market_id: marketId, uuid: new ObjectId().toString(), short_id: short++,
      device_type: "meter_node", kind: "water", fw_version: 1, format_version: 1, unit_id: unitId, meter_id: wM,
      status: { online: false }, first_seen: now, created_at: now, updated_at: now },
  ]);
  NODES.push({ unitId, marketId, eM, wM, rent, common: common || 0, code });
  return unitId;
}

// ---- โปรไฟล์การใช้งานราย ชม. (ที่พักอาศัย) ----
const R = (a, b) => a + Math.random() * (b - a);
const jit = () => 0.85 + Math.random() * 0.3;
const rd = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const RESIDENTIAL = [
  { name: "เปิดแอร์กลางคืน", elecW: (h) => (h >= 19 || h <= 6 ? R(700, 1600) : h >= 7 && h <= 9 ? R(400, 900) : R(120, 350)), waterLpm: (h) => ((h >= 6 && h <= 8) || (h >= 18 && h <= 22) ? R(1, 4) : 0.04) },
  { name: "อยู่ห้องทั้งวัน", elecW: (h) => (h >= 0 && h <= 5 ? R(150, 300) : R(350, 800)), waterLpm: () => R(0.3, 2.5) },
  { name: "ออกไปทำงาน", elecW: (h) => (h >= 18 && h <= 23 ? R(600, 1300) : h >= 6 && h <= 8 ? R(400, 800) : R(60, 160)), waterLpm: (h) => ((h >= 6 && h <= 8) || (h >= 19 && h <= 22) ? R(1.5, 4) : 0.03) },
  { name: "ใช้น้อย", elecW: (h) => (h >= 18 && h <= 23 ? R(200, 450) : R(40, 120)), waterLpm: (h) => (h >= 18 && h <= 22 ? R(0.5, 2) : 0.03) },
];
const LEAK = { name: "น้ำรั่ว (ผิดปกติ)", elecW: (h) => (h >= 18 && h <= 23 ? R(300, 600) : R(60, 150)), waterLpm: () => R(5, 9) };

const exists = await db.collection("markets").findOne({ slug: "arkara" });
if (!exists) {
  const tenantId = new ObjectId();
  await db.collection("tenants").insertOne({ _id: tenantId, name: "Arkara Property", plan: "demo", status: "active", created_at: now, updated_at: now });
  const ownerId = new ObjectId();
  await db.collection("users").insertOne({ _id: ownerId, tenant_id: tenantId, role: "owner", login_id: "arkara@owner", password_hash: hash("owner1234"), display_name: "เจ้าของอาคาร", email: "owner@ctrl.local", verified: true, status: "active", created_at: now, updated_at: now });

  const marketId = new ObjectId();
  await db.collection("markets").insertOne({
    _id: marketId, tenant_id: tenantId, name: "หอพักอารการ่า", type: "condo", slug: "arkara", timezone: "Asia/Bangkok", market_short: 1,
    rate: { elec_per_kwh: 7, water_per_m3: 20, service_fee: 0, elec_cost_per_kwh: 4.2, water_cost_per_m3: 12 },
    billing: { cycle_day: 1, due_days: 7, grace_days: 5, late_fee_per_day: 50, late_fee_type: "fixed" },
    created_at: now, updated_at: now,
  });
  const RATE = { elec: 7, water: 20, service: 0 };

  // ---- 2 ตึก × 2 ชั้น × 5 ห้อง = 20 ห้อง · ผู้เช่ามีบัญชีครบทุกห้อง ----
  const TENANT_NAMES = [
    "สมชาย ใจดี", "สุดารัตน์ แก้วมณี", "อนุชา พรมมา", "วิภาดา ศรีสุข", "ณัฐพล บุญมาก",
    "พรทิพย์ วงศ์สว่าง", "ธนกร เพชรรัตน์", "กมลชนก อินทร์อ่อน", "ศุภกิจ ทองคำ", "จิราพร นาคน้อย",
    "ปิยะพงษ์ สายทอง", "อรทัย คำแสน", "เอกชัย มั่นคง", "นารีรัตน์ จันทร์เพ็ญ", "วีระยุทธ ป้อมทอง",
    "ชลธิชา บัวขาว", "กิตติศักดิ์ แสนสุข", "มณีรัตน์ พูลสวัสดิ์", "สราวุฒิ หาญกล้า", "เบญจวรรณ รุ่งเรือง",
  ];
  const CREDS = [];
  // เลขบัตรประชาชน mock 13 หลัก checksum ถูกต้องตามสูตร mod 11
  const makeNid = (i) => {
    const base = ("1103700" + String(200000 + i * 3571)).slice(0, 12).split("").map(Number);
    const sum = base.reduce((acc, d, idx) => acc + d * (13 - idx), 0);
    const check = (11 - (sum % 11)) % 10;
    return base.join("") + check;
  };
  let ti = 0;
  const buildings = [
    { _id: new ObjectId(), tenant_id: tenantId, market_id: marketId, name: "อาคาร A", order: 1, kind: "building", created_at: now, updated_at: now },
    { _id: new ObjectId(), tenant_id: tenantId, market_id: marketId, name: "อาคาร B", order: 2, kind: "building", created_at: now, updated_at: now },
  ];
  await db.collection("zones").insertMany(buildings);
  for (const [bi, bz] of buildings.entries()) {
    const prefix = bi === 0 ? "A" : "B";
    for (let fl = 1; fl <= 2; fl++)
      for (let r = 1; r <= 5; r++) {
        const code = prefix + "-" + fl + String(r).padStart(2, "0");
        // ค่าเช่าละเอียด: ตึก A ถูกกว่า B เล็กน้อย · ชั้น 2 ถูกกว่าชั้น 1 · ห้องมุม (x05) แพงขึ้น
        const rent = 4200 + (bi === 1 ? 300 : 0) + (fl === 1 ? 300 : 0) + (r === 5 ? 500 : 0);
        const common = bi === 1 ? 600 : 500;
        const uid = await makeRoom({ tenantId, marketId, zoneId: bz._id, code, name: "ห้อง " + code, floor: fl, rent, common });
        const login = "arkara@" + code.toLowerCase();
        const pass = "pass" + code.replace("-", "").toLowerCase(); // เช่น passa101
        const tuId = new ObjectId();
        const fullName = TENANT_NAMES[ti % TENANT_NAMES.length];
        const [firstName, lastName] = fullName.split(" ");
        const phone = "08" + String(10000000 + ti * 137137).slice(0, 8);
        const email = code.toLowerCase().replace("-", "") + "@ctrl.local";
        const nid = makeNid(ti);
        await db.collection("users").insertOne({
          _id: tuId, tenant_id: tenantId, role: "tenant_user", login_id: login, password_hash: hash(pass),
          first_name: firstName, last_name: lastName || "", national_id: nid, phone,
          display_name: fullName, email, verified: true, status: "active",
          unit_ids: [uid], created_at: now, updated_at: now,
        });
        await db.collection("units").updateOne({ _id: uid }, { $set: { occupant_user_id: tuId } });
        CREDS.push({ code, login, pass, name: fullName, nid, phone, rent, common });
        ti++;
      }
  }
  // บัญชีเดโมหน้า login ใช้ arkara@a-101 → ตั้งรหัส test1234 ทับ (ตัวอื่นใช้ passXxxx)
  await db.collection("users").updateOne({ login_id: "arkara@a-101" }, { $set: { password_hash: hash("test1234")} });
  CREDS[0].pass = "test1234";

  // อุปกรณ์ใหม่จาก gateway ที่ยังไม่ถูกผูก (โชว์หน้า "รอผูก")
  await db.collection("devices").insertMany([
    { tenant_id: null, market_id: null, unit_id: null, meter_id: null, uuid: new ObjectId().toString(),
      device_type: "meter_node", kind: "electric", fw_version: 1, format_version: 1,
      status: { online: true, last_seen: now }, first_seen: now, created_at: now, updated_at: now },
    { tenant_id: null, market_id: null, unit_id: null, meter_id: null, uuid: new ObjectId().toString(),
      device_type: "meter_node", kind: "water", fw_version: 1, format_version: 1,
      status: { online: true, last_seen: now }, first_seen: now, created_at: now, updated_at: now },
  ]);

  await generateHistory({ tenantId, ownerId, marketId, RATE });
  console.log("seeded: หอพักอารการ่า · 20 ห้อง (2 ตึก) · ผู้เช่า 20 บัญชี · readings 30 วัน · บิล ก.พ.–มิ.ย. (จ่ายแล้ว) + รอบ ก.ค. ออกวันที่ 1 ส.ค. (สถานะคละ)");
  console.log("");
  console.log("ห้อง   | login          | password  | ผู้เช่า                | บัตรประชาชน   | เบอร์โทร   | เช่า+ส่วนกลาง");
  console.log("-------+----------------+-----------+------------------------+---------------+------------+-------------");
  for (const c of CREDS)
    console.log(`${c.code.padEnd(6)} | ${c.login.padEnd(14)} | ${c.pass.padEnd(9)} | ${c.name.padEnd(20)} | ${c.nid} | ${c.phone} | ${c.rent}+${c.common}`);
}

console.log("\n---- สร้างที่พักหลากหลาย + ลูกค้าจำนวนมาก ----");
const bulk = await generateBulkProperties(db, now);
console.log(`\nseed complete — admin/admin1234 · arkara@owner/owner1234 · arkara@a-101/test1234`);
console.log(`ที่พักทั้งหมด ${1 + bulk.props} แห่ง · ลูกค้ารวมทั้งระบบ ${20 + bulk.tenants} คน`);
console.log(`เจ้าของทุกที่พัก login = "<slug>@owner" / owner1234 · ผู้เช่า "<slug>@<ห้อง>" / pass<ห้อง> · ดูรวมทั้งหมดที่ admin/admin1234`);
await client.close();

// สลิปโอนเงิน mock (SVG data URL) — ให้ผู้เช่า/เจ้าของกดดูสลิปย้อนหลังได้
function slipSvg(amount, paidAt, room) {
  const d = new Date(paidAt);
  const dateStr = d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
  const timeStr = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") + " น.";
  const ref = "2026" + String(Math.floor(Math.random() * 1e10)).padStart(10, "0");
  const amt = Number(amount).toLocaleString("th-TH", { minimumFractionDigits: 2 });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="440" font-family="Segoe UI, sans-serif">
<rect width="360" height="440" fill="#ffffff"/>
<rect width="360" height="64" fill="#1a4d8f"/>
<text x="20" y="40" fill="#fff" font-size="17" font-weight="bold">DEMO BANK · โอนเงิน</text>
<circle cx="180" cy="112" r="26" fill="#e8f6ec" stroke="#2e9e57" stroke-width="2"/>
<path d="M168 112 l8 8 l16 -17" stroke="#2e9e57" stroke-width="4" fill="none" stroke-linecap="round"/>
<text x="180" y="168" text-anchor="middle" font-size="16" font-weight="bold" fill="#222">โอนเงินสำเร็จ</text>
<text x="180" y="190" text-anchor="middle" font-size="12" fill="#777">${dateStr} · ${timeStr}</text>
<text x="180" y="234" text-anchor="middle" font-size="28" font-weight="bold" fill="#111">฿${amt}</text>
<line x1="24" y1="258" x2="336" y2="258" stroke="#e5e5e5"/>
<text x="24" y="286" font-size="11" fill="#999">จาก</text>
<text x="336" y="286" font-size="12.5" fill="#222" text-anchor="end" font-weight="bold">ผู้เช่าห้อง ${room} · xxx-x-x2851-x</text>
<text x="24" y="314" font-size="11" fill="#999">ไปยัง</text>
<text x="336" y="314" font-size="12.5" fill="#222" text-anchor="end" font-weight="bold">อารการ่า พร็อพเพอร์ตี้ · xxx-x-x7730-x</text>
<text x="24" y="342" font-size="11" fill="#999">ค่าธรรมเนียม</text>
<text x="336" y="342" font-size="12.5" fill="#222" text-anchor="end">0.00 บาท</text>
<line x1="24" y1="362" x2="336" y2="362" stroke="#e5e5e5"/>
<text x="24" y="388" font-size="10.5" fill="#999">เลขที่รายการ ${ref}</text>
<rect x="288" y="374" width="48" height="48" fill="#f2f2f2"/>
<text x="312" y="402" text-anchor="middle" font-size="8" fill="#bbb">QR</text>
</svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

async function generateHistory({ tenantId, ownerId, marketId, RATE }) {
  const STEP = 15 * 60 * 1000;
  const start = new Date(now.getTime() - 30 * 864e5);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  let ri = 0;

  for (const n of NODES) {
    // ห้องหนึ่งมีน้ำรั่วไว้ทดสอบกราฟผิดปกติ
    const prof = n.code === "A-204" || n.code === "B-105" ? LEAK : RESIDENTIAL[ri++ % RESIDENTIAL.length];
    let elecCum = R(30, 400), waterCum = R(3, 40);
    let mElec = 0, mWater = 0;
    // เก็บค่าสะสม ณ ขอบเดือนก่อนหน้า (ก.ค.) เพื่อให้บิลรอบล่าสุดตรงกับที่ calcUsage คำนวณจาก readings เป๊ะ
    let jE0 = null, jW0 = null, jE1 = 0, jW1 = 0;
    const emeta = { tenant_id: tenantId, market_id: n.marketId, meter_id: n.eM, kind: "electric" };
    const wmeta = { tenant_id: tenantId, market_id: n.marketId, meter_id: n.wM, kind: "water" };
    let batch = [];
    for (let t = start.getTime(); t <= now.getTime(); t += STEP) {
      const d = new Date(t), h = d.getHours(), weekend = d.getDay() === 0 || d.getDay() === 6;
      const f = (weekend ? 1.08 : 1) * jit();
      const watt = Math.max(5, prof.elecW(h) * f);
      const lpm = Math.max(0, prof.waterLpm(h) * jit());
      const dK = (watt / 1000) * 0.25;
      const dM = (lpm * 15) / 1000;
      elecCum += dK; waterCum += dM;
      if (t >= monthStart.getTime()) { mElec += dK; mWater += dM; }
      else { if (jE0 === null) { jE0 = elecCum; jW0 = waterCum; } jE1 = elecCum; jW1 = waterCum; }
      batch.push({ ts: d, meta: emeta, v: rd(elecCum, 3), raw: { volt: rd(228 + R(-3, 3), 1), amp: rd(watt / 230, 3), watt: rd(watt, 1), pf: 0.95, hz: 50 } });
      batch.push({ ts: d, meta: wmeta, v: rd(waterCum, 4), rate_flow: rd(lpm, 2) });
      if (batch.length >= 4000) { await db.collection("readings").insertMany(batch); batch = []; }
    }
    if (batch.length) await db.collection("readings").insertMany(batch);
    await db.collection("meters").updateOne({ _id: n.eM }, { $set: { last_value: rd(elecCum, 3), last_ts: now } });
    await db.collection("meters").updateOne({ _id: n.wM }, { $set: { last_value: rd(waterCum, 4), last_ts: now } });
    await db.collection("devices").updateOne({ unit_id: n.unitId, kind: "electric" }, { $set: { "status.online": false, "status.last_seen": now, "status.flags": [] } });
    await db.collection("devices").updateOne({ unit_id: n.unitId, kind: "water" }, { $set: { "status.online": false, "status.last_seen": now, "status.flags": prof === LEAK ? ["leak"] : [] } });
    n._mElec = rd(mElec, 2); n._mWater = rd(mWater, 3);
    n._jElec = rd(jE1 - (jE0 ?? jE1), 2); n._jWater = rd(jW1 - (jW0 ?? jW1), 3);
    console.log(`  ${n.code} <- ${prof.name}: เดือนนี้ ไฟ ${n._mElec} kWh · น้ำ ${n._mWater} m3 | เดือนก่อน (ตามมิเตอร์) ไฟ ${n._jElec} · น้ำ ${n._jWater}`);
  }

  // ---- ประวัติบิลย้อนหลัง (ก.พ.–มิ.ย. ชำระแล้วเกือบหมด · บางเดือนจ่ายช้าโดนค่าปรับ) ----
  // รอบล่าสุด (เดือนที่เพิ่งจบ = ก.ค.) แยกไปออกด้านล่างด้วยหน่วยจริงจาก readings
  const HIST_MONTHS = 6;
  // ตัวคูณตามฤดู (ร้อน เม.ย.-พ.ค. ใช้ไฟเยอะ)
  const season = (m) => [1.0, 1.02, 1.12, 1.25, 1.22, 1.1, 1.02, 1.0, 0.97, 0.95, 0.9, 0.92][m];
  for (let back = HIST_MONTHS; back >= 2; back--) {
    const mStart = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const mEnd = new Date(now.getFullYear(), now.getMonth() - back + 1, 1);
    const hCycle = `${mStart.getFullYear()}-${String(mStart.getMonth() + 1).padStart(2, "0")}`;
    for (const [k, n] of NODES.entries()) {
      // ใช้ค่าจริงเดือนปัจจุบันเป็นฐาน แล้วแกว่งตามฤดู + สุ่มรายเดือน
      const eUse = rd(Math.max(20, n._mElec) * season(mStart.getMonth()) * R(0.82, 1.22), 2);
      const wUse = rd(Math.max(2, n._mWater) * R(0.8, 1.25), 3);
      const eAmt = rd(eUse * RATE.elec), wAmt = rd(wUse * RATE.water);
      const lines = [
        { type: "electric", usage: eUse, rate: RATE.elec, amount: eAmt },
        { type: "water", usage: wUse, rate: RATE.water, amount: wAmt },
        { type: "rent", amount: n.rent },
      ];
      let subtotal = eAmt + wAmt + n.rent;
      if (n.common > 0) { lines.push({ type: "common", amount: n.common }); subtotal += n.common; }
      subtotal = rd(subtotal);
      const issued_at = new Date(mStart.getTime() + 0 * 864e5 + 9 * 36e5); // วันที่ 1 เวลา 09:00
      const due_at = new Date(issued_at.getTime() + 7 * 864e5);
      const grace_until = new Date(due_at.getTime() + 5 * 864e5);
      // ~85% จ่ายตรงเวลา · ~10% จ่ายช้าโดนค่าปรับ · เดือนล่าสุดมี 1-2 ห้องค้างจ่ายข้ามเดือน
      const roll = (k * 7 + back * 13) % 20;
      let status = "paid", late = 0, paidAt = new Date(due_at.getTime() - R(1, 5) * 864e5);
      if (roll === 3 || roll === 11) {
        const daysLate = Math.ceil(R(1, 4));
        late = rd(50 * daysLate);
        paidAt = new Date(due_at.getTime() + daysLate * 864e5);
      } else if (back === 2 && n.code === "A-204") {
        // ค้างจ่ายข้ามเดือน — ค่าปรับทบรายวันตามสูตรเดียวกับ accrueLateFees (50 บาท/วัน นับจากวันครบกำหนด)
        status = "overdue"; late = rd(50 * Math.floor((now - due_at) / 864e5));
      }
      const total = rd(subtotal + late);
      const paid_amount = status === "paid" ? total : 0;
      const bill = await db.collection("bills").insertOne({
        tenant_id: tenantId, market_id: n.marketId, unit_id: n.unitId, occupant_user_id: null,
        cycle: hCycle, period: { from: mStart, to: mEnd }, issued_at, due_at, grace_until,
        lines, subtotal, late_fee: late, total, status, paid_amount, created_at: issued_at, updated_at: paidAt,
      });
      if (paid_amount > 0) {
        await db.collection("payments").insertOne({
          tenant_id: tenantId, market_id: n.marketId, unit_id: n.unitId, bill_id: bill.insertedId,
          amount: paid_amount, method: "transfer", status: "verified", slip_image_url: slipSvg(paid_amount, paidAt, n.code),
          verified_at: paidAt, created_at: paidAt, updated_at: paidAt,
        });
      }
    }
    await db.collection("audit_logs").insertOne({
      at: new Date(mStart.getTime() + 9 * 36e5), tenant_id: tenantId, actor_id: String(ownerId), actor_login: "arkara@owner",
      actor_role: "owner", action: "bill.generate", target_type: "market", target_id: String(marketId), market_id: marketId,
      detail: { cycle: hCycle, generated: NODES.length },
    });
  }

  // ---- รอบล่าสุด = เดือนที่เพิ่งจบ (ก.ค.) ออกบิลวันที่ 1 ของเดือนนี้ · หน่วยตรงกับ readings จริง ----
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const cycle = `${prevStart.getFullYear()}-${String(prevStart.getMonth() + 1).padStart(2, "0")}`;
  const period = { from: prevStart, to: monthStart };
  const issued_at = new Date(now.getFullYear(), now.getMonth(), 1, 9, 0); // วันที่ 1 เวลา 09:00
  const due_at = new Date(issued_at.getTime() + 7 * 864e5);
  const grace_until = new Date(due_at.getTime() + 5 * 864e5);
  for (const [k, n] of NODES.entries()) {
    const eAmt = rd(n._jElec * RATE.elec), wAmt = rd(n._jWater * RATE.water);
    const lines = [
      { type: "electric", usage: n._jElec, rate: RATE.elec, amount: eAmt },
      { type: "water", usage: n._jWater, rate: RATE.water, amount: wAmt },
      { type: "rent", amount: n.rent },
    ];
    let subtotal = eAmt + wAmt + n.rent;
    if (n.common > 0) { lines.push({ type: "common", amount: n.common }); subtotal += n.common; }
    subtotal = rd(subtotal);
    // สถานะคละ: จ่ายแล้ว / ยังไม่จ่าย (ยังไม่ครบกำหนด) / จ่ายบางส่วน · A-102 มีสลิปรอตรวจ
    const status = k % 3 === 0 ? "paid" : k % 3 === 2 ? "partially_paid" : "issued";
    const total = subtotal;
    const paid_amount = status === "paid" ? total : status === "partially_paid" ? rd(total / 2) : 0;
    const bill = await db.collection("bills").insertOne({
      tenant_id: tenantId, market_id: n.marketId, unit_id: n.unitId, occupant_user_id: null,
      cycle, period, issued_at, due_at, grace_until,
      lines, subtotal, late_fee: 0, total, status, paid_amount, created_at: issued_at, updated_at: now,
    });
    if (paid_amount > 0) {
      const paidAt = new Date(issued_at.getTime() + R(0.3, 2.5) * 864e5);
      await db.collection("payments").insertOne({
        tenant_id: tenantId, market_id: n.marketId, unit_id: n.unitId, bill_id: bill.insertedId,
        amount: paid_amount, method: "transfer", status: "verified", slip_image_url: slipSvg(paid_amount, paidAt, n.code),
        verified_at: paidAt, created_at: paidAt, updated_at: paidAt,
      });
    } else if (n.code === "A-102") {
      // ผู้เช่าโอนแล้วแนบสลิป รอเจ้าของกดยืนยัน (โชว์คิว "รอตรวจสลิป" หน้า /bills)
      const sentAt = new Date(now.getTime() - 0.4 * 864e5);
      await db.collection("payments").insertOne({
        tenant_id: tenantId, market_id: n.marketId, unit_id: n.unitId, bill_id: bill.insertedId,
        amount: total, method: "transfer", status: "submitted", slip_image_url: slipSvg(total, sentAt, n.code),
        created_at: sentAt, updated_at: sentAt,
      });
    }
  }

  // ---- audit เล็กน้อยให้หน้า /audit ไม่ว่าง ----
  await db.collection("audit_logs").insertMany([
    { at: new Date(now - 3 * 864e5), tenant_id: tenantId, actor_id: String(ownerId), actor_login: "arkara@owner", actor_role: "owner", action: "auth.login", target_type: "user", target_id: String(ownerId) },
    { at: issued_at, tenant_id: tenantId, actor_id: String(ownerId), actor_login: "arkara@owner", actor_role: "owner", action: "bill.generate", target_type: "market", target_id: String(marketId), market_id: marketId, detail: { cycle, generated: NODES.length } },
  ]);
}

// ==== ที่พักหลากหลาย ~20 แห่งทั่วไทย + ลูกค้ารวม ~1,000 คน (ข้อมูลเบา: readings 3 จุด/มิเตอร์) ====
async function generateBulkProperties(db, now) {
  const hashFast = (p) => bcrypt.hashSync(p, 8); // เร็วกว่า rounds 10 สำหรับ demo จำนวนมาก · login ยังใช้ได้ปกติ
  const FIRST = ["สมชาย", "สุดารัตน์", "อนุชา", "วิภาดา", "ณัฐพล", "พรทิพย์", "ธนกร", "กมลชนก", "ศุภกิจ", "จิราพร", "ปิยะพงษ์", "อรทัย", "เอกชัย", "นารีรัตน์", "วีระยุทธ", "ชลธิชา", "กิตติศักดิ์", "มณีรัตน์", "สราวุฒิ", "เบญจวรรณ", "ธีรพงศ์", "ปวีณา", "ภาณุพงศ์", "ศิริพร", "ชัยวัฒน์", "ดวงใจ", "นพดล", "อารยา", "ประเสริฐ", "กนกวรรณ", "วิชัย", "สุภาพร", "ตะวัน", "พิมพ์ชนก", "รัชนก", "ก้องภพ", "ธัญญา", "สมหญิง", "ยุทธนา", "แพรวา", "ณรงค์", "จันทิมา", "อดิศร", "ศศิธร", "พงษ์เทพ", "วรรณภา", "สิทธิชัย", "เนตรนภา", "อภิสิทธิ์", "มาลี"];
  const LAST = ["ใจดี", "แก้วมณี", "พรมมา", "ศรีสุข", "บุญมาก", "วงศ์สว่าง", "เพชรรัตน์", "อินทร์อ่อน", "ทองคำ", "นาคน้อย", "สายทอง", "คำแสน", "มั่นคง", "จันทร์เพ็ญ", "ป้อมทอง", "บัวขาว", "แสนสุข", "พูลสวัสดิ์", "หาญกล้า", "รุ่งเรือง", "สุขสันต์", "ศรีทอง", "มีชัย", "วัฒนา", "ดีงาม", "เจริญสุข", "ทองดี", "แซ่ลิ้ม", "บุญเรือง", "พงษ์พันธ์", "สมบูรณ์", "ยิ่งยง", "เกษมสุข", "ไชยวงศ์", "ธนบดี", "อุดมทรัพย์", "ปัญญาดี", "รักไทย", "ชาญชัย", "วิเศษ", "มงคล", "พิทักษ์", "สุวรรณ", "เรืองศรี", "กิจเจริญ", "นิลรัตน์", "ภักดี", "อ่อนน้อม", "ทวีสุข", "งามพร้อม"];
  const PROV = ["กรุงเทพฯ", "นนทบุรี", "ปทุมธานี", "สมุทรปราการ", "เชียงใหม่", "ขอนแก่น", "นครราชสีมา", "ชลบุรี", "ภูเก็ต", "สงขลา", "อุดรธานี", "พิษณุโลก", "สุราษฎร์ธานี", "ระยอง", "นครปฐม"];
  const PROPS = [
    { name: "ลุมพินี เพลส พระราม 4", slug: "lumpiniplace", rooms: 72, rent: 6500, elec: 8, water: 22, ecost: 4.4, wcost: 13 },
    { name: "ไอดีโอ โมบิ สุขุมวิท", slug: "ideomobi", rooms: 60, rent: 8500, elec: 8, water: 25, ecost: 4.5, wcost: 14 },
    { name: "เดอะ เบส เชียงใหม่", slug: "thebasecm", rooms: 58, rent: 5500, elec: 7, water: 20, ecost: 4.2, wcost: 12 },
    { name: "ศุภาลัย ปาร์ค ขอนแก่น", slug: "supalaikk", rooms: 48, rent: 4800, elec: 7, water: 18, ecost: 4.1, wcost: 11 },
    { name: "บ้านกลางเมือง โคราช", slug: "baanklang", rooms: 36, rent: 4200, elec: 7, water: 18, ecost: 4.0, wcost: 11 },
    { name: "ริเวอร์ไซด์ เรสซิเดนซ์", slug: "riverside", rooms: 50, rent: 6000, elec: 8, water: 20, ecost: 4.3, wcost: 12 },
    { name: "กรีน ทาวเวอร์ บางนา", slug: "greentower", rooms: 90, rent: 7000, elec: 8, water: 22, ecost: 4.4, wcost: 13 },
    { name: "ซัน เพลส หาดใหญ่", slug: "sunplace", rooms: 33, rent: 3900, elec: 6.5, water: 18, ecost: 4.0, wcost: 11 },
    { name: "ยูนิเนสท์ ม.เกษตร", slug: "uninest", rooms: 100, rent: 4500, elec: 7, water: 19, ecost: 4.1, wcost: 11 },
    { name: "แชปเตอร์ ทองหล่อ", slug: "chapter", rooms: 46, rent: 9500, elec: 8.5, water: 26, ecost: 4.6, wcost: 15 },
    { name: "น็อตติ้ง ฮิลล์ ภูเก็ต", slug: "nottinghill", rooms: 40, rent: 5800, elec: 8, water: 24, ecost: 4.5, wcost: 14 },
    { name: "ปาร์ค ออริจิ้น พญาไท", slug: "parkorigin", rooms: 70, rent: 11000, elec: 9, water: 28, ecost: 4.8, wcost: 16 },
    { name: "เดอะ นิมมาน เชียงใหม่", slug: "nimman", rooms: 44, rent: 6200, elec: 7.5, water: 21, ecost: 4.3, wcost: 12 },
    { name: "ริชพาร์ค เจริญนคร", slug: "richpark", rooms: 66, rent: 7500, elec: 8, water: 23, ecost: 4.4, wcost: 13 },
    { name: "เค แมนชั่น รังสิต", slug: "kmansion", rooms: 30, rent: 3800, elec: 6.5, water: 17, ecost: 4.0, wcost: 11 },
    { name: "เพลินจิต คอลเลคชั่น", slug: "ploenchit", rooms: 38, rent: 12000, elec: 9, water: 30, ecost: 5.0, wcost: 17 },
    { name: "สยาม เรสซิเดนซ์ สีลม", slug: "siamresidence", rooms: 80, rent: 8000, elec: 8, water: 24, ecost: 4.5, wcost: 14 },
    { name: "เดอะ วอเตอร์ฟอร์ด ระยอง", slug: "waterford", rooms: 54, rent: 5200, elec: 7, water: 19, ecost: 4.2, wcost: 12 },
    { name: "มูนไลท์ เพลส อุดร", slug: "moonlight", rooms: 28, rent: 3600, elec: 6.5, water: 17, ecost: 4.0, wcost: 10 },
  ];
  const bulkTarget = 980;
  const sumSoFar = PROPS.reduce((s, p) => s + p.rooms, 0);
  PROPS.push({ name: "ยูนิเวอร์ซิตี้ ดอร์ม ม.มหิดล", slug: "mudorm", rooms: Math.max(20, bulkTarget - sumSoFar), rent: 4000, elec: 7, water: 18, ecost: 4.1, wcost: 11 });

  const lastShort = await db.collection("markets").find({}).sort({ market_short: -1 }).limit(1).next();
  let short = (lastShort?.market_short || 1) + 1;
  const rint = (a, b) => Math.floor(R(a, b + 1));
  const makeNid = (seed) => {
    const base = ("11" + String(1000000000 + seed * 7919)).slice(0, 12).split("").map(Number);
    const sum = base.reduce((acc, d, idx) => acc + d * (13 - idx), 0);
    return base.join("") + ((11 - (sum % 11)) % 10);
  };
  const seasonal = [1.0, 1.02, 1.12, 1.25, 1.22, 1.1, 1.02, 1.0, 0.97, 0.95, 0.9, 0.92];
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevEnd = new Date(now.getFullYear(), now.getMonth(), 1);
  const cycle = `${prevStart.getFullYear()}-${String(prevStart.getMonth() + 1).padStart(2, "0")}`;
  const issued = new Date(now.getFullYear(), now.getMonth(), 1, 9, 0);
  const due = new Date(issued.getTime() + 7 * 864e5);
  const grace = new Date(due.getTime() + 5 * 864e5);
  const HIST = [2, 3];

  let gIdx = 0, totalTenants = 0;
  for (const [pi, P] of PROPS.entries()) {
    const tenantId = new ObjectId(), marketId = new ObjectId(), ownerId = new ObjectId();
    await db.collection("tenants").insertOne({ _id: tenantId, name: P.name, plan: "demo", status: "active", created_at: now, updated_at: now });
    await db.collection("users").insertOne({ _id: ownerId, tenant_id: tenantId, role: "owner", login_id: `${P.slug}@owner`, password_hash: hashFast("owner1234"), display_name: `เจ้าของ${P.name}`, email: `owner@${P.slug}.demo`, verified: true, status: "active", created_at: now, updated_at: now });
    await db.collection("markets").insertOne({ _id: marketId, tenant_id: tenantId, name: P.name, type: "condo", slug: P.slug, timezone: "Asia/Bangkok", market_short: short++, province: PROV[pi % PROV.length],
      rate: { elec_per_kwh: P.elec, water_per_m3: P.water, service_fee: 0, elec_cost_per_kwh: P.ecost, water_cost_per_m3: P.wcost },
      billing: { cycle_day: 1, due_days: 7, grace_days: 5, late_fee_per_day: 50, late_fee_type: "fixed" }, created_at: now, updated_at: now });

    const perFloor = 10, floors = 5, perBldg = perFloor * floors;
    const nBldg = Math.ceil(P.rooms / perBldg);
    const zones = Array.from({ length: nBldg }, () => new ObjectId());
    await db.collection("zones").insertMany(zones.map((zid, b) => ({ _id: zid, tenant_id: tenantId, market_id: marketId, name: "อาคาร " + String.fromCharCode(65 + b), order: b + 1, kind: "building", created_at: now, updated_at: now })));

    const U = [], M = [], D = [], RD = [], US = [], BL = [], PY = [];
    let made = 0;
    for (let b = 0; b < nBldg && made < P.rooms; b++)
      for (let fl = 1; fl <= floors && made < P.rooms; fl++)
        for (let r = 1; r <= perFloor && made < P.rooms; r++) {
          made++;
          const code = String.fromCharCode(65 + b) + fl + String(r).padStart(2, "0");
          const uid = new ObjectId(), eM = new ObjectId(), wM = new ObjectId(), tuId = new ObjectId();
          const rent = P.rent + (fl === 1 ? 300 : 0) + (r === perFloor ? 400 : 0);
          const common = 300 + (pi % 3) * 100;
          const eUse = rd(R(35, 300) * seasonal[6], 2), wUse = rd(R(3, 28), 2);
          const e0 = rd(R(50, 600), 2), w0 = rd(R(5, 60), 2);
          const eNow = rd(e0 + eUse + R(2, 20), 2), wNow = rd(w0 + wUse + R(0.2, 3), 3);
          M.push({ _id: eM, tenant_id: tenantId, market_id: marketId, unit_id: uid, kind: "electric", unit_of_measure: "kWh", last_value: eNow, last_ts: now, created_at: now, updated_at: now });
          M.push({ _id: wM, tenant_id: tenantId, market_id: marketId, unit_id: uid, kind: "water", unit_of_measure: "m3", last_value: wNow, last_ts: now, created_at: now, updated_at: now });
          U.push({ _id: uid, tenant_id: tenantId, market_id: marketId, zone_id: zones[b], type: "condo_room", code, name: "ห้อง " + code, floor: fl, rent, common_fee: common, meters: [{ meter_id: eM, kind: "electric" }, { meter_id: wM, kind: "water" }], status: "occupied", occupant_user_id: tuId, created_at: now, updated_at: now });
          D.push({ tenant_id: tenantId, market_id: marketId, unit_id: uid, meter_id: eM, uuid: new ObjectId().toString(), device_type: "meter_node", kind: "electric", fw_version: 1, format_version: 1, status: { online: false, last_seen: now }, first_seen: now, created_at: now, updated_at: now });
          D.push({ tenant_id: tenantId, market_id: marketId, unit_id: uid, meter_id: wM, uuid: new ObjectId().toString(), device_type: "meter_node", kind: "water", fw_version: 1, format_version: 1, status: { online: false, last_seen: now }, first_seen: now, created_at: now, updated_at: now });
          const emeta = { tenant_id: tenantId, market_id: marketId, unit_id: uid, meter_id: eM, kind: "electric" };
          const wmeta = { tenant_id: tenantId, market_id: marketId, unit_id: uid, meter_id: wM, kind: "water" };
          RD.push({ ts: prevStart, meta: emeta, v: e0 }, { ts: new Date(prevEnd.getTime() - 3600e3), meta: emeta, v: rd(e0 + eUse, 2) }, { ts: now, meta: emeta, v: eNow });
          RD.push({ ts: prevStart, meta: wmeta, v: w0 }, { ts: new Date(prevEnd.getTime() - 3600e3), meta: wmeta, v: rd(w0 + wUse, 3) }, { ts: now, meta: wmeta, v: wNow });
          const fn = FIRST[(gIdx * 7 + pi) % FIRST.length], ln = LAST[(gIdx * 13 + pi * 3) % LAST.length];
          const pass = "pass" + code.toLowerCase();
          US.push({ _id: tuId, tenant_id: tenantId, role: "tenant_user", login_id: `${P.slug}@${code.toLowerCase()}`, password_hash: hashFast(pass), first_name: fn, last_name: ln, national_id: makeNid(gIdx), phone: "0" + rint(8, 9) + String(rint(10000000, 99999999)), display_name: fn + " " + ln, email: `${P.slug}.${code.toLowerCase()}@mail.demo`, verified: true, status: "active", unit_ids: [uid], created_at: now, updated_at: now });
          const eAmt = rd(eUse * P.elec), wAmt = rd(wUse * P.water);
          const lines = [{ type: "electric", usage: eUse, rate: P.elec, amount: eAmt }, { type: "water", usage: wUse, rate: P.water, amount: wAmt }, { type: "rent", amount: rent }, { type: "common", amount: common }];
          const subtotal = rd(eAmt + wAmt + rent + common);
          const st = made % 3 === 0 ? "paid" : made % 3 === 2 ? "partially_paid" : "issued";
          const paid = st === "paid" ? subtotal : st === "partially_paid" ? rd(subtotal / 2) : 0;
          const bId = new ObjectId();
          BL.push({ _id: bId, tenant_id: tenantId, market_id: marketId, unit_id: uid, occupant_user_id: null, cycle, period: { from: prevStart, to: prevEnd }, issued_at: issued, due_at: due, grace_until: grace, lines, subtotal, late_fee: 0, total: subtotal, status: st, paid_amount: paid, created_at: issued, updated_at: now });
          if (paid > 0) { const pAt = new Date(issued.getTime() + R(0.3, 2.5) * 864e5); PY.push({ tenant_id: tenantId, market_id: marketId, unit_id: uid, bill_id: bId, amount: paid, method: "transfer", status: "verified", slip_image_url: slipSvg(paid, pAt, code), verified_at: pAt, created_at: pAt, updated_at: pAt }); }
          for (const back of HIST) {
            const hs = new Date(now.getFullYear(), now.getMonth() - back, 1), he = new Date(now.getFullYear(), now.getMonth() - back + 1, 1);
            const hc = `${hs.getFullYear()}-${String(hs.getMonth() + 1).padStart(2, "0")}`;
            const he2 = rd(eUse * seasonal[hs.getMonth()] * R(0.85, 1.2), 2), hw2 = rd(wUse * R(0.85, 1.2), 2);
            const hea = rd(he2 * P.elec), hwa = rd(hw2 * P.water), hsub = rd(hea + hwa + rent + common);
            const hIss = new Date(hs.getFullYear(), hs.getMonth() + 1, 1, 9, 0), hDue = new Date(hIss.getTime() + 7 * 864e5);
            const hbId = new ObjectId();
            BL.push({ _id: hbId, tenant_id: tenantId, market_id: marketId, unit_id: uid, occupant_user_id: null, cycle: hc, period: { from: hs, to: he }, issued_at: hIss, due_at: hDue, grace_until: new Date(hDue.getTime() + 5 * 864e5), lines: [{ type: "electric", usage: he2, rate: P.elec, amount: hea }, { type: "water", usage: hw2, rate: P.water, amount: hwa }, { type: "rent", amount: rent }, { type: "common", amount: common }], subtotal: hsub, late_fee: 0, total: hsub, status: "paid", paid_amount: hsub, created_at: hIss, updated_at: hIss });
            const hpAt = new Date(hDue.getTime() - R(1, 5) * 864e5);
            PY.push({ tenant_id: tenantId, market_id: marketId, unit_id: uid, bill_id: hbId, amount: hsub, method: "transfer", status: "verified", slip_image_url: slipSvg(hsub, hpAt, code), verified_at: hpAt, created_at: hpAt, updated_at: hpAt });
          }
          gIdx++;
        }
    if (U.length) await db.collection("units").insertMany(U);
    if (M.length) await db.collection("meters").insertMany(M);
    if (D.length) await db.collection("devices").insertMany(D);
    if (US.length) await db.collection("users").insertMany(US);
    if (BL.length) await db.collection("bills").insertMany(BL);
    if (PY.length) await db.collection("payments").insertMany(PY);
    for (let i = 0; i < RD.length; i += 4000) await db.collection("readings").insertMany(RD.slice(i, i + 4000));
    totalTenants += made;
    console.log(`  + ${P.name} (${P.slug}) · ${made} ห้อง · owner ${P.slug}@owner`);
  }
  return { props: PROPS.length, tenants: totalTenants };
}
