# Phase 11 — Website Schedule JSON Importer: Report (DRAFT)

- **Repo:** `NhatNguyenYn/Base-Porfolio-Website-Demo` (working tree `~/workspace/base-portfolio-review/repo-main/`)
- **Date:** 2026-11-14
- **Status:** `DRAFT — implementation in progress; verification numbers NOT yet filled in`
- **Binding decisions:** `~/workspace/base-portfolio-review/phase-11-audit.md` D1–D12
- **Spec:** `docs/SCHEDULE_JSON_IMPORT_SPEC.md`
- **Master prompt:** `~/workspace/base-portfolio-review/phase-11-master-prompt.md` (§1–§15)

> **Draft notice.** This report was written by Worker E (documentation)
> in Wave 1, in parallel with Worker A (schema + engine). It documents
> the implementation as designed in D1–D12 and the spec. The verification
> numbers in §H are **TODO — the coordinator fills them in after running
> its own verification** (typecheck, vitest, `next build`, static export,
> E2E). No test/build numbers in this draft are real results; none have
> been invented. Do not quote this draft as verification.

## A. Executive summary

Phase 11 adds a website-side Schedule JSON Importer to the portfolio
website. An external AI assistant (in the future, Muse) reads a
customer's Excel schedule, converts it to a predefined JSON format, and
submits it to the website; the website validates the JSON, converts VN
wall-clock date/time to UTC, and creates or updates calendar entries in
the existing Phase 10 booking calendar.

What Phase 11 delivers (per the audit brief D1–D12):

- Four new Prisma models (`IntegrationConnection`, `ImportedSchedule`,
  `ScheduleImport`, `ScheduleImportItem`) via an additive migration —
  a generic imported-schedule model, deliberately **not** `Booking` /
  `BookingSlot` rows (D1).
- A Zod v4 envelope + schedule schema with strict limits (D4).
- A shared import engine (preview + apply) used identically by the API
  route and the manual admin import (D5).
- Idempotency at two layers: record-level (re-import = `unchanged`) and
  an optional envelope `importId` key with replay / `409
  IMPORT_ID_CONFLICT` (D6).
- A secure machine-to-machine API, `POST
  /api/integrations/schedules/import`, with per-connection Bearer tokens
  (`imp_…`, SHA-256 stored, shown once), rotation/revocation, per-connection
  and per-IP rate limits, and a 256 KiB payload cap (D7).
- An admin page `/admin/schedule-import` (manual paste → preview →
  confirm, connections panel, history, month calendar) (D8).
- A read-only "Lịch sắp tới" section on the existing public booking page
  (D9) — the Phase 10 calendar extended, not a competing calendar.
- Import history with per-item actions and errors, no credentials or
  stack traces (D10).
- Monitoring compatibility documented only — no monitoring code, no
  changes to admin access or notifications (D11).

What Phase 11 deliberately does **not** do: Muse integration itself (no
connector, no Excel reader — master prompt §1, §10); a standalone
schedule platform; a new public calendar route or public JSON endpoint;
overnight schedules; email/notifications on import; any commit, push,
deploy, or production-DB change (master prompt §14).

## B. Implementation details (per D1–D12)

### B.1 Data model (D1)

Additive migration only; no `Json` columns (repo convention); no existing
table altered destructively.

| Model | Key fields |
|---|---|
| `IntegrationConnection` | `id` (cuid), `name`, `tokenHash` String `@unique` (SHA-256 of the token), `autoApply` Boolean `@default(false)`, `isActive` Boolean `@default(true)`, `lastUsedAt` DateTime?, timestamps |
| `ImportedSchedule` | `id` (cuid), `connectionId` **String? (nullable — D1 deviation, see below)**, `externalId`, `title`, `description` `@default("")`, `location` `@default("")`, `note` `@default("")`, `startsAt`/`endsAt` DateTime (UTC), `status` String (`scheduled\|confirmed\|completed\|cancelled`); `@@unique([connectionId, externalId])`, `@@index([connectionId, startsAt])`, `@@index([status, startsAt])`; connection relation `onDelete: Restrict` (optional relation) |
| `ScheduleImport` | `id` (cuid), `connectionId` String? (null = manual admin import), `source`, `status` (`completed\|completed_with_errors\|failed` — **as-built, the engine only ever writes `completed` or `completed_with_errors`; `failed` is never produced in v1**), `totalRecords`/`createdCount`/`updatedCount`/`unchangedCount`/`cancelledCount`/`failedCount` Int, `importKey` String?, `payloadHash` String?, `createdByUserId` String?, `errorSummary` String? (**never set by the engine in v1 — always null**); `@@unique([connectionId, importKey])`, plus `@@index([connectionId, createdAt])` and `@@index([status, createdAt])` (not in D1, present as-built); items relation `Cascade`, connection relation `Restrict` |
| `ScheduleImportItem` | `id` (cuid), `importId`, `externalId`, `action` (`created\|updated\|unchanged\|cancelled\|failed`), `error` String? (short message only); `@@index([importId])`; import relation `Cascade` |

Why a generic model instead of `Booking`/`BookingSlot` (D1): imports
carry title/description/location/note and no contact, while `Booking`
requires name + email (`NOT NULL`); `BookingSlot` has
`@@unique([serviceId, startsAt])`, which would collide with real slots;
and status `scheduled` has no booking attached. Connection delete is not
offered in the v1 UI, and revocation never deletes history
(`onDelete: Restrict`).

**As-built deviation (D1): `ImportedSchedule.connectionId` is nullable.**
D1 wrote `connectionId String`, but the manual-admin scope is `null`
and cannot be stored in a non-null column, so the landed schema has
`connectionId String?` (`prisma/schema.prisma:833`, deviation noted in
a comment at `:828–832`). Because Postgres treats NULLs as distinct,
`@@unique([connectionId, externalId])` does not fire for manual-scope
rows; the migration
(`prisma/migrations/20261114092518_phase11_schedule_import/migration.sql`)
adds the partial unique index
`ImportedSchedule_manual_externalId_key` (`UNIQUE ("externalId") WHERE
"connectionId" IS NULL`) as the manual-scope backstop, so a concurrent
duplicate manual import still fails with P2002 → `409
CONCURRENT_IMPORT`. Real files: `prisma/schema.prisma` (4 models) +
migration `20261114092518_phase11_schedule_import`.

### B.2 Schema and limits (D4)

- New file `src/lib/schedule-import-schema.ts` (Zod v4; `validation.ts`
  is not bloated): `scheduleImportEnvelopeSchema` and
  `scheduleImportScheduleSchema`, exporting `ScheduleImportEnvelope` and
  a `ValidatedSchedule`-compatible parse output. `ValidatedSchedule`
  and `ImportedScheduleStatus` are defined here and re-exported by the
  engine.
- New file `src/lib/schedule-import-limits.ts`: `MAX_IMPORT_SCHEDULES
  = 500`, `MAX_IMPORT_JSON_BYTES = 256 * 1024`, plus the field-length
  consts (schedule `id` ≤ 128, `title` 1–200, `description` ≤ 2000,
  `location` ≤ 200, `note` ≤ 2000, envelope `importId` ≤ 128, envelope
  `source` ≤ 128 — `MAX_IMPORT_SOURCE_LENGTH`, not named in D4 but
  present as-built), and both rate-limit consts (`IMPORT_API_LIMIT`,
  `IMPORT_AUTH_LIMIT`).
- Envelope: `{ type: "schedule_import", version: "1.0", source: string,
  generatedAt: string (ISO datetime), schedules: [...] }`, plus optional
  `importId` and API-only `preview?: boolean`. Only `type =
  "schedule_import"` and `version = "1.0"` are accepted. Duplicate `id`
  within one payload → `400 VALIDATION_FAILED` with details naming the
  duplicated ids; malformed JSON → `400 INVALID_JSON`.
- As-built schema details (Wave 3 revision): `generatedAt` is
  `z.iso.datetime({ offset: true })` — both `Z` and `+07:00` accepted,
  naive datetimes rejected (`schema.ts:100`); the exact duplicate-id
  message is `"Duplicate schedule ids: <ids>"` (`schema.ts:120`); `id` /
  `title` / `date` / `start` / `end` / `source` / `importId` are
  trimmed, `description` / `location` / `note` are not (only
  length-capped); a present-but-empty `importId` is rejected (min 1);
  an empty `schedules` array is accepted (zero-record import).
- Full field definitions, examples, and the date/time rules are in the
  spec (`docs/SCHEDULE_JSON_IMPORT_SPEC.md` §2–§3).

### B.3 Timezone (D3)

Reuse, don't reinvent (Phase 10 §K.1): `VN_TIME_ZONE =
"Asia/Ho_Chi_Minh"`, `vnLocalToUtc("YYYY-MM-DD", "HH:MM") → Date | null`
(round-trip guarded), `utcToVnLocalParts`, `formatVnDateTime` from
`src/lib/booking-time.ts`. Date + start/end are VN wall-clock → UTC.
Invalid values (`vnLocalToUtc` null) and `end <= start` are rejected.
**Overnight schedules are NOT supported in v1** — documented in the spec
§3.3 and listed as a backlog follow-up (§J).

### B.4 Import engine (D5)

`src/server/schedule-import/engine.ts` exports the types
`ImportedScheduleStatus`, `ImportAction`, `ImportItemResult`,
`ImportSummary`, `ValidatedSchedule`, and the functions
`previewScheduleImport` / `applyScheduleImport` with the signatures in
the audit brief §2 / spec §5 — plus, as-built, the exported helper
`computeScheduleImportPayloadHash` and the error classes
`ImportIdConflictError`, `ConcurrentImportError`, and
`IntegrationConnectionNotFoundError` (engine's own copy — see below).

Rules implemented:

- Matching scoped to `connectionId` (`null` = manual scope; manual and
  API scopes never match each other).
- Existing + fields changed → update only title / description / location
  / note / `startsAt` / `endsAt` / `status` — never anything else.
- Existing + unchanged → `unchanged`. New → `created`.
- Payload `status: "cancelled"` on an existing record → `cancelled`
  (row kept); on a non-existent record → create as cancelled, counted
  as `created`, not `cancelled`. **As-built nuance:** `cancelled` counts
  only a *newly*-cancelled row — an already-cancelled row re-imported
  with other fields changed counts as `updated`, unchanged as
  `unchanged` (`engine.ts:163–170`).
- Cross-connection collision: an `externalId` owned by a different
  connection → item `failed` with error `"already owned by another
  connection"`, excluded from writes; the rest apply and the import
  commits with `failedCount > 0` (`status: "completed_with_errors"`).
- Whole-request schema failure → `400`, nothing written. Unexpected DB
  error inside the transaction → full rollback.
- Concurrency backstop `@@unique([connectionId, externalId])` **plus**
  the partial manual-scope index (§B.1); on `P2002` inside apply,
  surface `409 CONCURRENT_IMPORT` (client retries; retry is safe
  because apply is record-idempotent). The P2002 catch also covers a
  race on `ScheduleImport @@unique([connectionId, importKey])`.
- Preview performs no writes and creates no `ScheduleImport` row.
- **Two `IntegrationConnectionNotFoundError` classes exist** with the
  same name: one in `engine.ts:83` (thrown by apply when the connection
  id does not exist; the route maps it to 401), one in
  `src/server/schedule-import/connections.ts:59` (thrown by rotate /
  revoke for an unknown id). They are different classes in different
  modules — use the import from the module you call.
- The engine itself writes no audit log and never sets
  `ScheduleImport.errorSummary`; logging lives in the route / admin
  actions (§B.6, §B.7).

### B.5 Idempotency (D6)

- Record-level (always on): re-submitting the same payload yields
  `unchanged` for every record.
- Envelope-level (optional `importId`): `payloadHash` = SHA-256 of the
  canonical JSON of the validated schedules sorted by `externalId`.
  **As-built, the caller computes it** — the route via the engine's
  exported `computeScheduleImportPayloadHash` (`route.ts:131`), the
  manual actions likewise; the engine only computes it as a fallback
  when given an empty value (`engine.ts:249`). Same
  (`connectionId`, `importKey`) with the same hash → return the stored
  summary + `importId` without re-applying (replay). Same key with a
  different hash → `409 IMPORT_ID_CONFLICT` (exact message:
  `importId "<key>" was already used with different content`). Manual
  imports use `importKey: null` (no replay semantics). **Replayed items
  come back sorted by `externalId` ascending**, not in payload order
  (`engine.ts:266`). A replay is still audit-logged as an apply by the
  route (§B.6).

### B.6 Integration API (D7)

- `POST /api/integrations/schedules/import`,
  `export const dynamic = "force-dynamic"`, responses via the `withApi`
  `ok` / `fail` envelope. Success bodies carry `"preview": true/false`
  alongside `summary` (and `importId` on apply) — see spec §9.1–§9.2.
- Auth: `Authorization: Bearer imp_<32 hex chars>`; token =
  `imp_` + `randomBytes(16).toString("hex")`, generated server-side,
  stored as SHA-256 (`tokenHash`), shown once at creation, never logged,
  never sent to the frontend except in that one creation response.
  Missing/bad token → `401 UNAUTHORIZED` (`"Missing or invalid
  integration token."`); revoked/inactive connection → `403 FORBIDDEN`
  (`"Integration connection is revoked."`).
  **As-built:** `authenticateIntegrationRequest` returns `null` only
  for a missing/malformed/unknown token; a known inactive connection is
  returned with `isActive: false` so the route can answer 403
  (`connections.ts:147–187`). The Bearer parser is case-insensitive
  and the `imp_` shape is not enforced at auth time — any non-empty
  token is hashed and looked up. `lastUsedAt` updates only for active
  connections, best-effort (`.catch(() => undefined)`), at auth time —
  before the rate limit and validation, so even a later-rejected
  request refreshes it.
- Rate limits: authenticated per-connection `import:<connectionId>` —
  `IMPORT_API_LIMIT = { limit: 30, windowMs: 10 * 60 * 1000 }`;
  unauthenticated **and revoked-token** attempts per hashed IP —
  `IMPORT_AUTH_LIMIT = { limit: 10, windowMs: 60 * 1000 }` (both the
  401 and the 403 path go through the per-IP limiter);
  `429 RATE_LIMITED` with two distinct messages — `"Too many import
  requests. Please try again shortly."` (per-connection) vs `"Too many
  import attempts. Please try again shortly."` (per-IP).
- Size: **two layers** — declared `Content-Length` >
  `MAX_IMPORT_JSON_BYTES` → `413 PAYLOAD_TOO_LARGE` (fast path, before
  auth), then the actual body byte length (`Buffer.byteLength`) checked
  again after reading, covering chunked requests with no
  `Content-Length`. Message: `"Request body is too large."`
- Check order as-built: size (declared) → auth (401/403) → per-IP auth
  limit → per-connection limit → read body + size (actual) → JSON parse
  (`INVALID_JSON`: `"Request body must be valid JSON."`, or `"Request
  body must be a JSON object."` for a non-object value) → schema
  validation → preview/apply.
- Body: envelope + optional `preview?: boolean` (`true` = preview only).
  No `requireSameOrigin` (machine-to-machine Bearer auth, not cookies —
  rationale in the spec §6.2).
- Error codes: `400 INVALID_JSON` / `VALIDATION_FAILED` (message
  `"The import payload failed validation."`, specifics in
  `details.fieldErrors` via `zodFieldErrors`), `401 UNAUTHORIZED`,
  `403 FORBIDDEN`, `409 IMPORT_ID_CONFLICT` / `CONCURRENT_IMPORT`
  (`"A concurrent import conflicted. Please retry the import."`), `413
  PAYLOAD_TOO_LARGE`, `429 RATE_LIMITED`. Plus, via `withApi`:
  `500 INTERNAL_ERROR` (`"Something went wrong."`) and `503
  SERVICE_UNAVAILABLE` (`"Service temporarily unavailable. Try again
  shortly."`). Never leak stack traces or tokens. The route also maps
  the engine's `IntegrationConnectionNotFoundError` to `401
  UNAUTHORIZED` (`"Integration connection no longer exists."`).
- Audit: `logActivity` on apply (action `schedule_import.apply`,
  `entityType: "ScheduleImport"`, summary with counts + connection name,
  `userId: null`) and on connection create/rotate/revoke (actions
  `integration_connection.create` / `.rotate` / `.revoke`). The apply
  audit lives in the **route**, after `applyScheduleImport` returns —
  so an idempotency **replay is also logged**. Preview is never logged.
  `lastUsedAt` updated on successful auth (best-effort, §B.6 above).
- Connections module: `src/server/schedule-import/connections.ts`
  (`createIntegrationConnection`, `rotateIntegrationConnection`,
  `revokeIntegrationConnection`, `authenticateIntegrationRequest`,
  `hashIntegrationToken`). Connection names are validated there
  (trimmed, 1–200 chars); `createIntegrationConnection` always stores
  `autoApply: false` — there is no setter for it in v1 (§B.7).

### B.7 Admin UI (D8)

- Pages under `src/app/(admin)/admin/(protected)/schedule-import/`:
  `page.tsx` (paste JSON → preview → confirm; connections panel; history
  list; month calendar of imported schedules with date/status filters)
  and `history/[id]/page.tsx` (per-item table + errors). Client
  components: `src/components/admin/schedule-import-form.tsx`
  (paste/preview/confirm + sample JSON `MAU-001`/`MAU-002`),
  `schedule-import-connections.tsx` (list/create/rotate/revoke + one-time
  token display), `schedule-import-calendar.tsx` (month grid, max 3
  schedules per day then `"+N lịch nữa"`). Read queries in
  `src/server/queries/schedule-import.ts` (`listIntegrationConnections`,
  `listScheduleImports`, `getScheduleImportDetail`,
  `listImportedSchedulesForCalendar`, `currentVnMonth`).
- Server actions in `src/server/actions/schedule-import.ts`:
  `previewManualImportAction`, `applyManualImportAction` (engine with
  `connectionId: null`, `source: "admin-manual"`),
  `createIntegrationConnectionAction`,
  `rotateIntegrationConnectionAction`,
  `revokeIntegrationConnectionAction`. Manual parsing lives in
  `src/lib/schedule-import-manual.ts` (`parseManualImportJson` — size
  check first, then JSON parse, then the shared schema; exact
  Vietnamese messages in spec §6.5).
- RBAC: manual import + history viewing — any `ADMIN`. Connection
  create/rotate/revoke — `SUPER_ADMIN` only (credential ops), enforced
  with `requireUser()` / `requireSuperAdmin()` in the actions (the
  panel also hides the controls for non-super-admins). No `authorize()`
  call is used in the actions or the route — auth there is
  `requireUser()` / `requireSuperAdmin()` (actions) and the Bearer
  token (route).
- **As-built i18n caveat:** a `scheduleImport` key block exists in both
  `src/i18n/messages/vi.ts` and `en.ts`, but **no component reads
  `dict.scheduleImport`** — the admin page, detail page, all three
  components, and the server actions hardcode Vietnamese strings
  (admin UI is Vietnamese-only by repo convention; the `en` block is
  dead strings in v1). The public booking keys *are* used
  (`dict.booking.*`, §B.8).
- **As-built `autoApply` caveat:** the connections panel only
  **displays** `autoApply` ("Tự áp dụng: Có/Không"). There is no UI
  control and no server action to change it, and no code path reads it
  — every connection is created with `false` and stays `false` unless
  changed directly in the database. "A SUPER_ADMIN enables auto-apply
  per connection in `/admin/schedule-import`" (Wave 1 draft wording) is
  **not true as-built**; see spec §10.2.
- Nav: `{ href: "/admin/schedule-import", label: "Nhập lịch", icon:
  CalendarClock }` right after `/admin/bookings`, plus the title-map
  entry `"/admin/schedule-import": "Nhập lịch"`.
- i18n: a `scheduleImport` key block in `src/i18n/messages/vi.ts` +
  `en.ts` (Worker C owns all `vi.ts`/`en.ts` edits, including the booking
  keys Worker D needs — see audit §4).
- Preview UX: invalid JSON/schema errors inline, no stack traces.
  Confirm applies via the same engine as the API. Manual apply logs
  `schedule_import.apply` with `userId` = the acting admin; manual
  preview logs nothing. A `preview: true` flag inside pasted manual JSON
  is silently ignored (preview/apply is chosen by the button).

### B.8 Public calendar (D9)

- `src/app/(public)/[locale]/booking/page.tsx` gains a read-only "Lịch
  sắp tới" section (title, VN date + time range, status chip — plus
  location and description when set, rendered by
  `src/components/site/imported-schedule-list.tsx`). The section sits
  after the service list and before the cancel/lookup link.
- Query in `src/server/queries/schedules.ts`:
  `listUpcomingImportedSchedules({ from?, to?, limit? })` — upcoming =
  `startsAt >= now` AND `status` in (`scheduled`, `confirmed`), ordered
  `startsAt` ascending, default `limit` 20; `cancelled`/`completed`
  hidden here. As-built: a past `from` is clamped to now; `to` is an
  inclusive upper bound on `startsAt`. The list mixes all connections
  and the manual scope with no connection attribution.
- No new public route and no new public JSON endpoint in v1
  (server-component query only). A public feed is a backlog item (§J).
- The booking page is already staged out of the static export; no
  `pages.yml` change is needed (audit §1).

### B.9 Import history (D10)

- `ScheduleImport` + `ScheduleImportItem` per §B.1. Admin history list
  (paginated, filter by source/status) + detail page. No credentials in
  history; error strings only.
- As-built query precision (`src/server/queries/schedule-import.ts`):
  history `perPage` is clamped to 1–50 (default 10), newest first; the
  `source` filter is a case-insensitive **substring** match, `status`
  is exact. The month calendar returns at most 500 rows; a `date`
  filter wins over `month`, and an invalid `month` falls back to the
  current VN month. `ScheduleImport.status = 'failed'` and
  `errorSummary` are never populated by v1 code (§B.1) — the detail
  page renders them only if ever set.

### B.10 Monitoring compatibility (D11 — documentation only)

No code. The spec §11 documents the existing mechanisms — `User.role`
(`SUPER_ADMIN` / `ADMIN`, `src/server/auth.ts`), the `ps_session`
SHA-256 session cookie (7-day TTL), and `ActivityLog` via `logActivity()`
(`src/server/audit.ts`, never throws, summaries sliced to 400 chars) —
and proposes a future read-only monitoring identity (recommended: a new
`READONLY` role value + dedicated session, or a scoped read-only
`IntegrationConnection`). Imports stay separate from content and
notifications: no new notification writes, no changes to admin access.

## C. Files changed (Phase 11, by worker)

Per the audit brief §4 file ownership (no two workers edit the same file):

| Worker | Owns |
|---|---|
| A | `prisma/schema.prisma`, migration `20261114092518_phase11_schedule_import`, `src/lib/schedule-import-schema.ts`, `src/lib/schedule-import-limits.ts`, `src/server/schedule-import/engine.ts`, `tests/helpers/phase11.ts`, `tests/schedule-import-schema.test.ts`, `tests/schedule-import-engine.test.ts` |
| B | Integrations route `src/app/api/integrations/schedules/import/route.ts`, `src/server/schedule-import/connections.ts`, `e2e/temp-connection.mjs`, `tests/schedule-import-api.test.ts` |
| C | Schedule-import admin routes (`page.tsx`, `history/[id]/page.tsx`), `src/server/actions/schedule-import.ts`, `src/lib/schedule-import-manual.ts`, `src/server/queries/schedule-import.ts`, admin components (`schedule-import-form.tsx`, `schedule-import-connections.tsx`, `schedule-import-calendar.tsx`), admin-shell nav entry, `vi.ts`/`en.ts` (all i18n), `e2e/schedule-import.spec.ts`, `tests/schedule-import-admin.test.ts` |
| D | `src/server/queries/schedules.ts`, `src/components/site/imported-schedule-list.tsx`, booking `page.tsx` (append section only), `tests/schedules-query.test.ts` |
| E (docs) | `docs/SCHEDULE_JSON_IMPORT_SPEC.md`, this report, `docs/POST_LAUNCH_BACKLOG.md` (Phase 11 items) |
| F (Wave 3, not yet landed at revision time) | `e2e/schedule-import-api.spec.ts`, `tests/schedule-import-concurrency.test.ts`, plus E's spec-alignment pass (Wave 3) |

Real files landed (Wave 3 revision): the A/B/C/D files above, plus the
migration `prisma/migrations/20261114092518_phase11_schedule_import/migration.sql`.
**Not yet landed at revision time:** `e2e/schedule-import-api.spec.ts`
and `tests/schedule-import-concurrency.test.ts` (Worker F, Wave 3) —
they are still TODO, not claimed as done anywhere in this report (see
§E, §H).

Nobody touches `src/lib/booking-time.ts`, `src/lib/flowers.ts`,
survey/booking Phase 10 code (except the D9 booking-page append and the
C nav entry), production env vars, or `prisma/seed.ts` (no seed changes
in v1).

## D. Security review

- **Credentials:** integration tokens are generated server-side with
  `randomBytes(16)`, stored only as SHA-256 (`tokenHash`), shown once,
  never logged, never sent to frontend code except in the one creation
  response. The same hash-only pattern as `Session.tokenHash`. Rotation
  invalidates the old token; revocation disables the connection without
  deleting its history. Admin session cookies are never reused for
  machine-to-machine access (master prompt §10).
- **Scope isolation:** every schedule belongs to exactly one connection
  (`@@unique([connectionId, externalId])`); cross-connection `externalId`
  reuse fails per-item with `"already owned by another connection"` and
  is never overwritten or read. Manual and API scopes never match each
  other. No endpoint exposes another connection's schedules.
- **Input validation:** Zod v4 on the whole envelope; field-length caps,
  500-schedule cap, 256 KiB body cap; date/time via the round-trip-guarded
  `vnLocalToUtc`; duplicate ids in one payload rejected; malformed JSON
  → `400 INVALID_JSON`. Input is JSON data only — no executable code is
  ever run (master prompt §3). Whole-request schema failure writes
  nothing.
- **Rate limiting:** per-connection (30 / 10 min) and per-hashed-IP
  unauthenticated (10 / 1 min) fixed windows; raw IPs are never stored
  (`hashedKey`). The limiter is a guard, not the correctness mechanism —
  uniqueness is DB-level.
- **Transactions / concurrency:** apply runs in a transaction; unexpected
  DB errors roll back fully; the unique constraint is the concurrency
  backstop (`409 CONCURRENT_IMPORT`, safe retry).
- **Audit:** apply + connection lifecycle actions are logged via
  `logActivity()` (never throws); summaries carry counts + connection
  name, never tokens or stack traces.
- **RBAC:** credential operations (connection create/rotate/revoke) are
  `SUPER_ADMIN`-only; manual import and history are any-`ADMIN`. The
  public calendar shows title/date/time/status only — no connection,
  token, contact, or internal-id data. **As-built gaps to know:**
  `autoApply` is display-only with no setter and no reader (§B.7), so
  "preview first unless auto-apply" is a procedural rule, not an
  enforced gate; and the Bearer-token shape (`imp_` + 32 hex) is not
  enforced at auth time — any non-empty token is hashed and looked up,
  unknown tokens simply 401.
- **No new attack surface in the static export:** the new admin/API routes
  are staged out automatically (audit §1); the coordinator's export check
  must confirm no new HTML leaks (see §H).
- **Residual risks (accepted, see §G):** rate limiting is in-process per
  instance (same as Phase 10); a `READONLY` monitoring role does not exist
  yet, so monitoring must wait for its own phase (§I).

## E. Testing

Test plan per master prompt §12 and audit D12 (workers own their own
tests; Worker F owns E2E + concurrency + rollback in Wave 3):

- Valid JSON imports; invalid JSON; missing required fields; invalid
  dates/times; `end <= start`; duplicate ids in one payload.
- New schedule creation; existing-schedule update; unchanged; cancelled
  (existing and non-existent); repeated identical imports (record-level
  idempotency); import-id reuse with different payload (`409
  IMPORT_ID_CONFLICT`) and replay (same payload, stored summary).
- Cross-connection isolation; unauthorized API requests (missing/bad
  token → 401; revoked connection → 403); rate limiting; oversized
  payload (413).
- Concurrent imports (no duplicates; `409 CONCURRENT_IMPORT` + safe
  retry); transaction rollback on forced failure; calendar rendering
  (public "Lịch sắp tới" section + admin month calendar).
- TypeScript, ESLint, unit + integration tests, relevant E2E tests
  (production build, temp admin via `e2e/temp-admin.mjs`, plus the new
  `e2e/temp-connection.mjs` helper from Worker B), production build.
  **E2E invocation (as-built, `e2e/schedule-import.spec.ts` header):**
  Playwright must be run with `--config e2e/playwright.config.ts`
  (without it the default config leaves `baseURL` unset and every
  relative navigation fails) and `E2E_BASE_URL=http://127.0.0.1:<port>`
  when port 3000 is busy. At revision time the Wave 3 API E2E spec and
  the concurrency test had not landed yet (see §C) — they remain Worker
  F deliverables, not results claimed here.

Results: see §H — verified by the coordinator 2026-11-14: typecheck 0
errors; vitest 41 files / 396 tests green; production build exit 0;
static export 73 HTML / 228 files (Phase 10 baseline); E2E 14/14 passed.

## F. Known limitations

1. **Overnight schedules are not supported** (D3, spec §3.3): `end <=
   start` on the same date is rejected. Backlog item (§J).
2. **No public JSON feed** for imported schedules in v1 (D9): the public
   calendar is a server-component query only. Backlog item (§J).
3. **No direct `.xlsx` import** (master prompt §3–§4): the website
   accepts JSON only; Excel → JSON conversion is the future agent's job.
   Backlog item (§J).
4. **No drag-and-drop / calendar drag UI** in v1: the admin calendar has
   date/status filters; moving a schedule means re-importing it with a
   new time. Backlog item (§J).
5. **No webhook on import completion** in v1: the caller learns the
   result only from the synchronous API response (or the admin history
   page). Backlog item (§J).
6. **No read-only monitoring role yet** (D11): monitoring compatibility
   is documentation only in this phase. Backlog item (§J).
7. **Missing records are never auto-deleted or auto-cancelled** (master
   prompt §6, D5): this is a deliberate safety rule, not a bug — but it
   means stale schedules stay on the calendar until explicitly cancelled
   by a later import.
8. **A cancelled-unknown record is created as cancelled** (D5): an
   import that cancels an `externalId` the site has never seen creates a
   cancelled row (counted `created`) so later updates can find it. This
   is by design, but it means a typo'd cancel creates a row.
9. **Rate limiting is in-process per instance** (same as Phase 10):
   under multiple instances the per-connection limit is per-instance,
   not global. DB constraints, not the limiter, enforce uniqueness.
10. **Preview does not reserve an `importId`** (D6): previewing and then
    applying with the same `importId` is a normal first apply. Two
    different clients applying the same `importId` concurrently rely on
    the unique constraint + `409` handling.
11. **`autoApply` has no setter and no reader in v1** (§B.7, spec
    §10.2): it is display-only, always `false` via the UI. A setter +
    a code path that reads the flag are needed before it can mean
    anything.
12. **The `scheduleImport` i18n block (`en`) is unused in v1** (§B.7):
    the admin UI hardcodes Vietnamese; the `en` strings are dead until
    a component reads `dict.scheduleImport`.
13. **`ScheduleImport.status = 'failed'` and `errorSummary` are never
    populated in v1** (§B.1): a whole-request failure creates no row.
14. **Replayed items return sorted by `externalId`** (§B.5), not in
    payload order; an already-cancelled row re-imported with changes
    counts as `updated`, not `cancelled` (§B.4).

## G. Future integration requirements

For the future Muse integration (master prompt §10–§11; full instructions
in the spec §10):

1. The agent reads the customer's Excel file, maps one row → one schedule
   object, uses a **stable** `id` per row (never Excel row numbers), and
   builds the §2 envelope (`type: "schedule_import"`, `version: "1.0"`).
2. It sends the JSON to `POST /api/integrations/schedules/import` on the
   full-stack deployment (never the static Pages demo) with the
   connection's `Authorization: Bearer imp_…` token, obtained once from a
   SUPER_ADMIN in `/admin/schedule-import` and stored in the agent's own
   credential store.
3. It uses a fresh `importId` per import run and reuses it only for an
   exact retry of the same payload.
4. It **respects `autoApply`**: when `autoApply` is `false` (the default
   — and the only value reachable through the UI in v1, §B.7), it
   previews first (`preview: true`) and applies only after admin
   approval; when `true` (only reachable by direct DB edit until a
   setter exists), it may apply directly.
5. It reports the import summary (created/updated/unchanged/cancelled/
   failed + per-item errors) to the customer, and escalates
   cross-connection failures (`"already owned by another connection"`)
   to the site owner instead of retrying them.
6. It never sends executable code, never invents fields/endpoints/
   statuses, never shares one connection's token across customers, and
   never deletes schedules by omitting them — cancellation is an explicit
   `status: "cancelled"` record.
7. The monitoring workflow (§11 of the master prompt) is a separate
   future phase: it needs an owner decision between the `READONLY` role
   (Option A, recommended) and a scoped read-only `IntegrationConnection`
   (Option B) — see spec §11.2. No monitoring code exists in Phase 11.

## H. Verification — run by the coordinator, 2026-11-14

All checks below were run by the coordinator itself (not by the feature
workers) against the final working tree, local DB only. No numbers are
invented.

- **TypeScript:** `npm run typecheck` — **0 errors** (final run). Note: the
  first run found 6 errors in Worker F's
  `tests/schedule-import-concurrency.test.ts` (lines 98–107:
  `Promise.allSettled` narrowing used a hand-written summary type instead of
  the real `ImportSummary`); the coordinator fixed the test to import `type
  ImportSummary` from the engine and re-ran typecheck → 0 errors. Vitest
  does not typecheck, which is why the suite was green while tsc failed.
- **Vitest (full suite):** **41 files / 396 tests — 396 passed, 0 failed**
  (plain `npm test`, 2026-11-14). Baseline before Phase 11: 35 files / 318
  tests → +6 files, +78 tests (schema 19, engine 15, api 27, admin 10,
  schedules-query 5, concurrency 2).
- **Test-runner fix (coordinator):** `npm test` (vitest 5.1.0) ignored
  `fileParallelism: false` in `vitest.config.ts` and ran files in parallel
  on the shared `portfolio_test` DB → flaky failures (workers reported
  386–391/394 with varying files, including Phase 10 files). The coordinator
  changed `package.json`: `"test": "vitest run --fileParallelism=false"`.
  Plain `npm test` is now deterministic: 41 files / 396 tests green on the
  coordinator's run.
- **Production build:** `npm run build` (full-stack, local DB) — **exit 0**.
  Routes present: `/admin/schedule-import` (6.2 kB),
  `/admin/schedule-import/history/[id]`,
  `/api/integrations/schedules/import` (ƒ dynamic).
- **Static export:** `PAGES_EXPORT=1` with the exact
  `.github/workflows/pages.yml` recipe (staging + restore) — **exit 0, 73
  HTML / 228 files, exactly the Phase 10 baseline**. Leaked server HTML in
  `out/`: survey 0, booking 0, admin 0, schedule 0, integrations 0 (the 2
  `*api*` matches are the pre-existing `signal-api` project pages). Note:
  the recipe's `sed force-dynamic → force-static` step left 16 files
  modified in the working tree; the coordinator reverted all 16 (0 `export
  const dynamic = "force-static"` lines remain; tree back to its
  pre-export state).
- **E2E (Playwright, production build, coordinator's own run, port 3200):**
  **14/14 passed in ~20 s** — 1 setup login + 9 API
  (`e2e/schedule-import-api.spec.ts`: valid import, preview writes nothing,
  401/403, INVALID_JSON/VALIDATION_FAILED, idempotency replay,
  IMPORT_ID_CONFLICT, cross-connection, both rate limits) + 4 admin
  (`e2e/schedule-import.spec.ts`: preview → confirm → history/detail,
  invalid JSON, duplicate ids, connection create-once + revoke). Worker F's
  concurrency tests (2/2, repeated 4× green by F) are included in the 396
  vitest count above.
- **Real-API smoke check (coordinator):** created a connection via
  `e2e/temp-connection.mjs`, POSTed a 2-schedule payload with the real
  Bearer token → **200, `created: 2`**, import row `completed`; the
  schedules rendered on the public page (see visual check). (An initial 401
  in the coordinator's check was a manual token-transcription error,
  re-tested programmatically → success; not an app bug.)
- **Visual check (coordinator, headless Chrome):** `/vi/booking` at 1920px
  and 390px with 2 real imported schedules — the "Lịch sắp tới" section
  renders correctly (VN times 09:00 16/11/2026–10:00 and 14:00
  17/11/2026–15:30, status chips "Đã xác nhận" / "Đã lên lịch", location
  "Phòng A", description); services + cancel link intact; no overflow at
  390px. `/admin/schedule-import` at 1440px with the E2E admin session —
  manual-import form, connections panel, nav entry all render correctly.
  (Screenshots are in /tmp, ephemeral; the parent may still do a live
  visual pass.)

## I. Remaining issues / open questions

- **Open questions for the owner** (spec §13): public JSON feed access
  model; whether overnight support should be prioritised; monitoring
  identity Option A vs Option B; `autoApply` default (`false`) is the
  safe default — **but there is no UI/action to enable it in v1**
  (§B.7, spec §10.2), so enabling auto-apply for a trusted customer
  needs a setter to be built first.
- **Spec conformance:** the Wave 1 draft claimed "no known deviations
  from D1–D12". The Wave 3 revision (2026-11-14, this report) corrects
  that: the spec §12 now lists 13 as-built deviations from the audit
  brief (nullable `connectionId` + partial unique index, `generatedAt`
  offset rule, exact error messages, `autoApply` display-only,
  hardcoded-Vietnamese admin UI with unused `en` block, two
  `IntegrationConnectionNotFoundError` classes, `status: 'failed'` /
  `errorSummary` never written, and others) — each with a file:line
  reference. The spec was aligned to the landed code; no code was
  changed for the revision.
- **Post-launch follow-ups:** see §J (appended to
  `docs/POST_LAUNCH_BACKLOG.md`).

## J. Post-launch follow-ups (Phase 11)

Appended to `docs/POST_LAUNCH_BACKLOG.md` (numbered after the Phase 10
items there):

- Public JSON feed for imported schedules.
- Overnight schedule support.
- Drag-and-drop / drag-to-move calendar UI.
- Direct `.xlsx` file import.
- Webhook notification when an import finishes.
- `READONLY` role for monitoring (§11).

Each item is marked "Phase 11 follow-up" in the backlog.

## K. Git summary

No commit / push / deploy was done (master prompt §14, audit hard rules).
All Phase 11 work is local and uncommitted, per the phase rules. The
documentation deliverables from Worker E are `docs/SCHEDULE_JSON_IMPORT_SPEC.md`,
this report, and the Phase 11 entries in `docs/POST_LAUNCH_BACKLOG.md`.
