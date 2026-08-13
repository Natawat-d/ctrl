import crypto from "crypto";
import { checkPassword, signToken, hashPassword } from "@/lib/auth";
import { json, httpError } from "@/lib/http";
import { sendEmail } from "@/services/notify";
import { recordAudit } from "@/services/audit";
import { Users, Tenants, Markets } from "@/models";

const publicUser = (u) => ({
  id: u._id.toString(),
  role: u.role,
  tenant_id: u.tenant_id ? u.tenant_id.toString() : "",
  display_name: u.display_name,
  login_id: u.login_id,
  verified: u.verified !== false,
});

function slugify(s) {
  return (s || "site").normalize("NFKD").replace(/[^a-zA-Z0-9]/g, "").slice(0, 12).toLowerCase() || "site";
}

// จำกัดการเดารหัสผ่าน (brute-force) — in-memory sliding window ต่อ login_id, ไม่พึ่ง redis
// นับเฉพาะ "ล้มเหลว" · สำเร็จแล้ว reset · เกินโควตา → 429
const LOGIN_MAX_FAILS = 8;            // จำนวนครั้งที่ล้มเหลวได้
const LOGIN_WINDOW_MS = 10 * 60 * 1000; // ในช่วง 10 นาที
const loginFails = new Map();         // login_id -> number[] (timestamps ของครั้งที่ล้มเหลว)

function recentFails(id, now) {
  const arr = (loginFails.get(id) || []).filter((t) => now - t < LOGIN_WINDOW_MS);
  if (arr.length) loginFails.set(id, arr); else loginFails.delete(id);
  return arr;
}

export async function login(req) {
  const { login_id, password } = await req.json();
  const now = Date.now();

  // เช็ค rate limit ก่อน (เฉพาะเมื่อมี login_id)
  if (login_id) {
    const fails = recentFails(login_id, now);
    if (fails.length >= LOGIN_MAX_FAILS) {
      const waitMs = LOGIN_WINDOW_MS - (now - fails[0]);
      const mins = Math.max(1, Math.ceil(waitMs / 60000));
      return httpError(429, "rate_limited", `พยายามเข้าสู่ระบบบ่อยเกินไป ลองใหม่ใน ${mins} นาที`);
    }
  }

  const u = await Users.findOne({ login_id });
  if (!u || !checkPassword(password, u.password_hash)) {
    // บันทึกความล้มเหลวเข้าหน้าต่างเวลา
    if (login_id) {
      const fails = recentFails(login_id, now);
      fails.push(now);
      loginFails.set(login_id, fails);
    }
    return httpError(401, "invalid_credentials", "login_id หรือรหัสผ่านไม่ถูกต้อง");
  }
  // สำเร็จ → ล้างตัวนับ
  if (login_id) loginFails.delete(login_id);
  await recordAudit({ user: { uid: u._id.toString(), role: u.role, tid: u.tenant_id ? u.tenant_id.toString() : null, login_id: u.login_id }, action: "auth.login", target_type: "user", target_id: u._id, target_label: u.login_id });
  return json({ access_token: signToken(u), user: publicUser(u) });
}

export async function signup(req) {
  const { display_name, email, password, site_name, site_type, accept_terms } = await req.json();
  if (!email || !password || !site_name) return httpError(400, "bad_input", "กรอกอีเมล รหัสผ่าน และชื่อไซต์ให้ครบ");
  if (!accept_terms) return httpError(400, "terms", "กรุณายอมรับเงื่อนไขการใช้งาน");
  if (String(password).length < 6) return httpError(400, "weak", "รหัสผ่านอย่างน้อย 6 ตัว");
  if (await Users.findOne({ login_id: email })) return httpError(409, "duplicate", "อีเมลนี้ถูกใช้สมัครแล้ว");

  let base = slugify(site_name), slug = base, n = 1;
  while (await Markets.findOne({ slug })) slug = base + ++n;

  const now = new Date();
  const tenant = await Tenants.insert({ name: site_name, plan: "free", status: "active", created_at: now, updated_at: now });

  const token = crypto.randomBytes(20).toString("hex");
  const owner = await Users.insert({
    tenant_id: tenant._id, role: "owner", login_id: email, email,
    password_hash: hashPassword(password), display_name: display_name || site_name,
    verified: false, verify_token: token, status: "active", accepted_terms_at: now,
    created_at: now, updated_at: now,
  });

  const lastShort = (await Markets.find({}, { sort: { market_short: -1 }, limit: 1 }))[0];
  await Markets.insert({
    tenant_id: tenant._id, name: site_name, type: "condo", slug, timezone: "Asia/Bangkok",
    market_short: (lastShort?.market_short || 0) + 1,
    // มอนิเตอร์น้ำ-ไฟ + ออกบิลรายเดือน (ไม่มีตัดน้ำ-ไฟ) · ตั้งราคาขาย/ต้นทุนเองภายหลังในหน้า ตั้งค่า
    rate: { elec_per_kwh: 7, water_per_m3: 20, service_fee: 0, elec_cost_per_kwh: 0, water_cost_per_m3: 0 },
    billing: { cycle_day: 1, due_days: 7, grace_days: 5, late_fee_per_day: 50, late_fee_type: "fixed" },
    created_at: now, updated_at: now,
  });

  const origin = new URL(req.url).origin;
  const verifyUrl = `${origin}${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/auth/verify?token=${token}`;
  await sendEmail(email, "ยืนยันอีเมล — CTRL",
    `สวัสดีค่ะ\n\nยืนยันการสมัครไซต์ "${site_name}" โดยคลิกลิงก์นี้:\n${verifyUrl}\n\nหากไม่ได้สมัคร โปรดละเว้นอีเมลนี้`);

  const devLink = process.env.SMTP_HOST ? undefined : verifyUrl;
  return json({ ok: true, user_id: owner._id, slug, verify_url: devLink }, 201);
}

// URL สาธารณะสำหรับลิงก์ในอีเมล — หลัง Caddy/proxy req.url เป็น internal (127.0.0.1:3210)
// จึงใช้ PUBLIC_BASE_URL (เช่น http://147.50.254.104/CTRL_MOCK) ถ้าตั้งไว้ ไม่งั้น fallback origin+basePath
function publicBase(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  return new URL(req.url).origin + (process.env.NEXT_PUBLIC_BASE_PATH || "");
}

// POST /api/auth/forgot — ขอรีเซ็ตรหัส (เจ้าของ): กรอกอีเมลหรือ login_id → ส่งลิงก์ตั้งรหัสใหม่ทางอีเมล
// ตอบ ok เสมอ (ไม่บอกว่ามีบัญชีนี้จริงไหม กัน enumeration) · ถ้ายังไม่ตั้ง SMTP จะคืน dev_link มาให้ทดสอบ
export async function forgotPassword(req) {
  const { login_id } = await req.json();
  const key = String(login_id || "").trim();
  if (!key) return httpError(400, "bad_input", "กรอกอีเมลหรือไอดีเข้าระบบ");
  const u = await Users.findOne({ $or: [{ login_id: key }, { email: key.toLowerCase() }], role: "owner" });
  const resp = { ok: true, message: "ถ้ามีบัญชีนี้ ระบบได้ส่งลิงก์ตั้งรหัสใหม่ไปที่อีเมลแล้ว" };
  if (!u) return json(resp); // ไม่เผยว่าไม่มีบัญชี
  const token = crypto.randomBytes(24).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 ชม.
  await Users.updateById(u._id, { $set: { reset_token: token, reset_expires: expires, updated_at: new Date() } });
  const link = `${publicBase(req)}/reset?token=${token}`;
  const to = u.email || u.login_id;
  await sendEmail(to, "ตั้งรหัสผ่านใหม่ — CTRL",
    `สวัสดีค่ะ\n\nมีการขอตั้งรหัสผ่านใหม่สำหรับบัญชี ${u.login_id}\nคลิกลิงก์นี้เพื่อตั้งรหัสใหม่ (ลิงก์หมดอายุใน 1 ชั่วโมง):\n${link}\n\nหากคุณไม่ได้เป็นผู้ขอ โปรดละเว้นอีเมลนี้ รหัสเดิมยังใช้ได้ตามปกติ`);
  await recordAudit({ user: { uid: u._id.toString(), role: u.role, tid: u.tenant_id ? u.tenant_id.toString() : null, login_id: u.login_id }, action: "auth.forgot", target_type: "user", target_id: u._id, target_label: u.login_id });
  // dev (ยังไม่ตั้ง SMTP) → ส่ง link กลับมาให้ทดสอบได้ทันที
  if (!process.env.SMTP_HOST) resp.dev_link = link;
  return json(resp);
}

// POST /api/auth/reset — ตั้งรหัสใหม่ด้วย token จากอีเมล
export async function resetPassword(req) {
  const { token, password } = await req.json();
  if (!token || !password) return httpError(400, "bad_input", "ข้อมูลไม่ครบ");
  if (String(password).length < 6) return httpError(400, "weak", "รหัสผ่านอย่างน้อย 6 ตัว");
  const u = await Users.findOne({ reset_token: String(token) });
  if (!u || !u.reset_expires || new Date(u.reset_expires) < new Date()) {
    return httpError(400, "invalid_token", "ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว — ขอลิงก์ใหม่อีกครั้ง");
  }
  await Users.updateById(u._id, {
    $set: { password_hash: hashPassword(password), password_plain: String(password), updated_at: new Date() },
    $unset: { reset_token: "", reset_expires: "" },
  });
  await recordAudit({ user: { uid: u._id.toString(), role: u.role, tid: u.tenant_id ? u.tenant_id.toString() : null, login_id: u.login_id }, action: "auth.reset", target_type: "user", target_id: u._id, target_label: u.login_id });
  return json({ ok: true, login_id: u.login_id, message: "ตั้งรหัสผ่านใหม่เรียบร้อย เข้าสู่ระบบได้เลย" });
}

export async function verify(req) {
  const token = new URL(req.url).searchParams.get("token");
  const bp = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const to = (q) => new URL(`${bp}/login?${q}`, req.url);
  if (!token) return Response.redirect(to("verify=missing"), 302);
  const u = await Users.findOne({ verify_token: token });
  if (!u) return Response.redirect(to("verify=invalid"), 302);
  await Users.updateById(u._id, { $set: { verified: true, updated_at: new Date() }, $unset: { verify_token: "" } });
  return Response.redirect(to("verified=1"), 302);
}
