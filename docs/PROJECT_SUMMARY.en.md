# 📋 CTRL — Project Summary (Frontend + Server)

> **Smart Submetering + Billing platform** — per-unit / per-stall water & electricity monitoring with automated monthly billing.
> This document covers **only the web application (frontend) and server (API/DB)** — hardware is out of scope.
> Repo: <https://github.com/Natawat-d/ctrl> · Live: <http://147.50.254.104/ctrl>

---

## Table of Contents
1. [Overview](#1-overview)
2. [Technology Stack](#2-technology-stack)
3. [Architecture](#3-architecture-layered--redux)
4. [Data Model](#4-data-model-mongodb-collections)
5. [Roles & Authentication](#5-roles--authentication)
6. [REST API Reference](#6-rest-api-reference)
7. [Telemetry Ingestion](#7-telemetry-ingestion)
8. [Billing Engine](#8-billing-engine)
9. [Security Hardening](#9-security-hardening)
10. [Frontend Pages](#10-frontend-pages)
11. [Deployment](#11-deployment)
12. [Local Development](#12-local-development)
13. [Glossary of Fix IDs](#13-glossary-of-fix-ids)

---

## 1. Overview

CTRL is a **single Next.js application** that serves as both the **frontend and the backend**.
Using the Next.js **App Router**, the UI is rendered by React while the API is implemented as
**Route Handlers** (`app/api/**/route.js`) inside the same project — one codebase, one deployable container.

**Core responsibilities:**
- **Ingest meter telemetry** from field gateways / pollers over **REST** and persist it to MongoDB.
- **Monitor** water & electricity consumption per unit/stall in near real-time.
- **Generate monthly bills** automatically from measured readings and manage payments.
- **Enforce multi-tenant isolation** across three roles: platform admin, site owner, and tenant (renter).

> **CTRL web pivot (scope note):** The web app is intentionally scoped to **monitoring + billing only**.
> Telemetry arrives via **REST ingest**. There is **no water/electricity cut-off feature** and the app
> **does not use MQTT** on its live data path — although a Mosquitto service is still present in
> `docker-compose.yml` as a leftover, it is not part of the active flow.

---

## 2. Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | **Next.js 14** (App Router, `output: "standalone"`) |
| Language | JavaScript (ESM modules) |
| UI | React 18 + **Redux Toolkit** (`@reduxjs/toolkit`, `react-redux`) |
| Database | **MongoDB** (official `mongodb` driver — no ODM/Mongoose) |
| Authentication | **JWT** (`jsonwebtoken`) + **bcryptjs** password hashing |
| Email | `nodemailer` (forgot-password reset links) |
| Reverse proxy | **Caddy 2** |
| Orchestration | Docker Compose |
| Timezone | `Asia/Bangkok` |

**npm scripts** (`frontend/package.json`, package name `akr`):

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `next dev -p 3000` | Local dev server |
| `build` | `next build` | Production build (standalone output) |
| `start` | `next start -p 3000` | Serve production build |
| `seed` | `node scripts/seed.mjs` | Seed sample data into MongoDB |
| `mock` | `node scripts/espmock.mjs` | Simulate a gateway pushing telemetry to `/api/ingest` |

**Dependencies:** `next`, `react`, `react-dom`, `@reduxjs/toolkit`, `react-redux`, `mongodb`, `jsonwebtoken`, `bcryptjs`, `nodemailer`. (No production build tooling beyond Next itself; `devDependencies` is empty.)

---

## 3. Architecture (Layered + Redux)

The codebase is split into clear layers. **Route handlers are thin HTTP adapters**; business logic lives in
controllers, and **all data access flows through the model layer** — routes never touch MongoDB directly.

```
app/api/**/route.js   ── HTTP adapter: parse request → call controller → return json()
        │
        ▼
controllers/*.js      ── Business logic: auth checks, tenant scoping, validation
        │
        ├─► models/           ── One repository per collection (makeRepo)
        ├─► services/         ── ingest / audit / notify
        └─► lib/              ── auth, mongo, http, device, labels, api

store/  (Redux)       ── Client-side state (authSlice, marketSlice)
```

**Rule of thumb:** New code must sit in the correct layer. Every data access goes through `models/`
(never issue Mongo queries directly from a route handler).

### `frontend/` directory map

| Directory | Responsibility |
|-----------|----------------|
| `app/` | Pages (React) **and** `app/api/` REST endpoints |
| `components/` | Shared React components |
| `controllers/` | Domain business logic (see below) |
| `models/` | `index.js` (repository registry) + `repository.js` (`makeRepo`, `oid`) |
| `services/` | `ingest.js` · `audit.js` · `notify.js` |
| `lib/` | `auth.js` · `mongo.js` · `http.js` · `device.js` · `labels.js` · `api.js` |
| `store/` | Redux: `authSlice` · `marketSlice` · `Provider` · `hooks` · `index` |
| `scripts/` | `seed.mjs` (seed data) · `espmock.mjs` (mock gateway) |
| `public/` | Static assets (background SVGs, logo) |
| `instrumentation.js` | Next.js instrumentation hook (startup side-effects) |

### Controllers

| File | Domain |
|------|--------|
| `authController.js` | Login, signup, verify, password reset |
| `adminController.js` | Platform-admin operations, owner management |
| `siteController.js` | Markets / zones / units management |
| `unitController.js` | Unit detail, readings, device binding, summary |
| `billingController.js` | Bill generation, usage calculation |
| `deviceController.js` | Devices, device pool, meter binding |
| `reportController.js` | Reports & CSV export |
| `auditController.js` | Audit-log read access |
| `resource.js` | Generic CRUD factory with tenant + occupant scoping |

### Model layer

`models/index.js` exposes one `makeRepo("<collection>")` repository per collection.
`repository.js` provides the shared repository implementation plus the `oid()` helper
(safe `ObjectId` coercion). Controllers import these repositories; they do not import the Mongo client directly.

`lib/mongo.js` holds a **cached singleton connection** (memoized on `globalThis.__akrMongo`) so hot-reload
and serverless invocations reuse one client. Database defaults: URI `mongodb://localhost:27017`, DB name `akr`
(overridable via `MONGO_URI` / `DB_NAME`).

---

## 4. Data Model (MongoDB collections)

Declared in `models/index.js` — one repository per collection:

| Collection | Contents |
|-----------|----------|
| `users` | Accounts + `role` + `tenant_id` |
| `tenants` | Organizations / site owners — the multi-tenant boundary |
| `markets` | Markets / projects (a "site") |
| `zones` | Zones / floors within a site |
| `units` | Rooms / stalls; `occupant_user_id` links the assigned renter |
| `meters` | Meters (water/electric) bound to a unit |
| `devices` | Gateway/meter devices; unbound UUIDs live in a **pool** |
| `readings` | Time-series measured values (telemetry) |
| `bills` | Per-cycle bills |
| `payments` | Payments (with verify/reject workflow) |
| `credits` | Credits / carried-over balances |
| `notifications` | User notifications |
| `control_events` | Device event log |
| `device_commands` | Commands queued to devices |
| `audit_logs` | Immutable record of privileged actions |

**Key relationships:** `tenant → markets → zones → units → meters → readings`; a `unit` carries an
`occupant_user_id` (the renter), which is central to per-renter data isolation (see §5).

---

## 5. Roles & Authentication

### Roles

| Role | Scope |
|------|-------|
| `platform_admin` | Platform operator — sees all sites; may view owner passwords |
| `owner` | Site owner — manages units/meters/bills within their own tenant |
| `tenant_user` | Renter — may see **only their own unit(s)** |

### Authentication flow (`lib/auth.js`)

- **Login** issues a **JWT** with payload `{ uid, role, tid }` (`tid` = tenant id), expiring in **24 hours**.
- Passwords are hashed with **bcrypt** (cost factor 10) via `hashPassword` / `checkPassword`.
- `signToken`, `verifyToken`, `userFromReq` handle token lifecycle; `verifyToken` returns `null` on any
  failure (never throws to the caller).

### Fail-closed secret handling (SEC-1)

`getSecret()` reads `JWT_SECRET` **lazily at request time**, not at module load:

- If `JWT_SECRET` is set → use it.
- If missing **and** `NODE_ENV === "production"` → **throw** (`"JWT_SECRET must be set in production (fail-closed)"`).
  This prevents production from silently running on the source-visible dev default, which would let anyone forge an admin token.
- If missing in development → warn once and fall back to `"dev-secret-change-me"`.

> The check is **lazy on purpose**: `next build` runs with `NODE_ENV=production` before runtime env vars are
> injected. Throwing at import time would break the build, so the guard fires only when a token is actually used.

### Tenant & occupant scoping

- **Multi-tenant scoping:** Every query is automatically filtered by `tenant_id` via `tenantFilter`.
- **Occupant scoping (SEC-3, IDOR defense):** A `tenant_user` shares `tenant_id` with the owner and every
  other renter, so `tenantFilter` alone provides *zero* isolation between renters. `occupantScope(coll, user)`
  in `controllers/resource.js` adds a per-request Mongo filter:
  - `units` → constrained to `{ occupant_user_id: <this user> }`.
  - `bills` / `meters` / `readings` → constrained to units the user occupies (`unit_id ∈ their units`).
  - `zones`, `devices`, `markets`, `payments`, … → renters may **not** list/get these directly (`allow: false`).

### Forgot password

Owners can request a **reset link by email** (`nodemailer`). The flow (`api/auth/forgot` → `api/auth/reset`)
is implemented in code; wiring a real SMTP credential is the only remaining step.

---

## 6. REST API Reference

~43 route handlers under `app/api/`, grouped by domain.

### Auth — `api/auth/`
`login` · `signup` · `me` · `verify` · `forgot` · `reset`

### Telemetry ingest
`ingest` (POST) — see [§7](#7-telemetry-ingestion).

### Resource CRUD (tenant-scoped)
Each supports list/create plus an `[id]` handler for get/update/delete:

`markets` · `zones` · `units` · `meters` · `devices` · `tenants` · `users`

Nested / specialized:
- `markets/[id]/overview` — site dashboard aggregate
- `markets/[id]/bills/generate` — generate all bills for a cycle
- `markets/[id]/export/csv` — CSV export
- `units/[id]/summary` · `units/[id]/readings` · `units/[id]/device`
- `devices/pool` — unbound devices awaiting assignment

### Bills & payments
- `bills` · `bills/[id]` · `bills/[id]/payments`
- `payments` · `payments/[id]/verify` · `payments/[id]/reject`

### Admin & reporting
- `admin/overview` · `admin/health` · `admin/owners` (+ `[id]`)
- `reports` · `audit` · `me`

All handlers return JSON via `lib/http.js` helpers (`json`, `httpError`, `requireUser`).

---

## 7. Telemetry Ingestion

Gateways/pollers push telemetry **one meter at a time** to `POST /api/ingest`
(implemented in `services/ingest.js` — there is no MQTT broker on this path).

**Payload shape:**
```json
{
  "uuid": "meter-uuid",
  "kind": "electric",
  "ts": 1785708000,
  "data": { "kwh": 123.4, "v": 220, "a": 5, "w": 1100, "pf": 0.98, "hz": 50 }
}
```
Water meters send `"kind": "water"` with `data: { "m3": ..., "flow_lpm": ... }`.

**Routing logic:**
- **Unknown UUID** → registered into the **device pool** with `unit_id = null`, awaiting the owner to bind it
  on the settings page.
- **Bound UUID** → the value is written to the `readings` collection for that meter.

**Timestamp parsing — `parseTs(raw, fallback)`** handles every format firmware/gateways send in practice:
- `number < 2e10` → treated as **seconds**, ×1000; `number ≥ 2e10` → treated as **milliseconds** as-is.
- Numeric string (`"1785708000"`) → same seconds/ms heuristic.
- ISO string (`"2026-08-02T10:00:00Z"`) → `Date.parse`.
- **Guard (PIPE-1 fix):** any result earlier than `2000-01-01` (e.g. seconds misread as ms, collapsing to 1970)
  falls back to `fallback` — preventing corrupt timestamps that a TTL index would then delete.

**Live stats:** `ingestStatus()` reports a rolling window — `total_ingested`, `last_ingest`,
`msgs_last_min`, `msgs_last_5min`, `rate_per_sec` (transport reported as `"rest"`).

**Security:** ingest is **fail-closed** (SEC-4) — a valid ingest key is required before any data is accepted.

---

## 8. Billing Engine

- **Usage** per meter = latest reading − cycle-start reading.
- **BILL-1 fix (`calcUsage`):** correctly handles meter resets and sparse/gapped readings so it no longer
  returns 0 incorrectly when readings are missing or the counter rolled over.
- **Generate per site in one call:** `POST /api/markets/[id]/bills/generate`.
- **Cycle validation** guards against overlapping or malformed billing periods.
- **CSV export:** `GET /api/markets/[id]/export/csv`.
- Payment lifecycle: create → **verify** or **reject**, with ownership checks (BILL-3, see §9).

---

## 9. Security Hardening

| ID | Hardening |
|----|-----------|
| **SEC-1** | JWT fail-closed — production without `JWT_SECRET` is rejected (blocks forged admin tokens) |
| **SEC-2** | `users/[id]` constrained to the caller's tenant scope |
| **SEC-3** | Occupant scoping (IDOR defense) — renters only ever see their own units/bills/meters/readings |
| **SEC-4** | Ingest fail-closed — a valid key is required |
| **BILL-3** | Payment verify/reject checks resource ownership first |
| — | Rate limiting + billing-cycle validation |

Every privileged action is written to `audit_logs` via `services/audit.js` (`recordAudit`), making the
system **auditable** end to end.

---

## 10. Frontend Pages

| Route | Purpose |
|-------|---------|
| `login` · `signup` · `forgot` · `reset` | Auth: sign in / register / forgot & reset password |
| `dashboard` | Consumption overview |
| `units` · `units/[id]` | Unit list + unit detail (with readings) |
| `bills` | Bills |
| `tenants` | Tenants / renters |
| `reports` | Reports |
| `settings` | Settings + bind devices from the pool |
| `me` | User profile |
| `admin` | Platform-admin console |
| `audit` | Audit log viewer |
| `terms` | Terms of service |

---

## 11. Deployment

**Docker Compose** (`docker-compose.yml`) — four services:

| Service | Image | Ports | Notes |
|---------|-------|-------|-------|
| `mongo` | `mongo:7` | 27017 | Persistent volume `mongo_data` |
| `mqtt` | `eclipse-mosquitto:2` | 1883 / 9001 | Leftover — **not on the live data path** |
| `web` | build `./frontend` | 3000 | The Next.js app |
| `caddy` | `caddy:2` | 80 | Reverse proxy (`infra/Caddyfile`) |

**Production VPS:** live at `http://147.50.254.104/ctrl`, sitting behind **Caddy**.
Caddy path matching is **case-insensitive**, so `/CTRL` and `/ctrl` resolve to the same app.

**Sub-path hosting (`basePath`):** `next.config.mjs` enables `basePath` conditionally from
`NEXT_PUBLIC_BASE_PATH`, which is **baked in at build time**. Because CSS `url("/x.svg")` references would
404 under a sub-path, the layout injects CSS variables so assets resolve correctly. `output: "standalone"`
produces a self-contained server bundle for the container.

**Key environment variables:**
```
MONGO_URI                 mongodb://mongo:27017
DB_NAME                   akr
JWT_SECRET                ← REQUIRED in production (fail-closed)
TZ                        Asia/Bangkok
NEXT_PUBLIC_BASE_PATH     /ctrl        # only when hosted under a sub-path
# SMTP settings for forgot-password email — pending real credentials
```

---

## 12. Local Development

```bash
cd frontend
npm install
npm run seed      # first run: seed sample data (requires a running MongoDB)
npm run dev       # http://localhost:3000
npm run mock      # separate terminal: simulate a gateway posting telemetry to /api/ingest
```

Minimum: a reachable MongoDB (`MONGO_URI`). In development `JWT_SECRET` is optional (falls back to a dev
default with a warning); in production it is mandatory.

---

## 13. Glossary of Fix IDs

| ID | Meaning |
|----|---------|
| **SEC-1** | JWT fail-closed secret handling |
| **SEC-2** | Tenant-scoped `users/[id]` access |
| **SEC-3** | Occupant scoping / IDOR defense for renters |
| **SEC-4** | Fail-closed telemetry ingest |
| **BILL-1** | `calcUsage` correctness on meter reset / sparse readings |
| **BILL-3** | Ownership check on payment verify/reject |
| **PIPE-1** | Timestamp parsing guard (no 1970 corruption) |

---

*Last updated: Aug 2026 · Derived from the actual source in `frontend/`.*
