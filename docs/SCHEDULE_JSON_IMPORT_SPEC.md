# Schedule JSON Import — Specification (Phase 11)

- **Repo:** `NhatNguyenYn/Base-Porfolio-Website-Demo`
- **Date:** 2026-11-14
- **Status:** Spec — website-side importer only. No Muse integration is implemented in this phase (master prompt §1, §14).
- **Binding decisions:** `~/workspace/base-portfolio-review/phase-11-audit.md` D1–D12. Where this spec and the audit brief disagree, the audit brief wins; any deviation is listed in §12.
- **Related docs:** `docs/PHASE_11_SCHEDULE_IMPORT_REPORT.md` (implementation report, draft), `docs/PHASE_10_CUSTOM_SURVEY_REPORT.md` §K (Phase 11 readiness touchpoints), `~/workspace/base-portfolio-review/phase-11-master-prompt.md` (§3–§11, §13).

## 1. Purpose and scope

An external AI assistant (in the future, Muse) reads a customer's Excel
schedule, converts it into the JSON format defined in §2, and submits that
JSON to the website. The website validates the JSON, converts VN wall-clock
date/time to UTC, and creates or updates calendar entries in the existing
Phase 10 booking calendar — it does **not** create a competing calendar
(D9, master prompt §8).

In scope for Phase 11 (website side only):

- A manual JSON paste/import interface for administrators at
  `/admin/schedule-import` (D8).
- A secure machine-to-machine API endpoint
  `POST /api/integrations/schedules/import` (D7).
- A generic `ImportedSchedule` model, separate from `Booking` /
  `BookingSlot` (D1). Imported schedules carry title/description/location/
  note and **no contact information**; they are never bookings.
- Import preview, idempotent apply, per-record import history (D5, D6, D10).
- A read-only "Lịch sắp tới" (Upcoming schedule) section on the existing
  public booking page (D9).

Out of scope for Phase 11:

- Muse integration itself (no connector, no Excel reader, no agent — master
  prompt §1, §10: "Do not create a fake Muse connector").
- A standalone schedule-management platform; a new public calendar route;
  a new public JSON endpoint for imported schedules (D9 — a future public
  feed is a backlog item, §11.3).
- Email sending, notifications on import, changes to admin access (D11).
- Overnight schedules (§3.3 — not supported in v1).

## 2. JSON schema

### 2.1 Envelope

Validated by a Zod v4 schema in `src/lib/schedule-import-schema.ts`
(`scheduleImportEnvelopeSchema`); limits live in
`src/lib/schedule-import-limits.ts` (D4). The input is JSON data only —
never executable code (master prompt §3).

| Field | Type | Required | Rules |
|---|---|---|---|
| `type` | string | Yes | Must be exactly `"schedule_import"`. Any other value is rejected. |
| `version` | string | Yes | Must be exactly `"1.0"`. Only version `1.0` is accepted in v1. |
| `source` | string | Yes | Free-form source label, e.g. `"external_agent"`. Stored on the `ScheduleImport` row (D1). Trimmed, 1–128 characters (`MAX_IMPORT_SOURCE_LENGTH`). |
| `generatedAt` | string | Yes | ISO 8601 datetime **with an offset**, e.g. `"2026-11-14T10:30:00+07:00"` or `"2026-11-14T03:30:00Z"`. As-built (`src/lib/schedule-import-schema.ts:100`): `z.iso.datetime({ offset: true })` — both `Z` and `+07:00` are accepted, but a naive datetime with no offset is rejected. |
| `schedules` | array | Yes | Array of schedule objects (§2.2). Maximum `MAX_IMPORT_SCHEDULES = 500` entries (D4). No minimum: an empty array is accepted and applies as a zero-record import (a `ScheduleImport` row with all counts 0 and no items). |
| `importId` | string | No | Optional idempotency key, ≤ 128 characters (D6). When present it is trimmed and must be non-empty — an empty string is rejected, not treated as absent. See §8. |
| `preview` | boolean | No | **API-only.** `true` = preview only, no writes (§6.3). Not part of the stored envelope; the manual admin UI has its own preview step (D8). |

### 2.2 Schedule object

Validated by `scheduleImportScheduleSchema` (D4).

| Field | Type | Required | Rules |
|---|---|---|---|
| `id` | string | Yes | Stable external identifier, ≤ 128 characters. Must be **stable across imports** — the same Excel row must always produce the same `id`. Never use Excel row numbers as identifiers (master prompt §5). Scoped per connection (§7.2). |
| `title` | string | Yes | 1–200 characters. |
| `date` | string | Yes | `YYYY-MM-DD`, a real calendar date. |
| `start` | string | Yes | `HH:mm` (24-hour VN wall-clock). |
| `end` | string | Yes | `HH:mm` (24-hour VN wall-clock). Must be after `start` on the same `date` (§3.3). |
| `description` | string | No | ≤ 2000 characters. Defaults to `""`. |
| `status` | string | No | One of `scheduled`, `confirmed`, `completed`, `cancelled` (D2). Defaults to `scheduled` when omitted. |
| `location` | string | No | ≤ 200 characters. Defaults to `""`. |
| `note` | string | No | ≤ 2000 characters. Defaults to `""`. |

No other fields are accepted as meaningful input. Unknown fields are
ignored by validation (they are not stored); no field in the payload can
set server-owned data — there is nothing server-owned on
`ImportedSchedule` besides its internal `id`, `connectionId`, timestamps,
and the UTC `startsAt`/`endsAt` derived from `date` + `start`/`end` (D5).
Trimming (as-built, `src/lib/schedule-import-schema.ts`): `id`, `title`,
`date`, `start`, `end`, `source`, and `importId` are trimmed;
`description`, `location`, and `note` are **not** trimmed, only
length-capped. The API-only `preview` flag is accepted by the shared
envelope schema, so a pasted manual-import JSON containing
`"preview": true` still parses — but the manual admin actions ignore the
flag entirely (preview/apply is chosen by the button clicked, §6.5), so
it has no effect there.

### 2.3 Example request (master prompt §4, verbatim shape)

```json
{
  "type": "schedule_import",
  "version": "1.0",
  "source": "external_agent",
  "generatedAt": "2026-11-14T10:30:00+07:00",
  "schedules": [
    {
      "id": "EXCEL-001",
      "title": "Customer Consultation",
      "date": "2026-11-15",
      "start": "09:00",
      "end": "10:00",
      "description": "Customer consultation",
      "status": "confirmed",
      "location": "",
      "note": ""
    }
  ]
}
```

A multi-record example with the optional fields:

```json
{
  "type": "schedule_import",
  "version": "1.0",
  "source": "external_agent",
  "generatedAt": "2026-11-14T10:30:00+07:00",
  "importId": "weekly-import-2026-11-16",
  "schedules": [
    {
      "id": "EXCEL-001",
      "title": "Customer Consultation",
      "date": "2026-11-15",
      "start": "09:00",
      "end": "10:00",
      "description": "Customer consultation",
      "status": "confirmed",
      "location": "Room A",
      "note": "First session"
    },
    {
      "id": "EXCEL-002",
      "title": "Follow-up Call",
      "date": "2026-11-16",
      "start": "14:00",
      "end": "14:30",
      "status": "scheduled"
    }
  ]
}
```

## 3. Date/time conventions

### 3.1 Timezone

- Default (and only) timezone in v1: `Asia/Ho_Chi_Minh`
  (`VN_TIME_ZONE` in `src/lib/booking-time.ts`).
- `date` + `start` and `date` + `end` are **VN wall-clock** values. They
  are converted to UTC with the existing `vnLocalToUtc("YYYY-MM-DD",
  "HH:MM") → Date | null` (D3). Do not write a new converter.
- The reverse conversion for display uses the existing
  `utcToVnLocalParts` / `formatVnDateTime` from the same module.
- Stored `ImportedSchedule.startsAt` / `endsAt` are UTC `DateTime`
  values. All display (admin calendar, public "Lịch sắp tới" section)
  renders them back in VN time.

### 3.2 Invalid dates and times

- `vnLocalToUtc` returning `null` (impossible date such as `2026-02-30`,
  impossible time such as `25:00`, or a non-round-tripping value) is a
  validation failure: the whole request is rejected with
  `400 VALIDATION_FAILED` (§9) and nothing is written (D5).
- `end <= start` on the same date is a validation failure, same handling.

### 3.3 Overnight schedules — NOT supported in v1

An event whose end time is on the next calendar day (e.g. `start 23:00`,
`end 01:00`) is **rejected** as `end <= start` (D3). There is no
overnight flag, no `endDate` field, and no cross-midnight interpretation
in v1. If a customer's Excel sheet contains an overnight entry, the
importing agent must split it into two same-day entries (or leave it out
and flag it to the customer) — the website will not guess. Supporting
overnight schedules is a post-launch backlog item (§11.3).

## 4. Data model (D1)

Additive migration only; no `Json` columns (repo convention); no existing
table is altered destructively.

### 4.1 `IntegrationConnection`

One row per external agent/customer connection. A connection is the
unit of authentication and of schedule ownership (§7).

| Field | Type | Notes |
|---|---|---|
| `id` | String, cuid | Primary key. |
| `name` | String | Human-readable connection name (shown in admin + audit summaries). |
| `tokenHash` | String, `@unique` | SHA-256 of the Bearer token. The raw token is never stored (D7). |
| `autoApply` | Boolean, `@default(false)` | When `true`, the connection may apply imports without manual approval (§10.2). Default off: preview first. **As-built, this field is display-only in v1: no code path reads it** (the route and engine never check it) and there is **no admin UI or server action to change it** — `createIntegrationConnection` always stores the default `false`. §10.2 is therefore a procedural rule for the future agent, not an enforced setting; enabling it per connection is a follow-up, not a v1 capability. |
| `isActive` | Boolean, `@default(true)` | Revocation sets this to `false`; a revoked/inactive connection gets `403 FORBIDDEN` (§9). |
| `lastUsedAt` | DateTime? | Updated on successful authentication (D7). |
| `createdAt` / `updatedAt` | DateTime | Standard timestamps. |

### 4.2 `ImportedSchedule`

The generic imported calendar entry. Deliberately **not** a `Booking` or
`BookingSlot` row (D1): `Booking` requires name + email (`NOT NULL`) and
`BookingSlot` has `@@unique([serviceId, startsAt])`, which would collide
with real slots; status `scheduled` has no booking attached.

| Field | Type | Notes |
|---|---|---|
| `id` | String, cuid | Internal primary key. Never exposed as the import identity. |
| `connectionId` | String? (**nullable** — D1 deviation, see below) | Owning connection (`IntegrationConnection`, `onDelete: Restrict`), or `null` for the manual-admin scope. |
| `externalId` | String | The payload `id` (§2.2), stable across imports. |
| `title` | String | From payload. |
| `description` | String, `@default("")` | From payload. |
| `location` | String, `@default("")` | From payload. |
| `note` | String, `@default("")` | From payload. |
| `startsAt` | DateTime | UTC, derived from `date` + `start` (§3.1). |
| `endsAt` | DateTime | UTC, derived from `date` + `end` (§3.1). |
| `status` | String | `scheduled` \| `confirmed` \| `completed` \| `cancelled` (D2). |
| `createdAt` / `updatedAt` | DateTime | Standard timestamps. |

Constraints: `@@unique([connectionId, externalId])` (the idempotency /
matching backstop, D5); `@@index([connectionId, startsAt])`;
`@@index([status, startsAt])`. Relation connection → schedules is
`onDelete: Restrict` — revoking a connection never deletes its history,
and connection delete is **not offered** in the v1 UI (D1).

**D1 deviation — `connectionId` is nullable.** D1 wrote
`connectionId String` (non-null), but the manual-admin scope is `null`
(D5: "null connection = manual scope"), and a null scope cannot be
stored in a non-null column — so as-built it is `String?`
(`prisma/schema.prisma:833`, with the deviation noted in a comment at
`:828–832`), and the relation is optional
(`IntegrationConnection?`). Consequence: Postgres treats NULLs as
distinct, so `@@unique([connectionId, externalId])` does **not** fire
for manual-scope rows. The migration
(`prisma/migrations/20261114092518_phase11_schedule_import/migration.sql`)
adds a partial unique index as the manual-scope backstop:
`ImportedSchedule_manual_externalId_key` — `UNIQUE ("externalId")
WHERE "connectionId" IS NULL` — so a concurrent duplicate manual import
still fails with P2002, which the engine surfaces as `409
CONCURRENT_IMPORT` (§7.5). Manual-scope rows therefore still cannot
duplicate an `externalId`, exactly like API-scope rows.

### 4.3 `ScheduleImport`

One row per import run (manual or API), for the history view (D10).

| Field | Type | Notes |
|---|---|---|
| `id` | String, cuid | Primary key; this is the `importId` returned in API responses. |
| `connectionId` | String? | `null` = manual admin import. |
| `source` | String | Envelope `source`, or `"admin-manual"` for manual imports (D8). |
| `status` | String | `completed` \| `completed_with_errors` \| `failed`. **As-built, the engine only ever writes `completed` or `completed_with_errors`** (`src/server/schedule-import/engine.ts:321`); `failed` exists in the enum/comment only and is never produced by any v1 code path — a whole-request failure is rejected before apply, so no `ScheduleImport` row is created at all (§7.1). |
| `totalRecords` / `createdCount` / `updatedCount` / `unchangedCount` / `cancelledCount` / `failedCount` | Int | Per-action counts (§7.1). |
| `importKey` | String? | Envelope `importId` (D6). `@@unique([connectionId, importKey])`; Postgres treats NULLs as distinct, so manual imports (null key) never collide on this. |
| `payloadHash` | String? | SHA-256 of the canonical JSON of the validated schedules sorted by `externalId` (D6). |
| `createdByUserId` | String? | Admin user for manual imports; null for API imports. |
| `errorSummary` | String? | Short message only — never a stack trace. **As-built, the engine never sets this** (the `ScheduleImport` create in `engine.ts:313–332` omits it), so it is always `null` in v1; the admin detail page still renders it if ever set. |
| `createdAt` | DateTime | Import time (shown in history). |

Additional indexes as-built (not listed in D1, present in
`prisma/schema.prisma`): `@@index([connectionId, createdAt])` and
`@@index([status, createdAt])`, used by the admin history list.

Relation to items is `Cascade`; relation to connection is `Restrict`.

### 4.4 `ScheduleImportItem`

One row per schedule in an import run.

| Field | Type | Notes |
|---|---|---|
| `id` | String, cuid | Primary key. |
| `importId` | String | Parent `ScheduleImport` (`Cascade` on delete). |
| `externalId` | String | Payload `id` of this record. |
| `action` | String | `created` \| `updated` \| `unchanged` \| `cancelled` \| `failed` (D5). |
| `error` | String? | Short message only (e.g. `"already owned by another connection"`). Never a stack trace. |
| `createdAt` | DateTime | |

Index: `@@index([importId])`.

### 4.5 What Phase 11 does NOT add

- No `externalId`/`source` column on `Booking` or `BookingSlot` (the
  Phase 10 §K.2 gap is filled by the new `ImportedSchedule` model
  instead — D1). Imported schedules are never converted into bookings,
  slots, `flowerCode`s, or `referenceCode`s, and an import update never
  touches `Booking` fields (Phase 10 §K.5).
- No seed changes in v1: demo import data is created by tests, not by
  `prisma/seed.ts` (audit §4).

## 5. Import engine (D5)

Implemented in `src/server/schedule-import/engine.ts`. Both the API route
and the manual admin actions call the same engine, so preview/apply
semantics are identical in both paths (D8).

`ImportedScheduleStatus` and `ValidatedSchedule` are defined in
`src/lib/schedule-import-schema.ts` and **re-exported** by the engine
(`engine.ts:40`); the engine additionally exports the canonical-hash
helper and the error classes the route maps to HTTP statuses:

```ts
export function computeScheduleImportPayloadHash(schedules: ValidatedSchedule[]): string;
export class ImportIdConflictError extends Error { readonly importKey: string; }
export class ConcurrentImportError extends Error {}
export class IntegrationConnectionNotFoundError extends Error { readonly connectionId: string; }
```

**Two classes named `IntegrationConnectionNotFoundError` exist** — one
in the engine (`engine.ts:83`, thrown when apply references a
connection id that does not exist) and one in
`src/server/schedule-import/connections.ts:59` (thrown by rotate/revoke
for an unknown id). They are different classes in different modules
with the same name and message shape (`Integration connection not
found: <id>`); import the one from the module you are calling. The API
route imports the engine's copy; the admin actions never surface the
connections copy distinctly (they map every connection-action failure
to a generic Vietnamese message, §6.5).

```ts
export type ImportedScheduleStatus = "scheduled" | "confirmed" | "completed" | "cancelled";
export type ImportAction = "created" | "updated" | "unchanged" | "cancelled" | "failed";
export type ImportItemResult = { externalId: string; action: ImportAction; error?: string };
export type ImportSummary = {
  total: number; created: number; updated: number; unchanged: number;
  cancelled: number; failed: number; items: ImportItemResult[];
};
export type ValidatedSchedule = {
  externalId: string; title: string; description: string; location: string;
  note: string; startsAt: Date; endsAt: Date; status: ImportedScheduleStatus;
};

export async function previewScheduleImport(input: {
  connectionId: string | null; source: string; schedules: ValidatedSchedule[];
}): Promise<ImportSummary>;

export async function applyScheduleImport(input: {
  connectionId: string | null; source: string; schedules: ValidatedSchedule[];
  importKey?: string | null; payloadHash: string; userId?: string | null;
}): Promise<{ importId: string; summary: ImportSummary }>;
```

### 5.1 Matching

Matching is scoped to `connectionId` (D5). A `null` connectionId is the
manual-admin scope; manual and API scopes **never match each other** —
the same `externalId` imported manually and via an API connection creates
two separate `ImportedSchedule` rows, one per scope.

**`cancelled` counts only newly-cancelled rows** (as-built,
`engine.ts:163–170`): the `cancelled` action is taken only when the
payload status is `cancelled` **and** the existing row's status is not
already `cancelled`. An already-cancelled row re-imported with other
fields changed counts as `updated`; re-imported unchanged it counts as
`unchanged`. (The engine checks the cancelled transition before the
fields-changed check, so a newly-cancelled row counts as `cancelled`
even when other fields changed at the same time.)

## 6. API endpoint

### 6.1 `POST /api/integrations/schedules/import` (D7)

- **Method / path:** `POST /api/integrations/schedules/import`.
- **Handler:** `export const dynamic = "force-dynamic"` (dynamic-only,
  like all Phase 10 API routes; the route is staged out of the static
  export automatically — no `pages.yml` change is needed, audit §1).
- **Response envelope:** the standard `withApi` / `ok(data, meta)` /
  `fail(code, message, status, details)` envelope from `src/lib/api.ts`
  (§9). Success is `{ "success": true, "data": { … } }`; errors are
  `{ "success": false, "error": { "code", "message", … } }`.

### 6.2 Authentication (D7)

- **Header:** `Authorization: Bearer imp_<32 hex chars>`.
- **Token format:** `imp_` + `randomBytes(16).toString("hex")` (32 hex
  characters), generated server-side at connection creation.
- **Storage:** only the SHA-256 hash is stored (`IntegrationConnection.
  tokenHash`), the same approach as `Session.tokenHash` (§11.1). The
  plain token is shown **once**, in the creation response only. It is
  never logged, never sent to frontend code again, and cannot be
  retrieved afterwards — if it is lost, the connection must be rotated
  (new token, old token stops working).
- **Failures:** missing or bad token → `401 UNAUTHORIZED`; revoked or
  inactive connection (`isActive = false`) → `403 FORBIDDEN`.
- **How the distinction is implemented (as-built,
  `src/server/schedule-import/connections.ts:147–187`):**
  `authenticateIntegrationRequest` returns `null` **only** for a
  missing/malformed/unknown token (→ 401). A known but inactive
  connection is **returned** with `isActive: false`, so the route can
  answer 403 instead — the D7 brief's "`null` means 401" is therefore
  true only for the unknown-token case. The Bearer parser is
  case-insensitive (`/^Bearer\s+(.+)$/i`) and accepts any non-empty
  token string; the `imp_` + 32-hex shape is **not** enforced at auth
  time — an arbitrary string simply hashes to no known connection and
  yields 401.
- **Lifecycle (admin, SUPER_ADMIN only — D8):** create, rotate, revoke.
  Rotation issues a new token and invalidates the old one; revocation
  sets `isActive = false` and never deletes the connection or its
  schedules (D1, `onDelete: Restrict`). There is no un-revoke and no
  delete in v1.
- **No admin credentials for machine access:** integration tokens are
  dedicated credentials. Never reuse an admin session cookie or password
  for machine-to-machine calls, and never put an integration token in a
  browser cookie (master prompt §10).
- **No `requireSameOrigin`:** this is a machine-to-machine Bearer-token
  endpoint, not a cookie-authenticated browser mutation, so the
  same-origin check used for browser mutations does not apply (D7).
  Authentication is the Bearer token + per-connection rate limiting (§6.4).
- **Audit + last use:** on successful authentication of an **active**
  connection, `lastUsedAt` is updated — best-effort
  (`.catch(() => undefined)` in `connections.ts:180–183`): a failure to
  write it never rejects a valid import. Inactive connections do **not**
  get `lastUsedAt` updated. Note the timing: the update happens during
  authentication, **before** the per-connection rate limit and before
  validation — so even a request that is later rate-limited (429) or
  rejected (400) has already refreshed `lastUsedAt`. On apply,
  `logActivity` records action `schedule_import.apply`,
  `entityType: "ScheduleImport"`, a summary with counts + connection
  name, and `userId: null` (API imports have no admin user). The logging
  lives in the **route** (`route.ts:134–142`, after `applyScheduleImport`
  returns), not in the engine — so an idempotency **replay is also
  logged** as an apply. Preview is never logged. Connection
  create/rotate/revoke are logged by `connections.ts` with actions
  `integration_connection.create` / `.rotate` / `.revoke`
  (`entityType: "IntegrationConnection"`, `userId` = the acting admin).

### 6.3 Preview vs apply

The request body is the envelope (§2.1) plus the API-only `preview`
flag:

- `preview: true` → the engine's `previewScheduleImport` runs: the
  summary is computed against current DB state, **no writes are
  performed and no `ScheduleImport` row is created** (D5). The response
  has the same summary shape as an apply, but no `importId` — it
  carries `"preview": true` instead (§9.2).
- `preview` omitted or `false` → `applyScheduleImport` runs (§7, §8)
  and the response includes the new (or replayed) `importId` plus
  `"preview": false` (§9.1).

### 6.4 Rate limits and size limits (D7, D4)

| Limit | Value | Scope | On exceed |
|---|---|---|---|
| `IMPORT_API_LIMIT` | 30 requests / 10 minutes | Authenticated, per connection: key `import:<connectionId>` | `429 RATE_LIMITED` — message `"Too many import requests. Please try again shortly."` |
| `IMPORT_AUTH_LIMIT` | 10 attempts / 1 minute | Unauthenticated **and revoked-token** attempts, per hashed IP (`hashedKey`, SHA-256 — raw IPs are never stored, audit §1) | `429 RATE_LIMITED` — message `"Too many import attempts. Please try again shortly."` |
| `MAX_IMPORT_JSON_BYTES` | 256 KiB (`256 * 1024` bytes) | Request body, checked **twice** (§6.4.1) | `413 PAYLOAD_TOO_LARGE` — message `"Request body is too large."` |
| `MAX_IMPORT_SCHEDULES` | 500 schedules | `schedules` array length | `400 VALIDATION_FAILED` |

Rate limiting uses the existing in-process fixed-window
`rateLimit(key, limit, windowMs)` from `src/lib/rate-limit.ts` and
`clientIp(headers)` (trusted-proxy-hop aware). As in Phase 10, the
limiter is a guard, not the correctness mechanism: duplicate protection
is DB-level (`@@unique([connectionId, externalId])` plus the partial
manual-scope index, D5).

#### 6.4.1 Check order in the route (as-built, `route.ts`)

1. Declared `Content-Length` > 256 KiB → `413` (fast path, before auth).
2. Authentication → `401` (unknown token) or `403` (revoked token).
   Both the 401 and the 403 path go through the per-hashed-IP
   `IMPORT_AUTH_LIMIT` first (`rejectUnauthenticated`): a revoked token
   is therefore also rate-limited per IP, not only unknown tokens —
   the D7 wording "unauthenticated attempts" covers the revoked case
   as-built because a revoked token is not an authenticated caller
   (`src/lib/schedule-import-limits.ts` comment).
3. Authenticated per-connection `IMPORT_API_LIMIT` → `429`.
4. The raw body is read (`request.text()`); its **actual byte length**
   (`Buffer.byteLength(raw, "utf8")`) is checked again → `413`. This
   second layer is what enforces the cap when no `Content-Length` was
   sent (chunked transfer).
5. `JSON.parse` → `400 INVALID_JSON` on failure; a parsed value that is
   not a JSON object (array, string, number, `null`) → `400
   INVALID_JSON` with message `"Request body must be a JSON object."`.
6. Envelope/schema validation → `400 VALIDATION_FAILED`.
7. Preview or apply (§6.3).

#### 6.5 Manual admin import (D8) — as-built error behavior

The admin flow (`src/server/actions/schedule-import.ts`,
`src/lib/schedule-import-manual.ts`) parses the pasted JSON with
`parseManualImportJson` before calling the same engine with
`connectionId: null`, `source: "admin-manual"`, `importKey: null`:

- **Size first:** byte length (`TextEncoder`) > 256 KiB → `"JSON vượt
  quá giới hạn 256 KB. Hãy chia nhỏ file rồi nhập từng phần."`
- **Malformed JSON** → `"JSON không hợp lệ. Kiểm tra dấu ngoặc, dấu
  phẩy và dấu ngoặc kép."`
- **Schema failure** → `"Dữ liệu không hợp lệ: <first 3 field messages>"`
  (field messages name duplicated ids, bad dates, `end <= start`, per
  D4), or `"Dữ liệu không hợp lệ. Kiểm tra lại định dạng JSON theo
  mẫu."` when there are none.
- **Engine failures** are mapped by `importErrorMessage`:
  `ImportIdConflictError` → `"Mã import (importId) này đã được dùng
  với nội dung khác. Hãy dùng mã import mới."` (unreachable in practice
  — manual imports always use `importKey: null`); `ConcurrentImportError`
  → `"Có một lần nhập khác đang chạy cùng lúc. Vui lòng thử lại."`;
  anything else → `"Không thể nhập lịch. Vui lòng thử lại."`
  (preview failures use the same fallback; the form's own catch adds
  `"Không thể xem trước. Vui lòng thử lại."` / `"Không thể nhập lịch.
  Vui lòng thử lại."`).
- Manual apply logs `schedule_import.apply` with `userId` = the acting
  admin (unlike the API's `userId: null`); manual preview logs nothing.
  Server-action failures are also `console.error`-logged server-side
  (never shown to the admin). All admin-facing strings are hardcoded
  Vietnamese — see §12.

## 7. Import behavior (D5, D2, master prompt §5–§6)

### 7.1 Per-record actions

For each validated schedule, in the matching phase (scoped to the
request's `connectionId`):

| Situation | Action | Counted as |
|---|---|---|
| `externalId` does not exist in this scope | Create a new `ImportedSchedule` | `created` |
| Exists and any of title / description / location / note / `startsAt` / `endsAt` / `status` changed | Update **only** those fields — never anything else (there is nothing server-owned on this model) | `updated` |
| Exists and nothing changed | No write | `unchanged` |
| Payload `status` is `cancelled` and the record exists and is **not** already `cancelled` | Update `status` to `cancelled` (row kept, never deleted) | `cancelled` |
| Payload `status` is `cancelled` and the record exists and is **already** `cancelled` | Other fields changed → update; nothing changed → no write (§5.1) | `updated` / `unchanged` (not `cancelled`) |
| Payload `status` is `cancelled` and the record does **not** exist | Create it as `cancelled`, so later updates can find it | `created` (not `cancelled` — D5) |
| `externalId` is owned by a **different** connection | `failed`, error `"already owned by another connection"`; excluded from writes; the rest of the import still applies | `failed` |
| Any other per-record failure inside apply | `failed` with a short error message | `failed` |

The import summary is `{ total, created, updated, unchanged, cancelled,
failed, items: [{ externalId, action, error? }] }` (D5 `ImportSummary`).
An import whose `failedCount > 0` (but which otherwise applied) is stored
with `ScheduleImport.status = "completed_with_errors"`; a fully clean
apply is `"completed"`; a run that writes nothing because of a
whole-request failure stores no `ScheduleImport` row at all in the API
case (the request is rejected before apply) — see §9.

### 7.2 Cross-connection isolation

- Matching is scoped to `connectionId`. Two connections may each own an
  `externalId` with the same string value; they are different rows
  (`@@unique([connectionId, externalId])`).
- An `externalId` owned by a different connection is **not** overwritten
  and **not** read: that item fails with `"already owned by another
  connection"` and the rest of the payload still applies (D5).
- Manual imports (`connectionId: null`) never match API-owned rows and
  vice versa (§5.1).
- There is no endpoint to list, read, or modify another connection's
  schedules. The public calendar (§7.4) shows imported schedules without
  any connection attribution.

### 7.3 Missing, cancelled, and invalid records

- **Missing records are left alone** (master prompt §6). If a schedule
  was in a previous import but is absent from this payload, it is not
  deleted, not cancelled, and not modified. There is no "sync to exactly
  this payload" mode in v1.
- **Cancelled records are marked cancelled, never physically deleted**
  (master prompt §6, D2). A cancelled row stays in the database and in
  history; it is hidden from the public upcoming list (§7.4).
- **Invalid records:** a whole-request schema failure (malformed JSON,
  wrong `type`/`version`, duplicate `id` in one payload, invalid date/
  time, `end <= start`, over-long field, too many schedules) rejects the
  **entire request** with `400` and **nothing is written** (D5). There is
  no partial apply of a schema-invalid payload. Per-record failures that
  can only be detected at apply time (cross-connection ownership) are the
  exception: they fail individually and the rest apply (§7.1).

### 7.4 Calendar integration (D9)

Imported schedules appear in the existing Phase 10 booking calendar —
extended, not competing:

- The public booking page (`src/app/(public)/[locale]/booking/page.tsx`)
  gains a read-only **"Lịch sắp tới"** section listing upcoming imported
  schedules: title, VN date + time range, status chip — and, when set,
  location and description as well
  (`src/components/site/imported-schedule-list.tsx`, which renders
  `schedule.location` and `schedule.description` under the time line).
  The section sits after the service list and before the cancel/lookup
  link.
- Query: `listUpcomingImportedSchedules({ from?, to?, limit? })` in
  `src/server/queries/schedules.ts` — upcoming = `startsAt >= now` AND
  `status` in (`scheduled`, `confirmed`), ordered by `startsAt` ascending,
  default `limit` 20. As-built semantics: a `from` in the past is
  **clamped to now** (the list stays upcoming-only even when `from` is
  past); `to`, when given, is an **inclusive** upper bound on `startsAt`
  (`lte`). The list is public across scopes — schedules from every
  connection and the manual scope appear together with no connection
  attribution. `cancelled` and `completed` schedules are hidden
  here.
- **No new public route and no new public JSON endpoint in v1**
  (server-component query only). A public JSON feed is a post-launch
  backlog item (§11.3).
- The admin import page (`/admin/schedule-import`, D8) has its own month
  calendar of imported schedules with date/status filters, plus the
  history list and a per-import detail page.
- Status mapping (D2): import statuses map 1:1 onto
  `ImportedSchedule.status`. `scheduled` = on the calendar, no booking
  attached. There is **no** mapping onto `Booking`/`BookingSlot`
  statuses — an imported schedule never creates or changes a booking or
  a slot (Phase 10 §K.3).

### 7.5 Transactions, concurrency, rollback (D5)

- Apply runs inside a database transaction. An unexpected DB error inside
  the transaction rolls back the **whole** import — no partial writes.
- Concurrency backstop: `@@unique([connectionId, externalId])` **plus**
  the partial manual-scope index `ImportedSchedule_manual_externalId_key`
  (§4.2). If two concurrent applies race, the loser surfaces `409
  CONCURRENT_IMPORT`; the client retries, and the retry is safe because
  apply is record-idempotent (§8). The engine's P2002 catch
  (`engine.ts:345–352`) also covers a race on the `ScheduleImport`
  `@@unique([connectionId, importKey])` — the same `ConcurrentImportError`
  is thrown for either unique violation, and the route maps both to the
  same 409.
- Preview performs no writes and creates no `ScheduleImport` row (D5).
- The engine checks the connection exists (when `connectionId` is
  non-null) **inside** the transaction (`engine.ts:253–258`) and throws
  the engine's `IntegrationConnectionNotFoundError`; the route maps it
  to `401 UNAUTHORIZED` with message `"Integration connection no longer
  exists."` (§9.4). In practice this is reachable only if the connection
  is removed between authentication and apply (no delete UI exists in
  v1, so only direct-DB / test-helper cleanup can do that).
- History-query precision (as-built,
  `src/server/queries/schedule-import.ts`): the history list is paginated
  at `perPage` clamped to 1–50 (default 10), newest first; the `source`
  filter is a **case-insensitive substring** match (`contains`), not an
  exact match; `status` is exact. The admin month calendar
  (`listImportedSchedulesForCalendar`) returns at most 500 rows; a
  `date` filter wins over `month`, and an invalid `month` falls back to
  the current VN month. The calendar UI shows at most 3 schedules per
  day, then `"+N lịch nữa"`.

## 8. Idempotency (D6)

Two independent layers; both must hold.

### 8.1 Record-level idempotency (always on)

Re-submitting the same payload (same connection, same `externalId`s, same
field values) creates nothing new: every record matches an existing row
with no changes and is counted `unchanged`. This is what makes retries
safe, including retries after a `409 CONCURRENT_IMPORT`.

### 8.2 Optional `importId` key (envelope-level)

- The envelope may carry `importId` (≤ 128 chars). It is stored as
  `ScheduleImport.importKey`, unique per connection
  (`@@unique([connectionId, importKey])`).
- `payloadHash` = SHA-256 of the canonical JSON of the **validated**
  schedules sorted by `externalId`. As-built, the **route computes it**
  with the engine's exported `computeScheduleImportPayloadHash`
  (`route.ts:131`) and passes it in; the engine only computes it as a
  fallback when given an empty value (`engine.ts:249`). The manual
  actions do the same (`actions/schedule-import.ts`). Clients never
  compute or send it.
- **Replay:** on apply with an `importId`, if a `ScheduleImport` already
  exists for (`connectionId`, `importKey`) with the **same**
  `payloadHash`, the stored summary + `importId` are returned **without
  re-applying** — no new rows, no new counts. The replayed items are
  returned **sorted by `externalId` ascending** (the engine loads them
  with `orderBy: { externalId: "asc" }`, `engine.ts:266`), not in the
  original payload order. A replay is still audit-logged as an apply by
  the route (§6.2). See the replay example in §9.5.
- **Conflict:** the same `importId` with a **different** `payloadHash`
  → `409 IMPORT_ID_CONFLICT` (§9.6). The client must use a new
  `importId` for different content. Never reuse an `importId` for a
  different payload (master prompt §5).
- **Manual imports** use `importKey: null` — no replay semantics.
  Re-applying the same manual JSON yields `unchanged` anyway (§8.1).
- **Preview** does not consume or reserve an `importId`: previewing with
  an `importId` and then applying with the same `importId` is a normal
  first apply, not a replay.

## 9. Request/response examples and error handling

All responses use the `ok` / `fail` envelope (`src/lib/api.ts`).
Error bodies never contain stack traces or tokens (D7). Field-level
validation details use `zodFieldErrors()` (audit §1).

### 9.1 Success — apply

Request: `POST /api/integrations/schedules/import`, header
`Authorization: Bearer imp_<32 hex chars>`, body the §2.3 example
(1 schedule, `status: "confirmed"`, new `id` `EXCEL-001`).

```json
{
  "success": true,
  "data": {
    "preview": false,
    "importId": "cm000000000000000000000001",
    "summary": {
      "total": 1,
      "created": 1,
      "updated": 0,
      "unchanged": 0,
      "cancelled": 0,
      "failed": 0,
      "items": [
        { "externalId": "EXCEL-001", "action": "created" }
      ]
    }
  }
}
```

HTTP status: `200`. A `ScheduleImport` row is created with
`status: "completed"` and one `ScheduleImportItem` (`created`). The
response always carries `"preview": false` on the apply path
(`route.ts:144`).

### 9.2 Success — preview (`preview: true`)

Same request body plus `"preview": true`.

```json
{
  "success": true,
  "data": {
    "preview": true,
    "summary": {
      "total": 2,
      "created": 1,
      "updated": 1,
      "unchanged": 0,
      "cancelled": 0,
      "failed": 0,
      "items": [
        { "externalId": "EXCEL-001", "action": "updated" },
        { "externalId": "EXCEL-002", "action": "created" }
      ]
    }
  }
}
```

No `importId` is returned (nothing was stored), no rows are written, and
no `ScheduleImport` row is created (D5). The response carries
`"preview": true` (`route.ts:128`).

### 9.3 Validation failed — `400 VALIDATION_FAILED`

Duplicate `id` within one payload (`EXCEL-001` twice), or an invalid
date/time, or `end <= start`, or a field over its length limit, or more
than 500 schedules. Nothing is written.

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The import payload failed validation.",
    "details": {
      "fieldErrors": {
        "schedules": ["Duplicate schedule ids: EXCEL-001"]
      }
    }
  }
}
```

The exact as-built wording is `"Duplicate schedule ids: <ids>"`
(`src/lib/schedule-import-schema.ts:120` — no "in payload"). The
`details` shape is `{ "fieldErrors": zodFieldErrors(error) }`
(`route.ts:104–106`): field path → messages, e.g. `"schedules"`,
`"schedules.0.date"`, `"schedules.0.end"`. The route's top-level
message is always `"The import payload failed validation."`; the
specifics live in `details.fieldErrors`. Other `400` cases:

| Code | HTTP | When |
|---|---|---|
| `INVALID_JSON` | 400 | Request body is not parseable JSON (`"Request body must be valid JSON."`), **or** the parsed value is not a JSON object — array, string, number, `null` (`"Request body must be a JSON object."`). |
| `VALIDATION_FAILED` | 400 | Envelope/schedule schema fails: wrong `type` or `version`, missing required field, bad date/time format, invalid date/time, `end <= start`, field too long, duplicate `id` in payload, `schedules` > 500. Message is always `"The import payload failed validation."`; specifics in `details.fieldErrors`. |

### 9.4 Unauthorized — `401 UNAUTHORIZED`

Missing header, malformed header, or a token that matches no connection:

```json
{
  "success": false,
  "error": { "code": "UNAUTHORIZED", "message": "Missing or invalid integration token." }
}
```

A revoked/inactive connection is **not** a 401 — it is `403 FORBIDDEN`
(the token is valid but the connection is disabled):

```json
{
  "success": false,
  "error": { "code": "FORBIDDEN", "message": "Integration connection is revoked." }
}
```

Exact as-built messages (`route.ts:53–58`): 401 `"Missing or invalid
integration token."`, 403 `"Integration connection is revoked."` (the
word is "revoked", not "inactive"). One more 401 exists: if the
connection disappears between authentication and apply, the engine's
`IntegrationConnectionNotFoundError` is mapped to `401 UNAUTHORIZED`
with message `"Integration connection no longer exists."`
(`route.ts:149–151`).

### 9.5 Idempotency replay — same `importId`, same payload

Re-sending the §2.3 multi-record example with
`"importId": "weekly-import-2026-11-16"` a second time returns the stored
result without re-applying:

```json
{
  "success": true,
  "data": {
    "preview": false,
    "importId": "cm000000000000000000000002",
    "summary": {
      "total": 2,
      "created": 2,
      "updated": 0,
      "unchanged": 0,
      "cancelled": 0,
      "failed": 0,
      "items": [
        { "externalId": "EXCEL-001", "action": "created" },
        { "externalId": "EXCEL-002", "action": "created" }
      ]
    }
  }
}
```

Note the counts are the **original** counts (`created: 2`), not
`unchanged: 2` — a replay returns the stored summary, it does not
re-run the engine (D6). The `importId` is the same row id as the first
apply. The replayed `items` come back sorted by `externalId` ascending
(§8.2), which in this example coincides with payload order.

### 9.6 Import-id conflict — `409 IMPORT_ID_CONFLICT`

Same `importId` (`"weekly-import-2026-11-16"`) with different schedule
content (different `payloadHash`):

```json
{
  "success": false,
  "error": {
    "code": "IMPORT_ID_CONFLICT",
    "message": "importId \"weekly-import-2026-11-16\" was already used with different content"
  }
}
```

The message is the engine's `ImportIdConflictError` message verbatim
(`engine.ts:68`): `importId "<key>" was already used with different
content` — it names the key and carries no "; use a new importId"
suffix. Nothing is written. The other `409`:

| Code | HTTP | When |
|---|---|---|
| `IMPORT_ID_CONFLICT` | 409 | `importId` reused with a different `payloadHash` (D6). |
| `CONCURRENT_IMPORT` | 409 | Unique-constraint race (`P2002` on `[connectionId, externalId]`, the partial manual index, or `[connectionId, importKey]`) inside apply. Message: `"A concurrent import conflicted. Please retry the import."` Client retries; retry is safe (§7.5, §8.1). |

### 9.7 Size / rate-limit errors

| Code | HTTP | When |
|---|---|---|
| `PAYLOAD_TOO_LARGE` | 413 | `Content-Length` > `MAX_IMPORT_JSON_BYTES` (256 KiB), **or** the actual body byte length > 256 KiB when no `Content-Length` was sent (§6.4.1). Message: `"Request body is too large."` |
| `RATE_LIMITED` | 429 | Over `IMPORT_API_LIMIT` (30 / 10 min per connection) — message `"Too many import requests. Please try again shortly."` — or `IMPORT_AUTH_LIMIT` (10 / 1 min per hashed IP for unauthenticated **and revoked-token** attempts) — message `"Too many import attempts. Please try again shortly."` |

```json
{
  "success": false,
  "error": { "code": "RATE_LIMITED", "message": "Too many import requests. Please try again shortly." }
}
```

### 9.8 Full error-code table (D7)

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `INVALID_JSON` | Body is not parseable JSON, or the parsed value is not a JSON object. |
| 400 | `VALIDATION_FAILED` | Schema / field / date-time / duplicate-id / limit failure; nothing written. Message always `"The import payload failed validation."`; specifics in `details.fieldErrors`. |
| 401 | `UNAUTHORIZED` | Missing or bad Bearer token (`"Missing or invalid integration token."`), or the connection vanished between auth and apply (`"Integration connection no longer exists."`). |
| 403 | `FORBIDDEN` | Token valid but connection revoked/inactive (`"Integration connection is revoked."`). |
| 409 | `IMPORT_ID_CONFLICT` | `importId` reused with different content. Message names the key (§9.6). |
| 409 | `CONCURRENT_IMPORT` | Concurrent-apply race; retry safely. Message: `"A concurrent import conflicted. Please retry the import."` |
| 413 | `PAYLOAD_TOO_LARGE` | Body over 256 KiB (declared or actual byte length). |
| 429 | `RATE_LIMITED` | Over the per-connection or per-IP rate limit (two distinct messages, §9.7). |
| 500 | `INTERNAL_ERROR` | Unexpected server error, via `withApi` (`src/lib/api.ts`): `"Something went wrong."` Never leaks internals. |
| 503 | `SERVICE_UNAVAILABLE` | Database unavailable (`isDatabaseUnavailable`, `src/lib/api.ts`): `"Service temporarily unavailable. Try again shortly."` |

Never leak stack traces or tokens in any error response (D7).

## 10. Future Muse integration instructions

This section is for the future agent that will read a customer's Excel
file and call this API. **No Muse integration is built in Phase 11**
(master prompt §1, §10) — this is a contract the future integration must
follow, not code.

### 10.1 Agent workflow

1. **Read the Excel file.** One row = one schedule. Extract a stable
   identifier per row (e.g. a customer/booking code column, or a
   deterministic hash of customer + date + start time — never the Excel
   row number, master prompt §5).
2. **Build the envelope** (§2): `type: "schedule_import"`,
   `version: "1.0"`, `source: "external_agent"` (or a more specific
   source label agreed with the site owner), `generatedAt` = now in ISO
   8601, `schedules` = one object per row.
3. **Map Excel columns to fields:** title, `date` (`YYYY-MM-DD`),
   `start`/`end` (`HH:mm` VN wall-clock), optional `description`,
   `status`, `location`, `note`. Reject rows with invalid dates/times
   or `end <= start` before sending — the API will reject the whole
   request otherwise (§9.3). Split overnight rows (§3.3) or flag them
   to the customer; do not send them as-is.
4. **Send with the connection's token:** `Authorization: Bearer
   imp_<32 hex chars>`, `Content-Type: application/json`, to
   `POST /api/integrations/schedules/import` on the full-stack
   deployment (never the static GitHub Pages demo — the API routes are
   staged out of the export, audit §1). The token belongs to one
   `IntegrationConnection`; it is issued by a SUPER_ADMIN in
   `/admin/schedule-import` and shown once at creation. Store it in the
   agent's own credential store — never in code, never in chat, never
   in the Excel file.
5. **Use an `importId` per import run** (e.g.
   `weekly-import-2026-11-16`): a new value for each new file/version,
   the same value only for an exact retry of the same payload (§8.2).
6. **Read the summary** and report it to the customer: created /
   updated / unchanged / cancelled / failed counts and any per-item
   errors (e.g. `"already owned by another connection"` means that
   `externalId` belongs to a different connection — do not retry it
   under this token; escalate to the site owner).

### 10.2 Respect `autoApply`

- `IntegrationConnection.autoApply` defaults to `false` (D1).
- **As-built, `autoApply` is not enforced anywhere in v1** (§4.1): no
  code path reads it, and there is no admin UI or server action to set
  it — every connection is created with `false` and stays `false`
  unless changed directly in the database. The admin page only
  **displays** it ("Tự áp dụng: Có/Không"). The rule below is therefore
  a **procedural rule for the future agent**, not a setting the website
  enforces; a future change must add a setter (and a code path that
  reads the flag) before `autoApply: true` can mean anything.
- **When `autoApply` is `false`** (the default, and the only value
  reachable through the UI in v1): the agent must **preview first**
  (`preview: true`), present the preview summary to the
  administrator/customer, and only apply after they approve. Do
  not apply blindly.
- **When `autoApply` is `true`** (only reachable by direct DB edit in
  v1, until a setter exists): the agent may apply directly; the preview
  step is optional but still available. `autoApply` is a per-connection
  setting — never assume it, always check what the connection's owner
  configured.
- Either way, every apply is recorded in import history (§4.3) and in
  the audit log (§6.2), and every apply is idempotent (§8), so a
  retried apply after a network failure is safe.

### 10.3 What the future agent must NOT do

- Do not send executable code — JSON data only (master prompt §3).
- Do not invent fields, endpoints, or statuses beyond this spec (D1–D12).
- Do not reuse admin credentials, and do not share one connection's
  token across customers — each customer/source gets its own
  `IntegrationConnection`, so schedules stay isolated (§7.2).
- Do not delete schedules by omitting them from a payload (missing ≠
  deleted, §7.3). To cancel, send the record with `status:
  "cancelled"`.
- Do not expect the API to send email or notifications — there are none
  in v1 (D11).

## 11. Monitoring compatibility (§11 — documentation only, no code)

Master prompt §11: the customer will later use Muse with a separate,
limited-access website account to monitor new website content and report
relevant updates. That workflow is **not implemented in Phase 11**.
This section documents the existing mechanisms that could support a
future read-only monitoring identity, so the future work does not have
to rediscover them — and records what Phase 11 deliberately does not
change.

### 11.1 Existing authentication and permission mechanisms

Verified against `src/server/auth.ts`, `src/server/audit.ts`, and
`prisma/schema.prisma` (models `User`, `Session`, `ActivityLog`).

**Users and roles (`User.role`, a plain `String`, default `"ADMIN"`):**

| Role | Meaning (code) | Enforced by |
|---|---|---|
| `SUPER_ADMIN` | Full access, including users & settings | `requireSuperAdmin()` — redirects non-super-admins to `/admin?denied=1` |
| `ADMIN` | Content & messages | `requireUser()` — any signed-in admin |

There are exactly two roles. There is **no** `EDITOR` role and no
read-only role today. `User` fields: `id` (cuid), `email` (`@unique`),
`name`, `passwordHash` (bcrypt, cost 12 — `hashPassword` /
`verifyPassword`), `role`, `isActive`, `lastLoginAt`, timestamps.
`@@index([role])`. Deactivating a user (`isActive = false`) blocks
`getSessionUser()` from returning them.

**Sessions (`Session`, cookie `ps_session`):**

- On login, a random 32-byte token (`randomBytes(32).toString
  ("base64url")`) is created; **only its SHA-256 hash is stored**
  (`Session.tokenHash`, `@unique`). The raw token is never persisted.
- The cookie is `httpOnly`, `sameSite: "lax"`, `secure` in production,
  `path: "/"`, 7-day TTL (`SESSION_TTL_MS = 7 days`,
  `Session.expiresAt`).
- `getSessionUser()` (cached per request) resolves the cookie → hash →
  session → user; it returns `null` for a missing/expired session or an
  inactive user, and deletes expired sessions on sight.
- Login revokes **all** prior sessions of the user
  (`revokeAllSessions`); password change revokes all other sessions
  (`revokeOtherSessions`). `destroySession()` deletes the current
  session row and clears the cookie.
- `Session` also stores `userAgent` (≤ 250 chars) and `ip`
  (logging-only, resolved with the same trusted-proxy-hop logic as rate
  limiting; no decision is ever based on it).

**Audit (`ActivityLog`, via `logActivity()` in `src/server/audit.ts`):**

- Fields: `id` (cuid), `userId` (nullable — null for machine/API
  actions), `action`, `entityType`, `entityId`, `summary`, `createdAt`.
  Indexes on `createdAt` and `entityType`. Relation to `User` is
  `onDelete: SetNull`, so deleting a user keeps the audit trail.
- `logActivity()` **never throws**: a failed audit write is logged to
  the console and the user's action still succeeds. Summaries are
  sliced to 400 characters.
- Phase 11 audit actions: `schedule_import.apply`
  (`entityType: "ScheduleImport"`, `userId: null` for API imports) and
  connection create/rotate/revoke (§6.2). `recentActivity(limit = 8)`
  powers the admin dashboard's recent-activity list.

**Admin gating (for context):** admin pages live under
`(admin)/admin/(protected)/` behind the session gate; admin API routes
use `authorize(roles)` (401/403) and `requireSameOrigin()` on browser
mutations. The integration API deliberately does **not** use either —
it is Bearer-token machine access (§6.2).

### 11.2 Proposed future read-only monitoring identity (no code in this phase)

Two options are documented for the future monitoring work. Either is a
small, additive change; neither is implemented now, and neither may be
started without an explicit owner decision.

**Option A (recommended): a new `READONLY` role value.**

- Add `"READONLY"` to the `Role` type in `src/server/auth.ts` and to
  the `User.role` comment in `prisma/schema.prisma` (a plain string
  column — no migration needed for the value itself, only code that
  recognises it).
- A `READONLY` user gets a normal session (same SHA-256 cookie, same
  7-day TTL) but every write path — server actions, admin mutations,
  import apply — must reject it (a `requireReadOnly`-aware guard, or an
  explicit role check at each mutation entry point). Read paths
  (dashboard, content lists, import history, public calendar data)
  remain available.
- Advantage: reuses the entire existing session/audit machinery;
  `ActivityLog.userId` attributes the monitoring account's reads if
  read-audit is ever wanted. Risk: every future mutation must remember
  to exclude `READONLY` — the guard must be central, not per-page.

**Option B: a scoped read-only `IntegrationConnection`.**

- Add a read-only flag/scope to `IntegrationConnection` (e.g. a
  `scope: "import" | "read"` field) and a read-only endpoint that
  accepts its Bearer token and returns only public/approved content
  (e.g. upcoming imported schedules, new content summaries).
- Advantage: no admin session involved at all; the monitoring agent
  uses the same token pattern as the importer, with no UI access.
  Risk: needs a new endpoint and an explicit decision about exactly
  which content a read-only connection may see — that allow-list must
  be defined by the owner, not invented here.

Whichever option is chosen, the monitoring identity must be
**separate** from import connections (an import token must never grant
read access to unrelated content, and a monitoring identity must never
be able to import), and its creation must be a SUPER_ADMIN action with
an audit entry, like connection create/rotate/revoke.

### 11.3 What Phase 11 preserves (D11)

- Existing website content and notification systems are untouched: no
  new notification writes, no changes to admin access, no changes to
  the survey/booking flows.
- Schedule imports stay separate from content management and website
  notifications: import history lives in its own tables (§4.3–§4.4)
  and its own admin page; imports never write to articles, projects,
  surveys, bookings, or messages.
- The future monitoring account, when it exists, will be able to read
  import history through the admin UI (Option A) or a scoped endpoint
  (Option B) — but in this phase there is no monitoring account, no
  monitoring endpoint, and no monitoring UI.

## 12. Conformance to the audit brief (D1–D12)

This spec implements D1–D12 as written and invents nothing beyond them:

- **D1** — models, fields, defaults, uniques, indexes, and `Restrict` /
  `Cascade` relations are reproduced verbatim in §4. No `Json` columns.
- **D2** — 1:1 status mapping; `cancelled` = mark, never delete (§7.1,
  §7.3).
- **D3** — `vnLocalToUtc` reuse; overnight not supported (§3).
- **D4** — envelope + schedule fields, length limits, `MAX_IMPORT_SCHEDULES
  = 500`, `MAX_IMPORT_JSON_BYTES = 256 KiB`, duplicate-`id` → `400
  VALIDATION_FAILED`, malformed JSON → `400 INVALID_JSON` (§2, §9.3).
- **D5** — engine types/signatures, matching scope, update-field list,
  cancelled-unknown → `created`, cross-connection `failed`, whole-request
  failure writes nothing, transaction rollback, `409 CONCURRENT_IMPORT`,
  preview writes nothing (§5, §7).
- **D6** — `importId` / `payloadHash` replay and `409 IMPORT_ID_CONFLICT`
  (§8).
- **D7** — endpoint, `imp_` token format/storage/once-only display,
  401/403, rate limits, 413, error codes, audit action, `lastUsedAt`,
  no `requireSameOrigin`, `force-dynamic` (§6, §9).
- **D8** — admin page path, actions, RBAC split (any ADMIN: manual
  import + history; SUPER_ADMIN only: connection create/rotate/revoke),
  nav entry (`/admin/schedule-import`, label "Nhập lịch", after
  `/admin/bookings`) — documented here as the UI the API serves; the UI
  itself is Worker C's deliverable. **As-built i18n caveat:** a
  `scheduleImport` key block exists in both `src/i18n/messages/vi.ts`
  and `en.ts` (vi.ts:386 / en.ts:386), but **no component reads
  `dict.scheduleImport`** — the admin page
  (`src/app/(admin)/admin/(protected)/schedule-import/page.tsx`,
  `history/[id]/page.tsx`) and its three client components
  (`src/components/admin/schedule-import-form.tsx`,
  `schedule-import-connections.tsx`, `schedule-import-calendar.tsx`)
  hardcode Vietnamese strings, as do the server actions' messages
  (§6.5). That matches the repo convention that the admin UI is
  Vietnamese-only, but the `en` block is dead strings in v1. The
  **public** booking keys (`booking.importedScheduleSectionTitle` etc.)
  *are* used, via `dict.booking` on the booking page and passed as
  props into `ImportedScheduleList` (which carries no i18n keys of
  its own).
- **D9** — public "Lịch sắp tới" section, `listUpcomingImportedSchedules`
  (upcoming = `startsAt >= now`, status in `scheduled`/`confirmed`,
  default limit 20), no new public route/endpoint (§7.4).
- **D10** — `ScheduleImport` + `ScheduleImportItem` history, no
  credentials or stack traces in history (§4.3–§4.4).
- **D11** — monitoring compat is documentation only (§11); no code, no
  new notification writes, no admin-access changes.
- **D12** — tests are the implementing workers' deliverable; this spec
  does not claim any test results (see the report's TODO verification
  section).

**Known deviations from the audit brief (as-built, Wave 3 revision
2026-11-14 — the spec was aligned to the landed code, the code was not
changed to match the brief):**

1. **D1 — `ImportedSchedule.connectionId` is `String?`, not `String`.**
   The manual scope is `null`, which a non-null column cannot store
   (§4.2). Backstop: partial unique index
   `ImportedSchedule_manual_externalId_key` in the migration.
2. **D1 — `ScheduleImport.status = 'failed'` is never written** by the
   engine in v1 (only `completed` / `completed_with_errors`); likewise
   `errorSummary` is never set (§4.3).
3. **D1 — extra indexes not in the brief:** `ScheduleImport`
   `@@index([connectionId, createdAt])` and `@@index([status,
   createdAt])` (§4.3).
4. **D4 — `generatedAt` accepts `Z` and `+07:00`** via
   `z.iso.datetime({ offset: true })`; naive datetimes are rejected
   (§2.1). The brief did not pin the offset rule.
5. **D4 — exact duplicate-id message is `"Duplicate schedule ids:
   <ids>"`** (`schema.ts:120`), not `"Duplicate schedule ids in
   payload: …"` as the Wave 1 draft showed (§9.3); the details shape
   is `{ fieldErrors: … }`, not a bare field map.
6. **D5/D6 — `payloadHash` is computed by the caller** (route / manual
   actions) via the exported `computeScheduleImportPayloadHash`; the
   engine only falls back to computing it when given an empty value
   (§8.2). Replay items return sorted by `externalId` ascending.
7. **D5 — `cancelled` counts only newly-cancelled rows**; an
   already-cancelled row re-imported with changes is `updated`, unchanged
   is `unchanged` (§5.1, §7.1).
8. **D7 — `authenticateIntegrationRequest` returns inactive connections**
   (null only for missing/unknown tokens); the `imp_` shape is not
   enforced at auth time (§6.2). Size is checked twice (declared
   `Content-Length` + actual byte length, §6.4.1). The per-IP auth rate
   limit also covers revoked-token (403) attempts. `lastUsedAt` updates
   best-effort, only for active connections, at auth time — before the
   rate limit and validation (§6.2).
9. **D7 — exact error messages differ from the Wave 1 draft:** 403
   `"Integration connection is revoked."`, `IMPORT_ID_CONFLICT`
   `importId "<key>" was already used with different content`, two
   distinct `RATE_LIMITED` messages, `VALIDATION_FAILED` message
   `"The import payload failed validation."`, plus `500
   INTERNAL_ERROR` and `503 SERVICE_UNAVAILABLE` via `withApi` (§9.8).
   The route also maps the engine's
   `IntegrationConnectionNotFoundError` to 401 (§7.5).
10. **D7/D8 — two `IntegrationConnectionNotFoundError` classes** with
    the same name exist in `engine.ts` and `connections.ts`; use the
    import from the module you call (§5).
11. **D1/D8 — `autoApply` has no setter and no reader in v1**; it is
    display-only and always `false` via the UI (§4.1, §10.2).
12. **D8 — admin UI strings are hardcoded Vietnamese** even though a
    `scheduleImport` block exists in both `vi.ts` and `en.ts`; the `en`
    block is unused in v1 (§12, D8 bullet above).
13. **D12 — E2E invocation:** the admin E2E spec
    (`e2e/schedule-import.spec.ts`) requires `--config
    e2e/playwright.config.ts` (without it, Playwright's default config
    leaves `baseURL` unset and every relative navigation fails) and
    `E2E_BASE_URL=http://127.0.0.1:<port>` when port 3000 is busy.
    At revision time the Wave 3 API E2E spec
    (`e2e/schedule-import-api.spec.ts`) and the concurrency test
    (`tests/schedule-import-concurrency.test.ts`) had not landed yet —
    they remain Worker F deliverables; see the report §H TODOs.

**No spec section is left unmatchable to code:** every item above is a
documented as-built behavior with a file:line reference, not an open
mismatch.

## 13. Open questions for the owner

1. **Public JSON feed** — D9 defers it to a follow-up (backlog §11.3).
   Should the feed be public, token-gated, or admin-only when it is built?
2. **Overnight support** — §3.3 rejects overnight rows. If customers
   regularly have them, the backlog item should be prioritised and a
   format decision made (e.g. an `endDate` field vs. splitting rows).
3. **Monitoring identity** — §11.2 offers Option A (`READONLY` role) vs
   Option B (scoped read-only connection). The owner should pick one
   before the monitoring phase starts; no work is needed now.
4. **`autoApply` default** — `false` (preview first) is the safe
   default (D1). As-built there is no UI or action to enable it (§4.1,
   §10.2): if a trusted customer wants auto-apply from day one, a
   setter — and a code path that reads the flag — must be built first;
   until then, preview-first is the only enforced behavior.
