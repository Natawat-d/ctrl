import { tenantFilter } from "@/lib/auth";
import { json, httpError } from "@/lib/http";
import { Markets, Units, Meters, oid } from "@/models";
import { recordAudit } from "@/services/audit";

// createUnit adds a room AND its electric + water meters so it is ready for
// telemetry and billing immediately.
export async function createUnit(user, body) {
  const marketId = oid(body.market_id);
  if (!marketId) return httpError(400, "bad_market", "ต้องระบุไซต์");
  const market = await Markets.findOne(tenantFilter(user, { _id: marketId }));
  if (!market) return httpError(404, "no_market", "ไม่พบไซต์");
  const code = String(body.code || "").trim();
  if (!code) return httpError(400, "bad_code", "ต้องระบุรหัสห้อง");

  const now = new Date();
  const tenant_id = market.tenant_id;
  const type = "condo_room";

  const unit = await Units.insert({
    tenant_id, market_id: marketId, zone_id: oid(body.zone_id) || null,
    type, code, name: body.name || code,
    floor: body.floor != null && body.floor !== "" ? Number(body.floor) : null,
    rent: Number(body.rent) || 0, common_fee: Number(body.common_fee) || 0,
    status: "occupied", created_at: now, updated_at: now,
  });
  const eM = await Meters.insert({ tenant_id, market_id: marketId, unit_id: unit._id, kind: "electric", phase: 1, unit_of_measure: "kWh", last_value: 0, created_at: now, updated_at: now });
  const wM = await Meters.insert({ tenant_id, market_id: marketId, unit_id: unit._id, kind: "water", unit_of_measure: "m3", last_value: 0, created_at: now, updated_at: now });
  await Units.updateById(unit._id, { $set: { meters: [{ meter_id: eM._id, kind: "electric" }, { meter_id: wM._id, kind: "water" }] } });
  await recordAudit({ user, action: "unit.create", target_type: "unit", target_id: unit._id, market_id: marketId, target_label: code, detail: { zone_id: String(body.zone_id || ""), rent: unit.rent } });
  return json({ ok: true, unit }, 201);
}
