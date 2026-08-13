import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongo";

// oid safely converts a string to ObjectId (null when invalid).
export const oid = (s) => {
  if (s instanceof ObjectId) return s;
  try { return new ObjectId(s); } catch { return null; }
};

const hasOp = (u) => u && Object.keys(u).some((k) => k.startsWith("$"));

// makeRepo builds a thin data-access repository (the Model layer) for one
// MongoDB collection. Controllers talk to these instead of touching the driver.
export function makeRepo(name) {
  const col = async () => (await getDb()).collection(name);
  return {
    name,
    col,
    async find(filter = {}, { sort, limit, project } = {}) {
      let q = (await col()).find(filter);
      if (project) q = q.project(project);
      if (sort) q = q.sort(sort);
      if (limit) q = q.limit(limit);
      return q.toArray();
    },
    async findOne(filter, opts) { return (await col()).findOne(filter, opts); },
    async findById(id, opts) { const _id = oid(id); return _id ? (await col()).findOne({ _id }, opts) : null; },
    async insert(doc) { const r = await (await col()).insertOne(doc); return { ...doc, _id: r.insertedId }; },
    async insertMany(docs) { return (await col()).insertMany(docs); },
    async updateById(id, update) { const _id = oid(id); if (!_id) return null; return (await col()).updateOne({ _id }, hasOp(update) ? update : { $set: update }); },
    async updateOne(filter, update) { return (await col()).updateOne(filter, hasOp(update) ? update : { $set: update }); },
    async deleteById(id) { const _id = oid(id); if (!_id) return null; return (await col()).deleteOne({ _id }); },
    async deleteMany(filter) { return (await col()).deleteMany(filter); },
    async count(filter = {}) { return (await col()).countDocuments(filter); },
    async aggregate(pipeline) { return (await col()).aggregate(pipeline).toArray(); },
  };
}
