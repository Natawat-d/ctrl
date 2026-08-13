import { MongoClient } from "mongodb";

const uri = process.env.MONGO_URI || "mongodb://localhost:27017";
const dbName = process.env.DB_NAME || "akr";

let cached = globalThis.__akrMongo;
if (!cached) cached = globalThis.__akrMongo = { client: null, db: null, promise: null };

export async function getDb() {
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
