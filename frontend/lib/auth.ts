import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";

// payload ที่เราเซ็นลง token เอง (uid/role/tid) — ไม่ใช่ทุก field ของ jwt
export type JwtUser = { uid: string; role: string; tid: string };

// SEC-1: fail-closed — production ต้องตั้ง JWT_SECRET เสมอ
// เช็คแบบ lazy (ตอนใช้ token จริง) ไม่ใช่ตอน import — เพราะ `next build` รันด้วย
// NODE_ENV=production โดยยังไม่มี env (inject ตอน runtime) ถ้า throw ตอน load จะทำ build พัง
let _warned = false;
function getSecret(): string {
  const s = process.env.JWT_SECRET;
  if (s && s.length > 0) return s;
  if (process.env.NODE_ENV === "production") {
    // กัน prod รันด้วย default ที่เปิดในซอร์ส → ปลอม token เป็น admin ได้
    throw new Error("JWT_SECRET must be set in production (fail-closed)");
  }
  if (!_warned) { console.warn("[auth] JWT_SECRET ไม่ได้ตั้ง — ใช้ dev default (ห้ามใช้บน production)"); _warned = true; }
  return "dev-secret-change-me";
}

export function signToken(user: { _id: ObjectId; role: string; tenant_id?: ObjectId | null }): string {
  return jwt.sign(
    { uid: user._id.toString(), role: user.role, tid: user.tenant_id ? user.tenant_id.toString() : "" },
    getSecret(),
    { expiresIn: "24h" }
  );
}

export function verifyToken(t: string): JwtUser | null {
  try {
    return jwt.verify(t, getSecret()) as JwtUser;
  } catch {
    return null;
  }
}

export function hashPassword(p: string): string {
  return bcrypt.hashSync(p, 10);
}

export function checkPassword(p: string, h?: string | null): boolean {
  return bcrypt.compareSync(p, h || "");
}

export function userFromReq(req: Request): JwtUser | null {
  const a = req.headers.get("authorization") || "";
  if (!a.startsWith("Bearer ")) return null;
  return verifyToken(a.slice(7));
}

export function tenantFilter(user: JwtUser | null, base: Record<string, any> = {}): Record<string, any> {
  if (user && user.role !== "platform_admin" && user.tid) {
    try {
      base.tenant_id = new ObjectId(user.tid);
    } catch {}
  }
  return base;
}
