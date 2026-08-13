import { ObjectId } from "mongodb";
import type { Document, Filter, FindOptions, OptionalUnlessRequiredId, WithId } from "mongodb";
import { getDb } from "@/lib/mongo";

// oid safely converts a string to ObjectId (null when invalid).
export const oid = (s: unknown): ObjectId | null => {
  if (s instanceof ObjectId) return s;
  try { return new ObjectId(s as string); } catch { return null; }
};

const hasOp = (u: Record<string, unknown>) => !!u && Object.keys(u).some((k) => k.startsWith("$"));

// makeRepo builds a thin data-access repository (the Model layer) for one
// MongoDB collection. Controllers talk to these instead of touching the driver.
// T = รูปร่างเอกสารของ collection นั้น (ดู models/types.ts)
//
// ponytail: filter/update รับเป็น Record<string, any> ไม่ใช่ Filter<T> — ตัวกรองในโค้ดนี้
// ประกอบขึ้นแบบไดนามิก (f.tenant_id = ..., q.$or = ...) เหมือนตอนเป็น JS ซึ่ง Filter<T>
// ปฏิเสธ (เช่น oid() คืน ObjectId|null ชน Condition<ObjectId>). ประโยชน์ของการใส่ชนิด
// อยู่ที่ "ผลลัพธ์" (คืน WithId<T> ให้ทุก read) ซึ่งยังได้ครบ
// อัปเกรด: ถ้าอยากให้ filter ถูกตรวจด้วย ให้เปลี่ยนเป็น Filter<T> แล้วไล่แก้จุดที่ประกอบ filter
export function makeRepo<T extends Document = Document>(name: string) {
  const col = async () => (await getDb()).collection<T>(name);
  return {
    name,
    col,
    async find(filter: Record<string, any> = {}, { sort, limit, project }: { sort?: any; limit?: number; project?: Document } = {}): Promise<WithId<T>[]> {
      let q = (await col()).find(filter as Filter<T>);
      if (project) q = q.project(project) as typeof q;
      if (sort) q = q.sort(sort);
      if (limit) q = q.limit(limit);
      return q.toArray();
    },
    async findOne(filter: Record<string, any>, opts?: FindOptions) {
      return (await col()).findOne(filter as Filter<T>, opts);
    },
    async findById(id: unknown, opts?: FindOptions) {
      const _id = oid(id);
      return _id ? (await col()).findOne({ _id } as Filter<T>, opts) : null;
    },
    async insert(doc: OptionalUnlessRequiredId<T>) {
      const r = await (await col()).insertOne(doc);
      return { ...doc, _id: r.insertedId };
    },
    async insertMany(docs: OptionalUnlessRequiredId<T>[]) {
      return (await col()).insertMany(docs);
    },
    async updateById(id: unknown, update: Record<string, any>) {
      const _id = oid(id);
      if (!_id) return null;
      return (await col()).updateOne({ _id } as Filter<T>, (hasOp(update) ? update : { $set: update }) as any);
    },
    async updateOne(filter: Record<string, any>, update: Record<string, any>) {
      return (await col()).updateOne(filter as Filter<T>, (hasOp(update) ? update : { $set: update }) as any);
    },
    async deleteById(id: unknown) {
      const _id = oid(id);
      if (!_id) return null;
      return (await col()).deleteOne({ _id } as Filter<T>);
    },
    async deleteMany(filter: Record<string, any>) {
      return (await col()).deleteMany(filter as Filter<T>);
    },
    async count(filter: Record<string, any> = {}) {
      return (await col()).countDocuments(filter as Filter<T>);
    },
    async aggregate(pipeline: Document[]) {
      return (await col()).aggregate(pipeline).toArray();
    },
  };
}
