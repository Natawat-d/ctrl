export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("akr_token");
}

export function getUser() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem("akr_user") || "null");
  } catch {
    return null;
  }
}

export function getMarketId() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("akr_market");
}
export function setMarketId(id) {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem("akr_market", id);
  else localStorage.removeItem("akr_market");
}
// pickMarket resolves the active site from a list, honoring the saved choice.
export function pickMarket(items) {
  if (!items || !items.length) return null;
  const saved = getMarketId();
  return items.find((x) => String(x._id) === String(saved)) || items[0];
}

// basePath is baked in at build time (NEXT_PUBLIC_*) — required when the app
// is served under a subpath (e.g. /ctrl on the VPS behind nginx).
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

// Same options as fetch, with headers narrowed to plain string pairs so the
// Authorization header can be merged in below.
type ApiOptions = Omit<RequestInit, "headers"> & { headers?: Record<string, string> };

export async function api(path: string, opts: ApiOptions = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(opts.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = "Bearer " + token;
  const res = await fetch(BASE + "/api" + path, { ...opts, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body && body.error && body.error.message) || "HTTP " + res.status);
  return body;
}
