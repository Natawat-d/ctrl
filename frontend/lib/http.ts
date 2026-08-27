import { NextResponse } from "next/server";
import { userFromReq, type JwtUser } from "./auth";

// ctx ของ route ที่มี [id] — ใช้ซ้ำใน route handler ~20 ไฟล์
export type IdCtx = { params: { id: string } };

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const httpError = (status: number, code: string, message: string) =>
  NextResponse.json({ error: { code, message } }, { status });

// requireUser คืน { user } หรือ { error } อย่างใดอย่างหนึ่งเสมอ — เขียนเป็น union
// ที่มี `?: never` ฝั่งตรงข้าม เพื่อให้ `if (error) return error;` narrow ให้ user
// ไม่เป็น undefined ต่อจากนั้นได้ (ผู้เรียกทุกที่ใช้ pattern นี้)
type AuthResult =
  | { user: JwtUser; error?: never }
  | { user?: never; error: NextResponse };

export function requireUser(req: Request, roles?: string[]): AuthResult {
  const u = userFromReq(req);
  if (!u) return { error: httpError(401, "unauthorized", "missing or invalid token") };
  if (roles && !roles.includes(u.role)) return { error: httpError(403, "forbidden", "insufficient role") };
  return { user: u };
}
