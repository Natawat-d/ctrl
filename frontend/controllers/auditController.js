import { AuditLogs, Users, Markets, oid } from "@/models";

// listAudit returns audit rows scoped by role (owner: own tenant; admin: all),
// with actor + site names resolved for display. Read-only; entries are never
// mutated. Ref: EnterpriseReady — Audit Log.
export async function listAudit(user, url) {
  const f = {};
  if (user.role !== "platform_admin" && user.tid) f.tenant_id = oid(user.tid);
  const market = url.searchParams.get("market_id");
  if (market && oid(market)) f.market_id = oid(market);
  const action = url.searchParams.get("action");
  if (action) f.action = { $regex: "^" + action.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") };
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (from || to) {
    f.at = {};
    if (from) f.at.$gte = new Date(from);
    if (to) f.at.$lte = new Date(to + "T23:59:59.999");
  }
  const limit = Math.min(Number(url.searchParams.get("limit")) || 300, 2000);
  const items = await AuditLogs.find(f, { sort: { at: -1 }, limit });

  const uids = [...new Set(items.map((i) => i.actor_id).filter(Boolean))].map(oid).filter(Boolean);
  const users = uids.length ? await Users.find({ _id: { $in: uids } }, { project: { login_id: 1, display_name: 1 } }) : [];
  const umap = Object.fromEntries(users.map((u) => [String(u._id), u.login_id || u.display_name]));
  const mids = [...new Set(items.map((i) => i.market_id).filter(Boolean).map(String))].map(oid).filter(Boolean);
  const markets = mids.length ? await Markets.find({ _id: { $in: mids } }, { project: { name: 1 } }) : [];
  const mmap = Object.fromEntries(markets.map((m) => [String(m._id), m.name]));

  return items.map((i) => ({
    _id: i._id, at: i.at, action: i.action,
    actor_name: i.actor_login || umap[String(i.actor_id)] || "(system)",
    actor_role: i.actor_role,
    target_type: i.target_type, target_label: i.target_label, target_id: i.target_id,
    market_name: i.market_id ? mmap[String(i.market_id)] || "" : "",
    detail: i.detail,
  }));
}

export function auditCsv(rows) {
  const esc = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const head = ["เวลา", "ผู้กระทำ", "บทบาท", "การกระทำ", "เป้าหมาย", "สาขา", "รายละเอียด"];
  const lines = [head.map(esc).join(",")];
  for (const r of rows) {
    lines.push([
      new Date(r.at).toISOString(),
      r.actor_name, r.actor_role, r.action,
      `${r.target_type || ""} ${r.target_label || r.target_id || ""}`.trim(),
      r.market_name,
      r.detail ? JSON.stringify(r.detail) : "",
    ].map(esc).join(","));
  }
  return "﻿" + lines.join("\r\n"); // BOM for Excel Thai
}
