import { tenantFilter } from "@/lib/auth";
import { json, httpError } from "@/lib/http";
import { deviceView } from "@/lib/device";
import { Units, Meters, Devices, oid } from "@/models";
import { recordAudit } from "@/services/audit";

// โมเดลอุปกรณ์: 1 UUID = มิเตอร์ 1 ตัว (ไฟ หรือ น้ำ)
// gateway ยิงค่าเข้ามาทาง REST ก่อน → UUID ที่ระบบไม่รู้จักถูกเก็บลง pool
// (unit_id = null) แล้วเจ้าของค่อยเลือกในหน้า ตั้งค่า ว่า UUID ไหนเป็นมิเตอร์
// น้ำ/ไฟ ของห้องไหน

export async function statusForUnit(user, unitId) {
  const _id = oid(unitId);
  const unit = await Units.findOne(tenantFilter(user, { _id }));
  if (!unit) return httpError(404, "no_unit", "ไม่พบห้อง");
  const devs = await Devices.find({ unit_id: _id });
  const out = {};
  for (const d of devs) out[d.kind || "unknown"] = deviceView(d);
  return json({ devices: out });
}

// listPool: อุปกรณ์ที่ gateway เห็นแล้วแต่ยังไม่ถูกผูกกับห้องไหน
export async function listPool(user) {
  const q = { unit_id: null };
  if (user.role !== "platform_admin") {
    q.$or = [{ tenant_id: null }, { tenant_id: oid(user.tid) }];
  }
  const devs = await Devices.find(q, { sort: { "status.last_seen": -1 } });
  return json({ items: devs.map((d) => ({ ...deviceView(d), id: String(d._id), kind: d.kind || null, first_seen: d.first_seen || d.created_at })) });
}

// assignToUnit: ผูก UUID จาก pool เข้ากับห้อง เป็นมิเตอร์ไฟหรือน้ำ
export async function assignToUnit(user, unitId, { uuid, kind }) {
  uuid = String(uuid || "").trim();
  kind = kind === "water" ? "water" : "electric";
  if (!uuid) return httpError(400, "bad_uuid", "เลือกหรือกรอก UUID อุปกรณ์");
  const _id = oid(unitId);
  const unit = await Units.findOne(tenantFilter(user, { _id }));
  if (!unit) return httpError(404, "no_unit", "ไม่พบห้อง");

  const meter = await Meters.findOne({ unit_id: _id, kind });
  if (!meter) return httpError(400, "no_meter", "ห้องนี้ไม่มีมิเตอร์ชนิดนี้");
  const now = new Date();

  const existing = await Devices.findOne({ uuid });
  if (existing && existing.tenant_id && String(existing.tenant_id) !== String(unit.tenant_id) && user.role !== "platform_admin") {
    return httpError(409, "owned", "UUID นี้เป็นของอาคารอื่น");
  }
  if (existing && existing.unit_id && String(existing.unit_id) !== String(_id)) {
    return httpError(409, "in_use", "UUID นี้ถูกผูกกับห้องอื่นแล้ว — ปลดออกก่อน");
  }

  // ปลดตัวเดิมที่ทำหน้าที่นี้ของห้องนี้ กลับเข้า pool
  await Devices.updateOne(
    { unit_id: _id, kind, uuid: { $ne: uuid } },
    { $set: { unit_id: null, meter_id: null, updated_at: now } }
  );

  let dev;
  if (existing) {
    await Devices.updateById(existing._id, { $set: { unit_id: _id, meter_id: meter._id, kind, tenant_id: unit.tenant_id, market_id: unit.market_id, updated_at: now } });
    dev = await Devices.findById(existing._id);
  } else {
    dev = await Devices.insert({
      uuid, kind, tenant_id: unit.tenant_id, market_id: unit.market_id, unit_id: _id, meter_id: meter._id,
      device_type: "meter_node", fw_version: 1, format_version: 1,
      status: { online: false }, first_seen: now, created_at: now, updated_at: now,
    });
  }
  await recordAudit({ user, action: "device.assign", target_type: "unit", target_id: _id, market_id: unit.market_id, target_label: unit.code, detail: { uuid, kind } });
  return json({ ok: true, device: deviceView(dev) });
}

export async function unassignUnit(user, unitId, kind) {
  const _id = oid(unitId);
  const unit = await Units.findOne(tenantFilter(user, { _id }));
  if (!unit) return httpError(404, "no_unit", "ไม่พบห้อง");
  const q = { unit_id: _id };
  if (kind === "water" || kind === "electric") q.kind = kind;
  await Devices.updateOne(q, { $set: { unit_id: null, meter_id: null, updated_at: new Date() } });
  await recordAudit({ user, action: "device.unassign", target_type: "unit", target_id: _id, market_id: unit.market_id, target_label: unit.code, detail: { kind: kind || "all" } });
  return json({ ok: true });
}

// registerDevice: เจ้าของลงทะเบียน UUID ล่วงหน้า (หรือ mock) → เข้า pool ของ tenant ตัวเอง
export async function registerDevice(user, { uuid, kind }) {
  uuid = String(uuid || "").trim();
  kind = kind === "water" ? "water" : kind === "electric" ? "electric" : null;
  if (!uuid) return httpError(400, "bad_uuid", "กรอก UUID อุปกรณ์");
  const dup = await Devices.findOne({ uuid });
  if (dup) return httpError(409, "dup", "UUID นี้มีในระบบแล้ว");
  const now = new Date();
  const dev = await Devices.insert({
    uuid, kind, tenant_id: user.tid ? oid(user.tid) : null, market_id: null, unit_id: null, meter_id: null,
    device_type: "meter_node", fw_version: 1, format_version: 1,
    status: { online: false }, first_seen: now, created_at: now, updated_at: now,
  });
  await recordAudit({ user, action: "device.register", target_type: "device", target_id: dev._id, target_label: uuid, detail: { kind } });
  return json({ ok: true, device: { ...deviceView(dev), kind } }, 201);
}

// updateDeviceKind: แก้ชนิดได้เฉพาะตอนยังไม่ผูกกับห้อง
export async function updateDeviceKind(user, deviceId, kind) {
  kind = kind === "water" ? "water" : "electric";
  const dev = await Devices.findOne({ _id: oid(deviceId) });
  if (!dev) return httpError(404, "no_device", "ไม่พบอุปกรณ์");
  if (dev.tenant_id && user.role !== "platform_admin" && String(dev.tenant_id) !== String(user.tid))
    return httpError(403, "forbidden", "ไม่ใช่อุปกรณ์ของอาคารคุณ");
  if (dev.unit_id) return httpError(409, "in_use", "อุปกรณ์ถูกผูกอยู่ — ปลดก่อนจึงแก้ชนิดได้");
  await Devices.updateById(dev._id, { $set: { kind, updated_at: new Date() } });
  await recordAudit({ user, action: "device.update", target_type: "device", target_id: dev._id, target_label: dev.uuid, detail: { kind } });
  return json({ ok: true });
}

// removeDevice: ลบได้เฉพาะอุปกรณ์ใน pool (ยังไม่ผูก)
export async function removeDevice(user, deviceId) {
  const dev = await Devices.findOne({ _id: oid(deviceId) });
  if (!dev) return httpError(404, "no_device", "ไม่พบอุปกรณ์");
  if (dev.tenant_id && user.role !== "platform_admin" && String(dev.tenant_id) !== String(user.tid))
    return httpError(403, "forbidden", "ไม่ใช่อุปกรณ์ของอาคารคุณ");
  if (dev.unit_id) return httpError(409, "in_use", "อุปกรณ์ถูกผูกกับห้องอยู่ — ปลดออกก่อนจึงลบได้");
  await Devices.deleteById(dev._id);
  await recordAudit({ user, action: "device.delete", target_type: "device", target_id: dev._id, target_label: dev.uuid });
  return json({ ok: true });
}
