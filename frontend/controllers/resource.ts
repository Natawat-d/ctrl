import { tenantFilter } from "@/lib/auth";
import { json, httpError, requireUser } from "@/lib/http";
import { makeRepo, oid } from "@/models";
import { recordAudit } from "@/services/audit";

export { oid };

const unitsRepo = makeRepo("units");

// extra is a Mongo filter fragment assembled at runtime (a plain ObjectId for
// units, an { $in: [...] } for the unit-scoped collections) — same Record<string, any>
// shape the repository takes for every filter.
type OccupantScope = { allow: true; extra: Record<string, any> } | { allow: false };

// SEC-3 (IDOR): a tenant_user shares tenant_id with the owner and all 19 other
// renters, so tenantFilter alone gives ZERO isolation. This computes the extra
// per-request Mongo filter that constrains a renter to their OWN units only.
// Returns { allow:false } for any collection a renter may not read at all.
async function occupantScope(coll, user): Promise<OccupantScope> {
  if (coll === "units") {
    return { allow: true, extra: { occupant_user_id: oid(user.uid) } };
  }
  if (coll === "bills" || coll === "meters" || coll === "readings") {
    const rows = await unitsRepo.find(
      { occupant_user_id: oid(user.uid) },
      { project: { _id: 1 } }
    );
    return { allow: true, extra: { unit_id: { $in: rows.map((r) => r._id) } } };
  }
  // zones, devices, markets, payments, … — renters may not list/get these directly.
  return { allow: false };
}

// crud builds standard collection controllers with tenant scoping. Routes stay
// thin HTTP adapters; all data access goes through the Model repository.
export function crud(coll, writeRoles = ["platform_admin", "owner"]) {
  const repo = makeRepo(coll);
  return {
    async list(req) {
      const { user, error } = requireUser(req);
      if (error) return error;
      const f = tenantFilter(user, {});
      const url = new URL(req.url);
      for (const k of ["market_id", "zone_id", "unit_id", "device_id"]) {
        const v = url.searchParams.get(k);
        if (v && oid(v)) f[k] = oid(v);
      }
      // SEC-3: occupant-scope renters to their own units (one units lookup/request).
      if (user.role === "tenant_user") {
        const scope = await occupantScope(coll, user);
        if (!scope.allow) return json({ items: [] });
        for (const [k, cond] of Object.entries(scope.extra)) {
          if (k === "unit_id" && f.unit_id) {
            // client asked for a specific unit_id — honor it only if it's theirs
            const ok = (cond.$in || []).some((x) => String(x) === String(f.unit_id));
            if (!ok) return json({ items: [] });
          } else {
            f[k] = cond; // scope always wins over client-supplied filters
          }
        }
      }
      const items = await repo.find(f, { sort: { created_at: 1 } });
      return json({ items });
    },
    async create(req) {
      const { user, error } = requireUser(req, writeRoles);
      if (error) return error;
      const doc = await req.json();
      delete doc._id;
      if (user.role !== "platform_admin" && user.tid) doc.tenant_id = oid(user.tid);
      doc.created_at = new Date();
      doc.updated_at = new Date();
      const saved = await repo.insert(doc);
      await recordAudit({ user, action: `${coll}.create`, target_type: coll, target_id: saved._id, market_id: doc.market_id, target_label: doc.name || doc.code, after: doc });
      return json(saved, 201);
    },
    async get(req, id) {
      const { user, error } = requireUser(req);
      if (error) return error;
      const filter = tenantFilter(user, { _id: oid(id) });
      // SEC-3: a renter cannot fetch another unit/bill/meter by _id.
      if (user.role === "tenant_user") {
        const scope = await occupantScope(coll, user);
        if (!scope.allow) return httpError(404, "not_found", "not found");
        Object.assign(filter, scope.extra);
      }
      const doc = await repo.findOne(filter);
      if (!doc) return httpError(404, "not_found", "not found");
      return json(doc);
    },
    async update(req, id) {
      const { user, error } = requireUser(req, writeRoles);
      if (error) return error;
      const patch = await req.json();
      delete patch._id;
      delete patch.tenant_id;
      delete patch.created_at;
      patch.updated_at = new Date();
      await repo.updateOne(tenantFilter(user, { _id: oid(id) }), { $set: patch });
      await recordAudit({ user, action: `${coll}.update`, target_type: coll, target_id: id, market_id: patch.market_id, after: patch });
      return json({ ok: true });
    },
    async del(req, id) {
      const { user, error } = requireUser(req, writeRoles);
      if (error) return error;
      await repo.col().then((c) => c.deleteOne(tenantFilter(user, { _id: oid(id) })));
      await recordAudit({ user, action: `${coll}.delete`, target_type: coll, target_id: id });
      return json({ ok: true });
    },
  };
}
