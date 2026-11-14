# Phase 10 — Custom Survey System + Booking: Final Report

- **Repo:** `NhatNguyenYn/Base-Porfolio-Website-Demo` (working tree `~/workspace/base-portfolio-review/repo-main/`, base `main @ d5d9182` + uncommitted work)
- **Date:** 2026-11-14
- **Status:** `PHASE 10 COMPLETED WITH WARNINGS` — all features implemented and verified by the coordinator (see "Coordinator verification" below). Remaining warnings are documented limitations/follow-ups only (§J): no Critical or High open items.
- **Coordinator verification (2026-11-14, run by the coordinator — not by the feature agents):** `npm run typecheck` **0 errors**; full vitest **34 files, 314 tests — 314 passed** (the 2 failures in §G.4 were test-side, fixed by Agent G, confirmed green here); full-stack `next build` **exit 0**; static export `PAGES_EXPORT=1` **exit 0, 73 HTML files / 228 files** (exactly the live-fix baseline, zero `survey/`/`booking/`/`admin/`/`api/`/`preview/`/`media/` HTML); Playwright E2E **14/14 passed** against the production build (survey 8 + booking 5 + setup 1; one run first failed on a test-selector artifact — the seeded demo service made the "Chọn dịch vụ này" link ambiguous — and passed 6/6 on re-run after the demo service was temporarily removed, then re-seeded); responsive overflow check **8/8 passed** (no horizontal overflow at 1920px or 390px on `/vi/survey/khao-sat-trai-nghiem-tu-van`, `/vi/booking`, `/vi/booking/tu-van-1-1`, `/vi/booking/cancel`). Demo seed verified in the local DB: survey published (`editorial-vn`, intake, 2 sections, 8 questions, all 8 types), service `tu-van-1-1` + **14 slots** (2026-11-15 → 2026-11-21, 09:00/14:00 VN, all available). Temp E2E admin created and deleted; zero E2E fixture rows left in the DB.
- **Scope note:** no commit, no push, no deploy, no production-database change. All work is local and uncommitted, per master prompt §16.
- **Agents:** A/A2 schema, B survey admin, C public survey, D responses/export, E booking, F integration (this report). Feature code is B–E's; F integrated (nav, dashboard, i18n merge, middleware, staging, seed, fixes listed in §A.3).

---

## A. Executive Summary

### A.1 Module đã triển khai

A complete Custom Survey System plus a consulting Booking system, integrated with each other and with the existing portfolio:

- **Survey builder (admin):** create/edit/duplicate/publish/close/archive surveys; sections; all 8 question types; per-question config (required, placeholder, min/max length, min/max rating, options); theme customisation (5 presets incl. `editorial-vn`, layout, progress style, button style, border radius, validated hex colours, brand header, completion badge gradient); cover image via the existing media pipeline; admin preview (`/preview/survey/[id]`).
- **Public survey:** `/[locale]/survey/[slug]` — intro (brand band, editorial title, coloured-dot bullets), multi-step wizard (one step per section, answers kept when going back, per-step required validation, progress indicator), completion screen with gradient badge; closed surveys show the pink "survey ended" status card instead of a bare 404; drafts/untranslated surveys 404.
- **Response management (admin):** response overview (totals, completion, timeline, average rating/NPS, distribution), individual response detail, aggregated results, UTF-8 CSV export with formula-injection guard (admin-only).
- **Booking (admin + public):** services (e.g. "Tư vấn 1-1", 30 min) with a designated intake survey; future slots in VN time (stored UTC); public 4-step flow (slot → contact → intake survey → confirm) creating booking + survey response in **one transaction**; reference code `BK-` + 6 chars; flower code name (30-flower pool, unique among active bookings, freed on cancel/complete); public calendar shows **only the flower name**, never real name/phone/email; cancel/lookup by reference code + email (no login); admin confirm/cancel/complete; cancelling frees the slot.
- **Anonymity (15:17 correction — the rule that governs):** booking contact fields (name, phone, email) are **REQUIRED**; anonymity is **display-only** — the public calendar shows the flower pseudonym instead of the real name. Admin sees the full contact + flower + reference code. The standalone survey keeps its own per-survey anonymous/identified policy (§10.2). The booking intro therefore does **not** say "Không thu thập thông tin cá nhân"; it states contact details are collected only so the consultant can reach the visitor, and the public calendar shows only a flower name.
- **Photo-preset (15:14):** the public survey/booking intro and completion screens follow the *spirit* of the two reference photos (brand header band, large editorial title with accent colour, italic "Phiếu khảo sát" subtitle, coloured-dot bullet list, light dotted background, pink closed-status card, gradient pill badge on completion) using the portfolio's own brand/colours — no copied logo, name, or colours from the organisation in the photos. All of it is admin-configurable via the survey theme (preset `editorial-vn`, brand name/logo, subtitle, description, highlights bullets, completion message, badge gradient).

### A.2 Những chức năng chính

See §A.1. End-to-end flows verified by tests (not by a live browser run in this integration pass): admin creates → adds questions → previews → publishes → visitor answers → admin views/exports → closes; visitor books a slot + intake survey in one transaction → admin confirms/cancels → slot frees; double-booking the same slot concurrently is rejected (slot-claim conditional update + unique constraints).

### A.3 What Agent F (integration) did

- Admin nav: **Khảo sát** → `/admin/surveys`, **Đặt lịch** → `/admin/bookings` (`admin-shell.tsx`, incl. page titles).
- `StatusBadge` unified: added styles + VI labels for survey `closed` ("Đã đóng"); booking `pending` ("Chờ xác nhận"), `confirmed` ("Đã xác nhận"), `cancelled` ("Đã hủy"), `completed` ("Hoàn thành"); slot `booked` ("Đã đặt"), `blocked` ("Đã chặn"), `available` ("Còn trống"). Deleted B's temp `src/components/admin/survey-status-badge.tsx`; B's pages/builder now use `StatusBadge` / `QUESTION_TYPE_LABELS` from `status-badge.tsx`.
- i18n merge: `survey.*` and `booking.*` keys from `src/i18n/messages/survey.ts` and `booking.ts` merged into the main dictionaries `src/i18n/messages/vi.ts` + `en.ts` (verbatim values, no rewording); all C/E pages and components now use `getDictionary(locale).survey` / `.booking`; `interpolate()` moved to `src/lib/utils.ts`; `SurveyMessages` / `BookingMessages` types now live in `vi.ts` as `Dictionary["survey"]` / `Dictionary["booking"]`. Both separate modules **deleted**; verified zero imports remain (the only mentions are provenance comments in `vi.ts`). The API route's `flowersExhaustedMessage()` now reads `getDictionary(locale).booking.flowersExhausted`.
- Middleware: added `survey` and `booking` to `BARE_PUBLIC_SEGMENTS`, so bare `/survey…` / `/booking…` redirect to `/vi/…` instead of 404.
- Dashboard: `getDashboardData()` + admin home now show **Khảo sát** (total, published, response count) and **Đặt lịch** (total, pending) cards.
- Preview: `/preview/[type]/[id]` gained the survey branch — `TYPE_LABEL.survey` ("Khảo sát"), `editorHref.survey = /admin/surveys/[id]`, and a `SurveyBody` rendering title/subtitle/description/introduction, theme/slug/meta, sections and questions (type label, required marker, option labels) from B's `getPreviewData`. Fixed its 3 typecheck errors.
- Static-export staging (§H.3): added the two `mv` lines (survey, booking) to `.github/workflows/pages.yml` staging + restore, and updated the Vercel build command in `~/workspace/base-portfolio-review/vercel-static-plan.md` (document only — live Vercel settings untouched).
- Demo seed (`prisma/seed.ts`, §H.4): one published demo survey, one service, 14 future slots.
- Fixes applied (explicit list): see §A.4.
- This report + `docs/POST_LAUNCH_BACKLOG.md` Phase 10 follow-ups.

### A.4 Fixes applied by F (and ones found already done)

| # | Fix | Result |
|---|---|---|
| 1 | `src/app/api/bookings/route.ts` `generateReferenceCode()` — hardcoded 8 chars → `BOOKING_REFERENCE_CODE_PREFIX` (`BK-`) + `BOOKING_REFERENCE_CODE_RANDOM_LENGTH` (6) from `src/lib/booking-limits.ts` | **Already done** (by E/A2 before F started); verified in the file. The remaining `PublicSurveyQuestion` type error in that file was also already gone. |
| 2 | `src/server/queries/bookings.ts` — `SurveyQuestionType` imports | **Already done**; imports from `@/lib/survey-response-validation.ts`. No errors there. |
| 3 | `src/server/queries/survey-responses.ts:317` — `string \| undefined` pushed into `missingRequired: string[]` | **Fixed by F**: `missingRequired.push(title ?? questionId)`. |
| 4 | `src/i18n/messages/booking.ts:180` | **Resolved by the merge**: the module is deleted; its strings live in `vi.ts`/`en.ts` as `booking.*`. No error remains. |
| 5 | `editorial-vn` preset missing from `src/lib/survey-theme.ts` / `SURVEY_THEME_PRESETS` | **Already done** (by C/E): real entry with the portfolio palette (`#17233a` / `#9b1c31` / `#f8f8f6` / `#ffffff` / `#20242c`); structure differs from `editorial`, colours do not. |
| 6 | `src/app/preview/[type]/[id]/page.tsx` — 3 typecheck errors | **Fixed by F** (survey branch, §A.3). |
| — | Repo-wide typecheck | **0 errors** after the fixes (`npm run typecheck`). |

### A.5 Các giới hạn còn tồn tại

- No email infrastructure exists (audit §7): shareable links only; booking confirmation is on-screen (reference code + flower badge) and retrievable via code + email lookup. No email is sent at any step.
- Flower pool caps simultaneously active (pending + confirmed) bookings at **30**; the 31st booking is rejected with `FLOWERS_EXHAUSTED`.
- Rate limiting is in-memory per instance (audit §11.9.2); duplicate protection is DB-level (slot-claim update, partial unique index on flower, `@@unique([serviceId, startsAt])`), never the limiter.
- Survey/booking pages are dynamic-only and are **staged out of the static export** by design — they do not exist on the GitHub Pages demo. Share links must point at the full-stack (Vercel) deployment, never the Pages origin.
- `next build` (full-stack and `PAGES_EXPORT=1`) and Playwright E2E were **verified by the coordinator** after this integration pass (see the "Coordinator verification" note at the top): full-stack build exit 0, export build exit 0 with 73 HTML / 228 files, E2E 14/14, responsive overflow 8/8.
- 2 vitest failures remain (pre-existing, E/G-owned — §G.4 / §J).

---

## B. Architecture

### B.1 Database model

One additive migration set, no Prisma enums, no `Json` columns, translation tables throughout (audit §2.2 conventions):

| Model | Purpose / key fields |
|---|---|
| `Survey` | `slug @unique`, `status` (`draft \| published \| closed \| archived`), `themePreset` (`minimal \| editorial \| modern \| premium \| editorial-vn`), `layout`, `progressStyle`, `buttonStyle`, `borderRadius`, validated hex colours (`primary/accent/background/surface/text`, `badgeFrom/ToColor`), `brandName`, `brandLogoMediaId → Media`, `estimatedMinutes`, `startsAt/endsAt`, `publishedAt`, `isBookingIntake`, soft-delete `deletedAt` |
| `SurveyTranslation` | `title, subtitle, description, introduction, completionMessage, privacyNotice, highlights` (newline-separated intro bullets) per locale; `@@unique([surveyId, locale])` |
| `SurveySection` + `SurveySectionTranslation` | Ordered sections (`order`), title/description per locale |
| `SurveyQuestion` | `type` (8 types, §C), `order`, `required`, `minLength/maxLength`, `minRating/maxRating`, `sectionId?` |
| `SurveyQuestionTranslation` | title/description/placeholder per locale |
| `SurveyQuestionOption` + `SurveyQuestionOptionTranslation` | `value` (stable machine value), label per locale; `@@unique([questionId, value])` |
| `SurveyResponse` | `surveyId`, `locale`, `respondentKey` (sha256 of lowercased email when identified, else null; `@@unique([surveyId, respondentKey])` — Postgres treats NULLs as distinct, so anonymous responses are unaffected). **No name/email/phone/IP columns by design.** |
| `SurveyAnswer` | One row per answer / per selected option (`optionId?`, `value` as text — numbers stored as text); never a JSON array |
| `BookingService` | `slug @unique`, `durationMinutes` (15 \| 30 \| 60), `active`, `intakeSurveyId? → Survey`, `order` |
| `BookingServiceTranslation` | name/description per locale |
| `BookingSlot` | `serviceId`, `startsAt/endsAt` (**UTC**), `status` (`available \| booked \| blocked`); `@@unique([serviceId, startsAt])` |
| `Booking` | `referenceCode @unique` (`BK-` + 6 unambiguous chars), `serviceId`, `slotId`, `surveyResponseId? @unique`, `name`, `email`, `phone?`, `notes`, `flowerCode` (kept forever as history; uniqueness among *active* bookings enforced by a **partial unique index** in the migration, not by nulling the column), `status` (`pending \| confirmed \| completed \| cancelled`), `cancelledAt?` |

Migrations: `20261114081013_phase10_survey_booking`, `20261114081737_phase10_anon_brand`, `20261114082009_phase10_anon_revert` (see §H.1).

### B.2 API structure

All handlers use the `withApi()` envelope (`{success, data}` / `{success:false, error:{code, message}}`) and `export const dynamic = "force-dynamic"`:

| Route | Purpose |
|---|---|
| `GET /api/surveys/[slug]` | Public survey data (published + window + locale only; no admin/response data) |
| `POST /api/surveys/[slug]/responses` | Public submit: honeypot + timing check, rate limit 5/10 min/IP, zod + shared validator, one transaction; silent fake success for bots |
| `GET /api/admin/surveys/[id]/responses/export` | Admin-only CSV export (UTF-8, RFC 4180, formula-injection guard) |
| `GET /api/booking/slots?service=&locale=&from=&to=` | Public availability: safe DTO only — booked slots show **flower name only**, never PII; rate limit 120/min/IP |
| `POST /api/bookings` | Public booking create: contact (required) + intake answers validated, slot claim + flower allocation + response + booking in one transaction; `P2002` retry |
| `POST /api/bookings/cancel` | Lookup/cancel by reference code + email |
| (admin) server actions in `src/server/actions/surveys.ts`, `src/server/actions/bookings.ts` | `FormData` actions, `requireUser()` / `requireSuperAdmin()` where applicable, zod, transaction, `logActivity()`, `revalidatePath` |

### B.3 Public routes

- `/[locale]/survey/[slug]` — public survey (wizard + completion; closed → status card; draft/untranslated → 404, noindex)
- `/[locale]/booking` — service list
- `/[locale]/booking/[serviceSlug]` — 4-step booking flow (slot → contact → intake → confirm)
- `/[locale]/booking/cancel` — lookup / cancel by code + email
- Bare `/survey…` / `/booking…` redirect to `/vi/…` via middleware (`BARE_PUBLIC_SEGMENTS` += `survey`, `booking`).

### B.4 Admin routes

All under `(admin)/admin/(protected)/` (session gate): `/admin/surveys` (list, filters), `/admin/surveys/new`, `/admin/surveys/[id]` (builder), `/admin/surveys/[id]/responses`, `/admin/surveys/[id]/responses/[responseId]`; `/admin/bookings` (list, filter by date/status/service), `/admin/bookings/[id]` (contact + slot + linked survey answers, confirm/cancel/complete), `/admin/bookings/services`, `/admin/bookings/slots`. Nav items added by F (see §A.3); dashboard cards added by F.

### B.5 Validation architecture

Central limits in `src/lib/survey-limits.ts` (`MAX_SECTIONS_PER_SURVEY` 10, `MAX_QUESTIONS_PER_SURVEY` 100, `MAX_OPTIONS_PER_QUESTION` 20, short/long answers 500/5000 chars, response JSON 256 KB, rating ≤ 10, NPS 0–10) and `src/lib/booking-limits.ts` (slot durations 15/30/60, notes ≤ 1000, reference-code format, flower-allocation retries 5, submit limits 5/10 min, availability 120/min). Zod schemas in `src/lib/validation.ts`; the **same pure validator** (`src/lib/survey-response-validation.ts`) runs client-side (wizard) and server-side (submit + booking intake), so client and server agree on required/type/choice/bounds. Survey theme values are validated hex colours or enum presets — never arbitrary CSS/JS/HTML. All admin input goes through zod `safeParse`; actions build explicit objects from named `FormData` keys (no mass assignment).

---

## C. Survey Builder

- **Question types (8):** short text, long text, single choice, multiple choice, dropdown, rating scale (1–5 or 1–10), NPS (0–10), yes/no. Each has matching validation (length bounds, rating/NPS bounds, option membership, required).
- **Question management:** add / edit / delete / duplicate / reorder (up/down buttons — no drag-and-drop library; prompt allows skipping it), required flag, description/placeholder, per-type options with dedupe by stable `value`.
- **Sections:** surveys split into named sections; the wizard renders one step per section with Next/Back, answers preserved across steps, required questions validated before advancing, progress indicator (bar / dots / steps).
- **Theme customisation:** presets Minimal, Editorial, Modern, Premium, **Editorial VN** (photo-reference structure, portfolio palette); layout centered / split / editorial; progress bar/dots/steps; button solid/outline; radius sm/md/lg/full; primary/accent/background/surface/text colours; brand name + logo in the header band; italic subtitle; highlights bullets; completion message; badge gradient colours. No arbitrary CSS/JS/HTML is accepted or rendered.
- **Preview:** admin preview at `/preview/survey/[id]` (session-required) renders the survey near-identically to the public page; builder edits do not change a published survey until saved/confirmed (preview reads the saved row).

---

## D. Public Experience

- **Responsive:** mobile-first (the 15:14 reference photos are mobile); coordinator-verified 2026-11-14: **no horizontal overflow at 1920px or 390px** on all 4 new public pages (survey intro, booking list, booking service flow, booking cancel) — 8/8 checks passed against the production build. The full 6-viewport suite (1440/1366/1024/768/375) was run for the pre-existing pages in Phase 9, not re-run for the new pages; the two extremes (widest + phone) plus G's 390px mobile submit E2E cover the phone-first flows.
- **Submission workflow:** intro → steps → review (booking) → submit → backend confirms storage → completion screen only. The completion screen is never shown on an unconfirmed submit; errors are explicit (closed, duplicate, rate-limited, invalid answers).
- **Completion screen:** small-caps "ĐÃ GHI NHẬN PHIẾU" / "RECORDED" line, large thank-you title in the accent colour, admin-configured completion message, and the gradient pill badge — for a standalone survey the badge shows the survey title; for a booking it shows the visitor's **flower name** plus the **booking reference code** (`BK-XXXXXX`) to keep for lookup/cancel.
- **Closed/ended state:** pink status card ("Khảo sát đã kết thúc" / "Tạm thời không nhận đặt lịch") in the photo-reference style, instead of a bare 404.

---

## E. Response Management

- **Dashboard:** per-survey totals, completion count, submission timeline, average rating / average NPS (only when the survey uses those question types), response distribution; the admin home also shows global survey/response counts (F).
- **Individual responses:** per-response detail (submitted time, locale, per-question answers, missing-required flags, completion state); search/filter by time; no unnecessary sensitive data — `respondentKey` is a hash and is never displayed.
- **Aggregated analytics:** bar distribution for choice questions, rating/NPS breakdown, text-response listing. No chart is rendered for a question type with no suitable data.
- **CSV export:** admin-only `GET /api/admin/surveys/[id]/responses/export`; UTF-8 with Vietnamese support, clear headers, question titles, submission timestamps, response IDs, RFC 4180 escaping, and formula-injection guard (cells starting with `= + - @` are prefixed).

---

## F. Security & Privacy

- **Authentication:** admin surfaces sit behind the existing session gate (`(protected)` layout + `requireUser()`); preview requires a session; `/api/admin/*` uses `authorize()` and `requireSameOrigin()` on mutations. No separate survey auth system was created.
- **Authorization:** two roles only (`SUPER_ADMIN` / `ADMIN` — there is no `EDITOR` role); user/settings pages are `requireSuperAdmin()`. Export is admin-only.
- **Anonymous survey handling:** standalone surveys follow their per-survey policy (§10.2): anonymous by default — no name/email/IP is collected or displayed; identified surveys store only a hashed respondent key. **Booking is not anonymous** (15:17 correction): contact is required, and anonymity applies only to *public display* via the flower pseudonym. The booking intro states this explicitly; it does not claim "no personal data is collected".
- **Rate limiting:** survey submit 5/10 min/IP, booking create 5/10 min/IP, availability GET 120/min/IP (hashed IP keys, never raw IPs). In-memory per instance — DB constraints, not the limiter, enforce uniqueness.
- **Spam/duplicate protection:** honeypot + `startedAt` timing check on survey submit (bots get a silent fake success); duplicate identified responses blocked by `@@unique([surveyId, respondentKey])`; double-booking blocked by the slot-claim conditional update + `@@unique([serviceId, startsAt])` + flower partial unique index; concurrent double-book tested (exactly one succeeds).
- **Data retention:** nothing is auto-deleted. Closing/archiving a survey never deletes responses. Retention policy / export-before-delete is a post-launch decision (see backlog).
- **Other checks:** zod on all inputs; `sanitize-html` markdown rendering; no `Json` columns; no IP display/storage for survey responses; PII never leaves the server on public DTOs (availability shows flower names only — covered by `tests/flower-allocation.test.ts`); CSV formula-injection guard; origin check on public mutation handlers; no email sending (nothing to leak or spoof).

---

## G. Testing

### G.1 Counts (this integration pass)

- `npm run typecheck`: **0 errors** (was 4 before F's fixes: 3 in the preview page + 1 in `survey-responses.ts`).
- Full vitest suite (command: `TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/portfolio_test?schema=public PRISMA_ENGINES_MIRROR=http://127.0.0.1:8811 npm test`): **34 files, 314 tests — 314 passed** (coordinator re-run 2026-11-14 ~09:03, confirming Agent G's run). The 2 failures listed in §G.4 below were test-side and are **resolved** — see §G.4.
  - Baseline before Phase 10 was 214 tests (Phase 9); A2 reported 238 with the new unit tests; the Phase 10 agents (B–E, incl. Agent G's booking/flower suites) brought it to 300 at F's check, then to 314 with G's final test files.
  - New Phase 10 test files: `survey-validation`, `survey-flow`, `survey-export`, `booking-flow`, `booking-anon`, `booking-time`, `booking-limits`, `flower-allocation`, `flowers`, `asset-base-path` (+ `tests/helpers/phase10.ts`).

### G.2 What the tests cover

- **Unit:** survey/booking validation, theme resolution + `editorial-vn` preset, slug/reference-code format, flower pool, VN timezone conversion both ways (`tests/booking-time.test.ts` **11/11**), CSV escaping, rate-limit buckets, origin checks.
- **Integration (DB-backed, `portfolio_test`):** create/update/publish/close/archive survey; submit valid/invalid/duplicate responses; booking create + intake in one transaction; double-booking (sequential + concurrent); flower allocation under concurrency + exhaustion + reuse after cancel/complete; public availability contains no PII; closed intake survey blocks booking; cancel frees slot + flower.
- **Anonymity tests (`booking-anon`):** booking requires full contact; public calendar shows only the flower; admin sees full contact + flower + code; reference code unique; lookup/cancel by code works; completion shows flower badge + code.

### G.3 Coordinator verification (runs after the integration pass)

- `next build` (full-stack): **exit 0** — all Phase 10 routes present (`/admin/surveys`, `/admin/bookings`, `/api/surveys/[slug]`, `/api/bookings`, `/api/booking/slots`, …), all dynamic (`ƒ`) as designed.
- Static export (`PAGES_EXPORT=1`, exact `.github/workflows/pages.yml` recipe incl. staging + restore): **exit 0, 73 HTML files / 228 files** — exactly the live-fix baseline (LIVE_FIXES_REPORT.md: 73 HTML, 228 files); **zero** `survey/` / `booking/` / `admin/` / `preview/` / `media/` HTML in `out/` (the only 2 `*api*` matches are the `signal-api` project pages, not API routes); 17/17 key public pages present. Tree restored after the build (`git status` back to 103 entries, 0 `force-static` left).
- Playwright E2E (Chromium, production build, temp admin created/deleted): **14/14 passed** — setup login (1) + `e2e/survey.spec.ts` (8: admin create → questions → `editorial-vn` + publish → preview → public submit desktop + mobile 390px → wizard validation/back → admin responses + CSV → unauthenticated export 401 → close → UI card + API 409) + `e2e/booking.spec.ts` (5: admin service + slot → visitor books → flower-only public calendar → admin confirm → cancel by code + email frees slot). One first-run failure was a **test-selector artifact, not an app bug** (see §G.4 note 3); the booking spec re-ran 6/6 green.
- Responsive overflow (temporary spec, deleted after the run): **8/8 passed** — no horizontal overflow at 1920px or 390px on the 4 new public pages.
- Demo seed verified in the local DB after `npx tsx prisma/seed.ts`: survey published, 2 sections, 8 questions (all 8 types), service + 14 future slots (2026-11-15 → 2026-11-21, 09:00/14:00 VN).
- No live-browser (visual) verification of the new pages was done by any agent (subagents have no live browser); the parent agent should do a visual pass on the public survey + booking pages.

### G.4 The 2 failing tests — RESOLVED (test-side, fixed by Agent G, confirmed by the coordinator)

Both were test-side issues, not app bugs; the full suite is now **314/314 green** (coordinator re-run 2026-11-14 ~09:03):

1. `tests/booking-flow.test.ts` — "invalid intake answers create NO booking and NO response row (atomic)": expected `400 / INVALID_ANSWERS`, got `400 / "INVALID"` because the payload tripped the zod `bookingCreateSchema` parse branch (`src/app/api/bookings/route.ts:114`) before the shared answer validator. Fixed in the test (fixture now passes zod so the answer validator is reached).
2. `tests/flower-allocation.test.ts` — "the public availability response contains no PII, only flower names": expected `200`, got `409` because the preceding test deliberately leaves **30 active bookings** (the whole 30-flower pool) to prove exhaustion. Fixed in the test (pool reset / own cleanup).

Neither failure was caused by F's integration changes.

3. **Coordinator E2E note (test-maintenance, not an app bug):** on the coordinator's first E2E run, `e2e/booking.spec.ts` "visitor books" failed with a strict-mode violation — `getByRole('link', { name: 'Chọn dịch vụ này' })` resolved to 2 elements: the seeded demo service `/vi/booking/tu-van-1-1` and the test service `/vi/booking/tu-van-e2e-…`. The spec was written when the seed had not been run (only one service card existed). The app correctly listed both services. Re-run after temporarily removing the demo service: **6/6 passed**; the demo service + 14 slots were re-seeded afterwards. If the spec is re-run with the demo seed present, scope its service-card selector (e.g. by href) or run it against a DB without the demo service.

---

## H. Database Changes

### H.1 Migrations

All additive; no reset; old data untouched:

- `20261114081013_phase10_survey_booking` — Survey/Booking models + relations + indexes (incl. the flower partial unique index and `@@unique([serviceId, startsAt])`).
- `20261114081737_phase10_anon_brand` — brand header columns (`brandName`, `brandLogoMediaId`) and anonymity-related fields.
- `20261114082009_phase10_anon_revert` — reverts the 15:14 anonymity change per the 15:17 correction (contact required again for booking; anonymity display-only).

### H.2 Compatibility / rollback

- Additive only: new tables/columns/indexes; no existing table altered destructively, no existing column dropped or retyped. Rolling back = dropping the Phase 10 tables (which would lose survey/booking data created after the migration — export first if any real data exists).
- The seed (`prisma/seed.ts`) remains safe to run in CI / the Pages export: the demo survey/service/slots are upsert-style and the survey/booking pages are staged out of the static build.

### H.3 Static-export staging (exact updated commands)

`.github/workflows/pages.yml` — staging step (two lines added after the `[...rest]` move):

```bash
mv "src/app/(public)/[locale]/survey" /tmp/pages-staging/public-survey
mv "src/app/(public)/[locale]/booking" /tmp/pages-staging/public-booking
```

Restore step (mirrored, with the same `|| true` guards):

```bash
mv /tmp/pages-staging/public-survey "src/app/(public)/[locale]/survey" || true
mv /tmp/pages-staging/public-booking "src/app/(public)/[locale]/booking" || true
```

Vercel build command (updated in `~/workspace/base-portfolio-review/vercel-static-plan.md`; **paste into the Vercel project settings — the live project was not changed from here**):

```bash
npx prisma migrate deploy && npm run db:seed && mkdir -p /tmp/pages-staging && mv src/app/api /tmp/pages-staging/api && mv "src/app/(admin)" /tmp/pages-staging/admin && mv src/app/preview /tmp/pages-staging/preview && mv src/app/media /tmp/pages-staging/media && mv "src/app/(public)/[locale]/[...rest]" /tmp/pages-staging/rest && mv "src/app/(public)/[locale]/survey" /tmp/pages-staging/public-survey && mv "src/app/(public)/[locale]/booking" /tmp/pages-staging/public-booking && mv src/components/site/contact-section.tsx /tmp/pages-staging/contact-section.tsx && cp src/components/site/contact-section.static.tsx src/components/site/contact-section.tsx && grep -rlF 'export const dynamic = "force-dynamic";' src/app | xargs sed -i 's/export const dynamic = "force-dynamic";/export const dynamic = "force-static";/' && npm run build
```

Already covered by the existing moves (no new line needed): `src/app/api/*` (all survey/booking handlers), `src/app/(admin)` (all admin survey/booking pages), `src/app/preview` (survey preview). The sitemap must **not** gain survey/booking URLs (they are shared by direct link / transactional, and the Pages demo has no such pages). **Verification still required (coordinator):** run the export build locally with `PAGES_EXPORT=1`, then assert exit 0, zero `survey/`/`booking/` HTML in `out/`, zero `admin/`/`api/`/`preview/`/`media/`, HTML count unchanged from the live-fix baseline (73).

### H.4 Demo seed data (F)

`prisma/seed.ts` (idempotent, upsert-style; no admin user created; no existing seed data changed):

- **Survey** slug `khao-sat-trai-nghiem-tu-van` — published, themePreset `editorial-vn`, layout `editorial`, progress `steps`, brand "Portfolio Studio", ~5 minutes, `isBookingIntake: true`; VI + EN translations (title/subtitle/description/introduction/completion message/privacy notice/highlights bullets).
  - Section 1 "Về bạn và nhu cầu tư vấn" / "About you and your needs": short_text (required), long_text, single_choice (required; Sự nghiệp / Dự án / Kinh doanh / Cá nhân), dropdown (nguồn biết đến).
  - Section 2 "Đánh giá và phản hồi" / "Rating and feedback": rating 1–5 (required), NPS 0–10 (required), yes/no (required), multiple_choice (Thiết kế / Kỹ thuật / Nghệ thuật / Chiến lược sản phẩm).
  - All 8 question types present. Sections + questions are created only on first seed (re-runs keep existing questions untouched — deleting them could break stored answers, `SurveyAnswer.questionId` is `Restrict`).
- **Service** slug `tu-van-1-1` — "Tư vấn 1-1" / "1-on-1 consultation", 30 minutes, active, intake survey = the demo survey above.
- **Slots:** 14 slots — next 7 days from the seed run, 09:00 and 14:00 Vietnam time (02:00 / 07:00 UTC, 30 min each), upserted on `@@unique([serviceId, startsAt])`. For a seed run on 2026-11-14 that is **2026-11-15 → 2026-11-21, 09:00 + 14:00 VN each day** (verified: all future, all 09:00/14:00 VN).

---

## I. Git Summary

No commit / push / deploy was done (master prompt §16). Working tree is uncommitted; it also still carries the earlier Phase 9 live-fix modifications, which are **not** Phase 10 work. Phase 10 files (added or modified), by area:

- **Modified (tracked):** `.github/workflows/pages.yml`, `prisma/seed.ts`, `src/app/(admin)/admin/(protected)/page.tsx`, `src/app/preview/[type]/[id]/page.tsx`, `src/components/admin/admin-shell.tsx`, `src/components/admin/status-badge.tsx`, `src/components/site/booking-cancel-form.tsx`, `src/components/site/booking-completion.tsx`, `src/components/site/booking-flow.tsx`, `src/components/site/booking-intake-form.tsx`, `src/components/site/booking-slot-picker.tsx`, `src/components/site/survey-completion.tsx`, `src/components/site/survey-intro.tsx`, `src/components/site/survey-question-field.tsx`, `src/components/site/survey-wizard.tsx`, `src/app/(public)/[locale]/survey/[slug]/page.tsx`, `src/app/(public)/[locale]/booking/page.tsx`, `src/app/(public)/[locale]/booking/[serviceSlug]/page.tsx`, `src/app/(public)/[locale]/booking/cancel/page.tsx`, `src/app/api/bookings/route.ts`, `src/i18n/messages/vi.ts`, `src/i18n/messages/en.ts`, `src/lib/utils.ts` (`interpolate`), `src/middleware.ts`, `src/server/queries/dashboard.ts`, `src/server/queries/survey-responses.ts`, `tests/survey-validation.test.ts`, `~/workspace/base-portfolio-review/vercel-static-plan.md` (outside the repo).
- **Added (untracked):** `docs/PHASE_10_CUSTOM_SURVEY_REPORT.md` (this file); `prisma/migrations/20261114081013_phase10_survey_booking/`, `20261114081737_phase10_anon_brand/`, `20261114082009_phase10_anon_revert/`; `src/app/(admin)/admin/(protected)/surveys/`, `src/app/(admin)/admin/(protected)/bookings/`; `src/app/(public)/[locale]/survey/`, `src/app/(public)/[locale]/booking/`; `src/app/api/surveys/`, `src/app/api/bookings/`, `src/app/api/booking/`, `src/app/api/admin/surveys/`; `src/components/admin/survey-builder.tsx`, `survey-form.tsx`, `survey-question-form.tsx`; `src/components/site/booking-*.tsx`, `survey-*.tsx`, `gradient-badge.tsx`; `src/data/surveys.ts`, `src/data/bookings.ts`; `src/lib/booking-limits.ts`, `booking-time.ts`, `flowers.ts`, `survey-limits.ts`, `survey-response-validation.ts`, `survey-theme.ts`; `src/server/actions/surveys.ts`, `src/server/actions/bookings.ts`; `src/server/queries/surveys.ts`, `src/server/queries/survey-responses.ts`, `src/server/queries/bookings.ts`; `tests/survey-validation.test.ts`, `survey-flow.test.ts`, `survey-export.test.ts`, `booking-flow.test.ts`, `booking-anon.test.ts`, `booking-time.test.ts`, `booking-limits.test.ts`, `flower-allocation.test.ts`, `flowers.test.ts`, `tests/helpers/phase10.ts`.
- **Deleted (by F, as instructed):** `src/components/admin/survey-status-badge.tsx` (temp badge — unified into `status-badge.tsx`); `src/i18n/messages/survey.ts`, `src/i18n/messages/booking.ts` (merged into `vi.ts`/`en.ts` as `survey.*` / `booking.*`).

---

## J. Remaining Issues

### Critical

- None known in the implemented features.

### High

- None open. (The three High items from the integration pass are all resolved by the coordinator verification: the 2 vitest failures were test-side and are fixed — suite now 314/314; `next build` + `PAGES_EXPORT=1` export verified exit 0 with 73 HTML / 228 files; Playwright E2E 14/14 passed against the production build.)

### Medium

4. **6-viewport responsive check** (1920/1440/1366/768/390/375) for the new survey/booking pages has not been done visually; tests cover structure, not rendering. Mobile 390px matters most (booking/survey are phone-first flows).
5. **Flower pool cap (30 active bookings)** is a product constraint, not a bug — but it must be surfaced to the owner: a 31st concurrent active booking is rejected. If the customer outgrows 30 simultaneous active bookings, enlarge the pool in `src/lib/flowers.ts` (and the partial index still works).
6. **Builder-vs-live mutation** (audit §11.9.16): editing questions on a survey that already has responses changes the meaning of stored answers. The builder should warn and prefer "duplicate to a new draft" for published surveys — not implemented in Phase 10.
7. **No email**: booking/survey invitations and confirmations are link-only. Any future email provider must be an explicit owner decision (no credential, no fake send — audit §7).

### Low

8. No drag-and-drop question reorder (up/down buttons instead — allowed by the prompt).
9. Sitemap/robots deliberately exclude survey/booking URLs; revisit only with an explicit owner decision.
10. Admin `StatusBadge` labels for `blocked` ("Đã chặn") vs the slots page's local label ("Đã khoá") differ in wording: the slots page passes its own label prop, so its display is unchanged; the badge default is the one F was instructed to use. Unify the wording if the owner prefers one term.
11. **E2E test-maintenance note:** `e2e/booking.spec.ts` assumes it is the only service on `/vi/booking` (see §G.4 note 3). Scope its service-card selector by href, or run it against a DB without the demo seed.
12. **Anti-bot fake-success UX (conscious decision needed, not a bug):** the survey submit route returns a silent fake 200 and stores nothing when a submit lands < 1800 ms after the wizard mounted (`MIN_HUMAN_SUBMIT_MS`, `src/app/api/surveys/[slug]/responses/route.ts:77`). A legitimate very fast submitter would see "success" with no record. Keep as-is or show a retry hint — owner decision.
13. **Weak slug validation:** `slugField` in `src/lib/validation.ts` is only trim/max(90)/optional — no format regex, no minimum length. It is shared across project/article/artwork/survey schemas, so tightening it is a cross-cutting change; left as a follow-up, not changed in Phase 10.
14. **`generateReferenceCode` is module-private** (`src/app/api/bookings/route.ts`); its format is only verifiable via the `BK-` constants + live responses. Export it (or move it to `src/lib/booking-limits.ts`) if a unit test should cover it directly.
15. **Route-handler testability:** handlers call `headers()` for the rate-limit IP, so invoking them directly in vitest returns 500 outside a request scope (G's HTTP tests mock `next/headers`). Consider injecting the IP / a test seam in a later cleanup pass.

---

## K. Phase 11 readiness — import touchpoints (documentation only)

Phase 11 — Website Schedule JSON Importer — is queued to run **after** Phase 10. Its full prompt is at `~/workspace/base-portfolio-review/phase-11-master-prompt.md`. Phase 11 will import schedules from JSON into the booking calendar built in Phase 10. **NO import code was added in Phase 10 — this section is documentation only, so Phase 11 starts clean.** The touchpoints Phase 11 must respect:

1. **Timezone — reuse, don't reinvent.** Slots store UTC; VN wall-clock conversion already exists in `src/lib/booking-time.ts`: `VN_TIME_ZONE = "Asia/Ho_Chi_Minh"`, `vnLocalToUtc("YYYY-MM-DD", "HH:MM")` → UTC `Date`, `utcToVnLocalParts()` for the reverse (unit-tested, `tests/booking-time.test.ts` 11/11). Phase 11's date + start/end `HH:mm` maps directly onto `vnLocalToUtc` — Phase 11 should reuse it, not write a new converter. Same default zone Phase 11 §4 requires.
2. **Stable IDs — a gap Phase 11 must fill.** Booking and BookingSlot ids are internal `cuid()` only. There is **NO** external/stable import-ID column and **NO** source/connection field anywhere in the schema. Phase 11 will need to add one (e.g. `externalId` + `source`, unique scoped per source) via a small additive migration; Phase 10 does not block this (no global unique on title/date).
3. **Statuses — map, don't invent.** `BookingSlot.status`: `available | booked | blocked` (default `available`). `Booking.status`: `pending | confirmed | completed | cancelled` (default `pending`). Phase 11 statuses (`scheduled | confirmed | completed | cancelled`) map as: `scheduled` ≈ slot `available` (no booking yet) or a booking still `pending`; `confirmed`/`completed`/`cancelled` map 1:1 onto `Booking.status`. Slot status is maintained by the booking lifecycle — an importer must not set it independently of bookings.
4. **Service binding — a decision Phase 11 must make.** Every slot requires `serviceId`, with `@@unique([serviceId, startsAt])`. Imported Excel schedules carry no service, so Phase 11 must decide: attach imports to a designated service, or add a generic calendar-event model. Phase 10 deliberately does not invent a fake service now.
5. **Field ownership — never overwrite server/visitor-owned fields.** `flowerCode` and `referenceCode` (`BK-` + 6 chars, unique) are server-generated; contact fields and `surveyResponseId` are visitor/admin-owned. An import update must never overwrite `flowerCode`, `referenceCode`, contact, or `surveyResponseId`. Cancelled = mark `cancelled` (+ `cancelledAt`), never delete; records missing from a payload are left alone.
6. **Calendar to extend.** The calendar Phase 11 must extend (not compete with) is the Phase 10 public booking calendar (`/booking` + `/api/booking/slots`) and the admin bookings list.

---

## L. Post-verification fix by the parent (2026-11-14, after the coordinator's report)

The coordinator's verification was code/test-based; the parent then did the
live visual pass the coordinator flagged as missing (dev server + headless
screenshots at 1920px and 390px of `/vi/survey/khao-sat-trai-nghiem-tu-van`
and `/vi/booking/tu-van-1-1`) and found one visible defect the tests could
not see:

**Duplicated intro bullets + duplicated privacy paragraph.** The intro
rendered the auto-generated facts (question count + time, anonymity,
go-back note) and then appended the admin's `highlights` lines — and the
demo seed's highlights restated the same three facts, so the page showed
"8 câu hỏi, khoảng 5 phút" twice, "Có thể quay lại sửa câu trả lời" twice,
and two near-identical "Khảo sát ẩn danh…" privacy paragraphs. On the
booking page the seed highlight "Không thu thập thông tin cá nhân ngoài câu
trả lời" was also policy-wrong: booking DOES collect contact info (15:17
correction), so that line must not appear there.

Fix (uncommitted, local only):
- `src/lib/utils.ts`: new `dedupeBullets()` — drops a later bullet that is
  equal to, contains, is contained by, or shares ≥ 80% of its words with an
  earlier bullet (word overlap only for lines of ≥ 4 words).
- `src/components/site/survey-intro.tsx`: bullets go through
  `dedupeBullets()`; the privacy block now shows the survey's own
  `privacyNotice` OR the generic `anonymousNote`, never both.
- `src/app/(public)/[locale]/booking/[serviceSlug]/page.tsx`: same dedupe
  for the booking intro bullets.
- `prisma/seed.ts`: demo survey highlights replaced (vi/en) with one
  distinct line that adds new information ("Câu trả lời giúp tư vấn viên
  chuẩn bị trước buổi hẹn" / "Your answers help the consultant prepare
  before the session") instead of restating the auto facts.
- `tests/survey-bullets.test.ts`: 4 new unit tests for the dedupe.

Re-verification by the parent: `npm run typecheck` 0 errors; full vitest
**35 files, 318 tests — 318 passed** (was 34/314); seed re-run on the local
DB; fresh screenshots at 1920px and 390px confirm both pages now show clean,
non-duplicated bullet lists (survey: 4 bullets; booking: 6 bullets) and a
single privacy paragraph, with the slot picker still rendering 09:00/14:00
"Còn trống" slots. No other file was touched by this fix.

*End of report — Phase 10, 2026-11-14. Feature freeze is restored after Phase 10 (master prompt §15); further ideas go to `docs/POST_LAUNCH_BACKLOG.md`.*
