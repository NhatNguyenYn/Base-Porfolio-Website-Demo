# Backend & CMS — Phase 2

Personal portfolio + digital art gallery + publishing platform. PostgreSQL, Prisma,
Next.js server actions for the CMS, and a versioned JSON API for everything public.

## 1. Stack

| Layer | Choice |
|---|---|
| Database | PostgreSQL 18 (local cluster in `node_modules`, managed instance in production) |
| ORM | Prisma 6 (migrations in `prisma/migrations`) |
| API | Next.js route handlers under `/api/*`, unified envelope |
| CMS writes | Server actions (authenticated, origin-checked by Next) |
| Auth | Database sessions, opaque token in an httpOnly cookie, bcrypt passwords |
| Uploads | Storage adapter: local disk (dev) / S3-compatible (prod), `sharp` validation |
| Tests | Vitest against a dedicated `portfolio_test` database |

## 2. Data model (ERD, text)

```
User 1─n Session
User 1─n Article            User 1─n ActivityLog
Profile 1─n ProfileTranslation
Profile n─1 Media (avatar)
Education 1─n EducationTranslation
Experience 1─n ExperienceTranslation
Skill, SocialLink                       (standalone, ordered, visible flags)

Project n─1 Media (thumbnail)           Project 1─n ProjectTranslation
Project 1─n ProjectTechnology           Project 1─n ProjectImage n─1 Media

ArtworkCollection n─1 Media (cover)     ArtworkCollection 1─n CollectionTranslation
Artwork n─1 Media (image)  n─1 Media (thumbnail)
Artwork n─1 ArtworkCollection  n─1 Category
Artwork 1─n ArtworkTranslation          Artwork n─n Tag (ArtworkTag)

Article n─1 Media (cover)  n─1 Category  n─1 User (author)
Article 1─n ArticleTranslation          Article n─n Tag (ArticleTag)
Category 1─n CategoryTranslation        Tag (single name, translatable later)

ContactMessage, SiteSetting (key/value by group), Media
```

Every translatable entity uses a `(entityId, locale)` unique pair, so adding a
third language never changes the schema. A locale without a translation is never
replaced by another language: public queries return `not_translated` and the UI
shows an explicit notice.

## 3. Requirements mapping

| Frontend module | Data source | Backend |
|---|---|---|
| Profile / About | `src/data/profile.ts` → `server/queries/profile.ts` | PostgreSQL + admin profile editor |
| Projects | `src/data/projects.ts` → `server/queries/projects.ts` | `Project` + translations, admin CRUD |
| Digital art | `src/data/artworks.ts` → `server/queries/artworks.ts` | `Artwork`, collections, media library |
| Blog | `src/data/articles.ts` → `server/queries/articles.ts` | `Article` states, translations, taxonomy |
| Navigation | `src/data/navigation.ts` | Route config (not CMS content) |
| Social links | `src/data/social.ts` → `SocialLink` | Profile editor |
| Settings | `src/data/settings.ts` → `SiteSetting` | `/admin/settings` (SUPER_ADMIN) |
| Contact | server action | `ContactMessage` inbox + rate limiting |

No UI component reads Prisma directly; the `src/data/*` seam re-exports query
functions, which is also the place to swap in an HTTP client if the frontend is
split from the CMS later.

## 4. Local run

```bash
npm install
npm run db:start        # PostgreSQL 18 on 127.0.0.1:5433, UTF-8, data in .pgdata
npm run db:deploy       # apply migrations
npm run db:seed         # demo content + initial admin (from .env)
npm run dev             # http://localhost:3000  (CMS at /admin)
```

`db:start` must stay running in its own terminal (Ctrl+C stops the cluster).
Production uses a managed PostgreSQL: change `DATABASE_URL`, run `npm run db:deploy`,
never `db:seed`.

## 5. Super admin bootstrap

Nothing is hardcoded. Either:

1. `npm run db:seed` uses `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`,
   `SEED_ADMIN_NAME` from `.env` **once** (it is skipped if the email exists).
2. Or open `/admin/setup` while no user exists. It only works from localhost
   unless `SETUP_TOKEN` is set, and the first account is always `SUPER_ADMIN`.

Delete `SEED_ADMIN_PASSWORD`/`SETUP_TOKEN` from `.env` afterwards. Passwords are
bcrypt (cost 12); changing a password revokes every other session.

## 6. Roles

| Capability | SUPER_ADMIN | ADMIN |
|---|---|---|
| Projects, articles, artworks, collections, taxonomy, media | ✅ | ✅ |
| Contact inbox | ✅ | ✅ |
| Website settings | ✅ | ❌ |
| User management (`/admin/users`) | ✅ | ❌ |

Enforced in server actions (`requireSuperAdmin`), in admin pages, and in
`/api/admin/*` (`authorize()`); the hidden nav link is cosmetic only. The last
active SUPER_ADMIN cannot be demoted or deactivated.

## 7. API

Envelope: `{ success: true, data, meta }` / `{ success: false, error: { code, message, details? } }`.
Public responses are cacheable for 60s; admin responses are `no-store`.

### Public (no auth, published content only)

| Endpoint | Notes |
|---|---|
| `GET /api/profile?locale=vi` | profile, translated content, skills, socials |
| `GET /api/projects?locale&page&perPage&q&tech&category&sort` | cards + technologies/categories meta |
| `GET /api/projects/[slug]?locale` | 404 for private or untranslated |
| `GET /api/artworks?locale&page&perPage&collection&category&featured` | paginated cards |
| `GET /api/artworks/[slug]?locale` | 404 for private or untranslated |
| `GET /api/collections?locale` | public collections with counts |
| `GET /api/articles?locale&page&perPage&q&category&tag` | drafts/archived/future excluded |
| `GET /api/articles/[slug]?locale` | 404 rather than 403 for non-published |
| `GET /api/categories?locale&kind=article\|artwork` | translated names |
| `GET /api/tags` | usage counts |
| `GET /api/settings` | public subset (no media ids) |

### Admin (session required)

| Endpoint | Roles | Notes |
|---|---|---|
| `GET /api/admin/me` | any admin | current session |
| `GET /api/admin/stats` | any admin | live dashboard counts + activity |
| `GET /api/admin/messages?status&q` | any admin | inbox |
| `GET /api/admin/messages/[id]` | any admin | detail |
| `PATCH /api/admin/messages/[id]` | any admin | `{ status }`, audited |
| `DELETE /api/admin/messages/[id]` | any admin | soft delete |
| `GET /api/admin/media?page&perPage` | any admin | paginated library |
| `POST /api/admin/media` | any admin | multipart `files`, validates type/size/reference |

## 8. Uploads

- Declared MIME **and** decoded format must match (JPEG, PNG, WebP, AVIF, GIF).
  SVG is rejected because it can execute script when served inline.
- Max size `MAX_UPLOAD_MB` (default 10 MB), max 10 files per request.
- Storage key is a random UUID under `uploads/YYYY/MM/`; client filenames are
  metadata only.
- Originals are never overwritten. `sharp` records width/height for layout shift
  control; Next Image serves resized variants at request time.
- Deleting media is refused while it is referenced (avatar, project, artwork,
  cover); the check counts relations server-side.

## 9. Testing

```bash
npm run db:create-test                     # once
npx prisma migrate deploy                  # with DATABASE_URL=portfolio_test
npm test
```

46 tests cover public visibility (draft/private/scheduled/untranslated),
API envelope and 404s, validation, password hashing, rate limiting, slugs,
redirect safety and the storage driver. Tests run against PostgreSQL, never the
dev database.

## 10. Backup & restore

```bash
# Backup (custom format, compressed)
pg_dump "postgresql://postgres:postgres@localhost:5433/portfolio" -Fc -f backup-$(date +%F).dump

# Restore into an empty database
pg_restore -d "postgresql://USER:PASS@HOST:5432/portfolio" --clean --if-exists backup-2026-11-12.dump
```

Uploaded files live outside the database (`UPLOAD_DIR` locally, the bucket in
production) and need their own backup/sync. Take a `pg_dump` before every
`prisma migrate deploy` in production; Prisma migrations are forward-only, so a
rollback is a restore.

## 11. Deployment security

### Reverse proxy trust

The rate limiter never trusts the left-hand side of `X-Forwarded-For`, because
a client can send anything there. Set `TRUSTED_PROXY_HOPS` to the number of
proxies you actually operate:

| Topology | Value | Effect |
|---|---|---|
| App listens on a public port, no proxy | `0` | Forwarding headers ignored; all traffic shares one bucket |
| One proxy (nginx, Caddy, Vercel, single LB) | `1` | Uses the right-most address the proxy appended |
| Two chained proxies (CDN + nginx) | `2` | Uses the second address from the right |

Never set it higher than the number of proxies you control, and make sure every
proxy **overwrites/appends** `X-Forwarded-For` instead of passing a client value
through unchanged. `X-Real-IP` is only read while at least one hop is trusted.

### First-run setup

`/admin/setup` is development-only unless `SETUP_TOKEN` is set. In production
the page and action refuse to run without it, even from localhost: the `Host`
header is client controlled and cannot be used as a trust signal. Generate a
long random token, keep it in the environment, create the account, then remove
the variable.

### CSP and headers

The app sends `Content-Security-Policy-Report-Only` with a per-request nonce
from middleware; the inline theme bootstrap and JSON-LD blocks carry the same
nonce. Violations appear in the browser console without breaking the page.
Enforcement is a separate, evidence-based step — see the Phase 2 security
report. `next.config.ts` still sends `X-Frame-Options`, `nosniff`,
`Referrer-Policy`, `Permissions-Policy`, and HSTS in production. HSTS is only
correct when the site is reachable over HTTPS.

### API failures

Public and admin API routes share `withApi()`: an unreachable database returns
`503 { success: false, error: { code: "SERVICE_UNAVAILABLE" } }` and unexpected
errors return a generic `500 INTERNAL_ERROR`. Neither response includes stack
traces, SQL, connection strings or file paths. Public pages keep rendering the
"temporarily unavailable" shell with HTTP 200, because a Next.js layout cannot
set a 503 status for a page that streams.

## 12. Not done yet

- Media library has no automatic variant generation or orphan cleanup job.
- Rich text is a Markdown editor with toolbar + preview (no WYSIWYG/Tiptap).
- Rate limiting is per-process and resets on restart; use Redis for multi-instance deployments.
- CSP is Report-Only until violations are collected from the production domain.
- Contact submissions are stored, not emailed.
- S3 driver is implemented but unverified (no bucket credentials).
