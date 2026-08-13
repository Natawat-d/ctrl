import { AuditLogs, oid } from "@/models";

// recordAudit appends one immutable audit entry: who / what / when / where /
// before->after. Never throws into the caller (audit must not break the action).
// Ref: EnterpriseReady — Audit Log (append-only, who/what/when/where).
export async function recordAudit(entry) {
  try {
    const u = entry.user || {};
    await AuditLogs.insert({
      at: new Date(),
      tenant_id: u.tid ? oid(u.tid) : (entry.tenant_id ? oid(entry.tenant_id) : null),
      actor_id: u.uid || entry.actor_id || null,
      actor_login: u.login_id || entry.actor_login || null,
      actor_role: u.role || entry.actor_role || "system",
      action: entry.action,
      target_type: entry.target_type || null,
      target_id: entry.target_id != null ? String(entry.target_id) : null,
      target_label: entry.target_label || null,
      market_id: entry.market_id ? oid(entry.market_id) : null,
      detail: entry.detail || null,
      before: entry.before ?? null,
      after: entry.after ?? null,
    });
  } catch (e) {
    console.error("[audit]", e.message);
  }
}
