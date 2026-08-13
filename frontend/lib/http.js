import { NextResponse } from "next/server";
import { userFromReq } from "./auth";

export const json = (data, status = 200) => NextResponse.json(data, { status });
export const httpError = (status, code, message) =>
  NextResponse.json({ error: { code, message } }, { status });

// requireUser returns { user } or { error: NextResponse }
export function requireUser(req, roles) {
  const u = userFromReq(req);
  if (!u) return { error: httpError(401, "unauthorized", "missing or invalid token") };
  if (roles && !roles.includes(u.role)) return { error: httpError(403, "forbidden", "insufficient role") };
  return { user: u };
}
