import { json, httpError } from "@/lib/http";
import { Markets, oid } from "@/models";
import { recordAudit } from "@/services/audit";

function slugify(s) {
  return (s || "site").normalize("NFKD").replace(/[^a-zA-Z0-9]/g, "").slice(0, 12).toLowerCase() || "site";
}

// createSite lets an owner add another building (condo/apartment) under their
// own tenant — one account can own many sites. Admins may target any tenant.
export async function createSite(user, body) {
  const name = String(body.name || "").trim();
  if (!name) return httpError(400, "bad_name", "ต้องระบุชื่อสาขา");
  const tenantId = user.role === "platform_admin" && body.tenant_id ? oid(body.tenant_id) : (user.tid ? oid(user.tid) : null);
  if (!tenantId) return httpError(400, "no_tenant", "ไม่พบเจ้าของบัญชี");

  let base = slugify(name), slug = base, n = 1;
  while (await Markets.findOne({ slug })) slug = base + ++n;
  const lastShort = (await Markets.find({}, { sort: { market_short: -1 }, limit: 1 }))[0];
  const now = new Date();

  const market = await Markets.insert({
    tenant_id: tenantId, name, type: "condo", slug, timezone: "Asia/Bangkok",
    market_short: (lastShort?.market_short || 0) + 1,
    rate: { elec_per_kwh: 8, water_per_m3: 18, service_fee: 0 },
    billing: { cycle_day: 1, due_days: 7, grace_days: 3, late_fee_per_day: 20, late_fee_type: "fixed" },
    created_at: now, updated_at: now,
  });
  await recordAudit({ user, action: "site.create", target_type: "market", target_id: market._id, market_id: market._id, target_label: name, detail: { type: market.type } });
  return json({ ok: true, market }, 201);
}
