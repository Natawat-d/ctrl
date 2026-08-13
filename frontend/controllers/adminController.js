import { hashPassword } from "@/lib/auth";
import { json, httpError } from "@/lib/http";
import { Users, Tenants, Markets, Units } from "@/models";
import { oid } from "@/models";
import { recordAudit } from "@/services/audit";

function slugify(s) {
  return (s || "site").normalize("NFKD").replace(/[^a-zA-Z0-9]/g, "").slice(0, 12).toLowerCase() || "site";
}

export async function overview() {
  const tenants = await Tenants.find({}, { sort: { created_at: -1 } });
  const items = [];
  for (const t of tenants) {
    const markets = await Markets.find({ tenant_id: t._id }, { project: { name: 1, type: 1, slug: 1 } });
    const owners = await Users.find({ tenant_id: t._id, role: "owner" }, { project: { password_hash: 0, verify_token: 0 } });
    const unit_count = await Units.count({ tenant_id: t._id });
    const tenant_count = await Users.count({ tenant_id: t._id, role: "tenant_user" });
    items.push({ ...t, markets, owners, unit_count, tenant_count });
  }
  const totals = {
    tenants: tenants.length,
    markets: await Markets.count(),
    units: await Units.count(),
    users: await Users.count(),
  };
  return json({ items, totals });
}

export async function createOwner(req, actor) {
  const { display_name, email, password, site_name, site_type } = await req.json();
  if (!email || !password || !site_name) return httpError(400, "bad_input", "กรอกอีเมล รหัสผ่าน และชื่อไซต์");
  if (await Users.findOne({ login_id: email })) return httpError(409, "duplicate", "อีเมลนี้ถูกใช้แล้ว");

  let base = slugify(site_name), slug = base, n = 1;
  while (await Markets.findOne({ slug })) slug = base + ++n;

  const now = new Date();
  const tenant = await Tenants.insert({ name: site_name, plan: "standard", status: "active", created_at: now, updated_at: now });
  await Users.insert({
    tenant_id: tenant._id, role: "owner", login_id: email, email,
    // เก็บ password_plain ให้ platform_admin ดู/ส่งต่อรหัสให้เจ้าของได้ (เหมือนที่เจ้าของเห็นรหัสผู้เช่า)
    password_hash: hashPassword(password), password_plain: String(password), display_name: display_name || site_name,
    verified: true, status: "active", created_at: now, updated_at: now,
  });
  const lastShort = (await Markets.find({}, { sort: { market_short: -1 }, limit: 1 }))[0];
  await Markets.insert({
    tenant_id: tenant._id, name: site_name, type: "condo", slug, timezone: "Asia/Bangkok",
    market_short: (lastShort?.market_short || 0) + 1,
    // มอนิเตอร์น้ำ-ไฟ + บิลรายเดือน (ไม่มีตัดน้ำ-ไฟ) · ตั้งราคาขาย/ต้นทุนภายหลังในหน้า ตั้งค่า
    rate: { elec_per_kwh: 7, water_per_m3: 20, service_fee: 0, elec_cost_per_kwh: 0, water_cost_per_m3: 0 },
    billing: { cycle_day: 1, due_days: 7, grace_days: 5, late_fee_per_day: 50, late_fee_type: "fixed" },
    created_at: now, updated_at: now,
  });
  await recordAudit({ user: actor, action: "owner.create", target_type: "tenant", target_id: tenant._id, target_label: email, detail: { site_name, site_type } });
  return json({ ok: true, slug }, 201);
}

export async function patchOwner(req, id, actor) {
  const _id = oid(id);
  if (!_id) return httpError(400, "bad_id", "id ไม่ถูกต้อง");
  const owner = await Users.findOne({ _id, role: "owner" });
  if (!owner) return httpError(404, "not_found", "ไม่พบเจ้าของบัญชี");

  const body = await req.json();
  const set = { updated_at: new Date() };
  if (body.password) { set.password_hash = hashPassword(body.password); set.password_plain = String(body.password); }
  if (body.verified != null) set.verified = !!body.verified;
  if (body.status) set.status = body.status;
  if (body.display_name) set.display_name = body.display_name;
  await Users.updateById(_id, { $set: set });
  if (body.status && owner.tenant_id) {
    await Tenants.updateById(owner.tenant_id, { $set: { status: body.status, updated_at: new Date() } });
  }
  await recordAudit({ user: actor, action: "owner.update", target_type: "user", target_id: _id, target_label: owner.email || owner.login_id, detail: { password_reset: !!body.password, status: body.status } });
  return json({ ok: true });
}
