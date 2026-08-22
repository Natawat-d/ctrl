import { MongoClient } from "mongodb";
import type { Db } from "mongodb";

const uri = process.env.MONGO_URI || "mongodb://localhost:27017";
const dbName = process.env.DB_NAME || "akr";

// cache ไว้บน globalThis กัน hot-reload ของ next dev เปิด connection ซ้ำ
type MongoCache = { client: MongoClient | null; db: Db | null; promise: Promise<Db> | null };
declare global {
  var __akrMongo: MongoCache | undefined;
}

const cached: MongoCache = globalThis.__akrMongo ?? (globalThis.__akrMongo = { client: null, db: null, promise: null });

export async function getDb(): Promise<Db> {
  if (cached.db) return cached.db;
  if (!cached.promise) {
    cached.client = new MongoClient(uri);
    cached.promise = cached.client.connect().then((c) => {
      cached.db = c.db(dbName);
      return cached.db;
    });
  }
  return cached.promise;
}
