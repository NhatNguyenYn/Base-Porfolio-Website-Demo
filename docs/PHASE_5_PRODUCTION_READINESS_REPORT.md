# Phase 5 — Production Readiness Report

Ngày: 2026-11-13
Phạm vi: remediation các blocker của Phase 4 và kiểm chứng production readiness.
Trạng thái cuối: **BLOCKED — WAITING FOR OWNER DECISIONS**

> Không commit, không push, không deploy, không thay đổi dữ liệu production.
> Mọi thao tác dưới đây chạy trên máy phát triển; database kiểm thử được tạo và
> xoá trong cùng phiên.

## A. Executive Summary

Phase 5 đã xử lý các vấn đề **có thể giải quyết bằng code và kiểm chứng độc lập**:

| Việc đã làm | Kết quả |
|---|---|
| Xác minh repository có thể tái lập | Bản working tree (release candidate) cài lại từ lockfile, typecheck/lint/test/build đều đạt; commit HEAD hiện tại **không build được** vì thiếu source storage |
| Sửa readiness báo sai cho S3 | `healthCheck()` theo từng driver; S3 dùng `HeadBucket` thay vì "giả định available" |
| Chặn ảnh giải nén quá lớn | `sharp(..., { limitInputPixels })` cho metadata/upload |
| Thêm preflight môi trường production | `scripts/preflight.mjs` + 7 test; không in giá trị secret |
| Kiểm chứng migration trên DB trống | 2 migration áp dụng sạch: 30 bảng, 78 index, 0 migration lỗi |
| Kiểm chứng backup/restore | Script từ chối chạy khi thiếu công cụ/không xác nhận; **restore thực tế vẫn bị chặn** |
| Rà soát Git/untracked | 51 file sửa, 1 xoá staged (`.next-server.log`), untracked chỉ còn source/docs/script/test + artifact đã ignore |
| Tài liệu kiến trúc triển khai | `docs/DEPLOYMENT_ARCHITECTURE.md` (3 phương án, request flow, firewall, rollback) |

**Blocker còn lại:** chưa có database/hosting/domain/media target, chưa diễn tập
restore thật (máy này thiếu `pg_dump`/`pg_restore`), chưa được duyệt rotation mật
khẩu seed, CSP vẫn Report-Only do chưa có dữ liệu violation từ production.

## B. Repository Integrity

### B.1 Trạng thái Git (đầu Phase 5)

| Mục | Giá trị |
|---|---|
| Branch / commit | `main` @ `30c20fd` |
| Modified (unstaged) | 51 file |
| Staged | 1 deletion: `.next-server.log` |
| Untracked | 27 file source/docs/script/test (+ artifact local, nay đã ignore) |

`.next-server.log` là log runtime bị commit nhầm trong `30c20fd` (xác nhận bằng
`git log -- .next-server.log`). Staged deletion là đúng; không khôi phục.

### B.2 Bốn file storage

| Câu hỏi | Kết quả |
|---|---|
| Tồn tại? | Có: `src/server/storage/{index,local,s3,types}.ts` |
| Bị ignore? | Không còn (`.gitignore`: `storage/` → `/storage/`) |
| Git nhận diện? | Chưa — vẫn untracked, **phải commit** |
| Có dependency dùng? | Có: `src/server/media/upload.ts`, `src/server/actions/media.ts`, `src/app/media/[...key]/route.ts`, `src/app/api/ready/route.ts`, test |
| Chứa dữ liệu nhạy cảm? | Không; chỉ đọc `S3_*`/`UPLOAD_DIR` từ env, không hardcode credential |

**Bằng chứng mức độ Critical:** fresh clone từ `git archive HEAD` có **0** file
`server/storage`, typecheck báo 4 lỗi `TS2307 Cannot find module '@/server/storage'`
và `next build` dừng với `Module not found: Can't resolve '../storage'`.

### B.3 Fresh-clone validation

| Kiểm tra | HEAD (đã commit) | Release candidate (working tree) |
|---|---|---|
| Số file | 227 | 227 |
| `npm ci` | 442 packages | 442 packages (42 s) |
| `prisma generate` | OK | OK |
| `tsc --noEmit` | **FAIL** (4× TS2307) | **PASS** (0) |
| `eslint src tests` | — | **PASS** (0) |
| `vitest run` | — | **PASS** 107/107 (14 file) |
| `next build` | **FAIL** (thiếu `../storage`) | **PASS** |
| `.env` được copy? | Không | Không (build không cần env) |

Kết luận: release candidate tái lập được từ file trong repo; commit HEAD thì
không. Đây là lý do bắt buộc phải commit 4 file storage (và các file mới) trước
release.

### B.4 Phân loại untracked

| Nhóm | File | Xử lý |
|---|---|---|
| Source bắt buộc | `src/lib/{csp,json-ld,logger,origin,setup-guard}.ts`, `src/lib/services/site-context.ts`, `src/server/storage/*`, `src/app/api/{health,ready}/route.ts`, `src/components/site/service-unavailable.tsx` | Đưa vào release commit |
| Test | `tests/{logger,preflight,security-*}.test.ts`, `tests/site-context.test.ts` | Đưa vào release commit |
| Tài liệu | `docs/{PRODUCTION_DEPLOYMENT,PRODUCTION_CHECKLIST,POST_DEPLOYMENT_REPORT,DEPLOYMENT_ARCHITECTURE,PHASE_5_PRODUCTION_READINESS_REPORT}.md` | Đưa vào release commit |
| Vận hành | `scripts/{backup-db,restore-db}.sh`, `scripts/preflight.mjs` | Đưa vào release commit |
| Runtime artifact | `.next/`, `.next-server.log`, `tsconfig.tsbuildinfo`, `.artifacts/` | Không commit (đã ignore) |
| Dữ liệu local | `.env`, `.pgdata/`, `storage/uploads/`, `prisma/*.db`, `backups/` | Không commit (đã ignore) |
| Ảnh chụp cũ | `.artifacts/*.png` đã bị commit trong `30c20fd` | Giữ nguyên; chỉ xoá khỏi Git khi chủ dự án đồng ý |

Thay đổi Phase 5: thêm `/.artifacts/` vào `.gitignore` để các artifact kiểm chứng
mới không lọt vào repo.

### B.5 Nhất quán cấu hình

- `package.json` ↔ `package-lock.json`: `npm ci` thành công, không lệch lockfile.
- Prisma schema ↔ migrations: `prisma migrate status` = up to date; DB trống áp
  dụng đủ 2 migration.
- `.env.example` khớp biến code đọc (`DATABASE_URL`, `APP_URL`, `AUTH_SECRET`,
  `TRUSTED_PROXY_HOPS`, `STORAGE_DRIVER`, `UPLOAD_DIR`, `S3_*`, `MAX_UPLOAD_MB`).
- Build không phụ thuộc DB: `next build` chạy thành công khi không có
  `DATABASE_URL`.
- `npm run build` có sẵn `prisma migrate deploy`; production nên tách migrate
  thành bước riêng sau backup (đã ghi trong tài liệu deploy).

## C. Database Readiness

### C.1 Hiện trạng

| Mục | Giá trị |
|---|---|
| Engine dev | PostgreSQL 18.6 embedded, `127.0.0.1:5433` |
| Schema | 30 bảng, 78 index/unique, 0 enum |
| Migration | 2 (`init_postgres`, `role_admin`), forward-only |
| Trạng thái dev | up to date, không drift |

### C.2 Kiểm chứng DB trống

Tạo database tạm `portfolio_phase5_verify`, chạy `prisma migrate deploy`, đối
chiếu rồi xoá:

```text
All migrations have been successfully applied.
{"tables":30,"indexes":78,"migrations":2,"failedMigrations":0,"enums":0}
Database schema is up to date!
```

Kết quả: migration baseline tái lập được trên instance trống, không cần seed.
Test suite dùng `portfolio_test` riêng, không chạm DB dev.

### C.3 Yêu cầu production

- Role riêng (`portfolio_app`), không dùng superuser; `CREATE` trên schema public.
- `sslmode=require` khi DB ở máy khác; `connection_limit` 5–10 cho 1 instance.
- `prisma migrate deploy` chỉ sau khi backup; không chạy `migrate reset`.
- Seed chỉ chạy một lần và **không ghi đè** mật khẩu đã tồn tại.

### C.4 Backup / restore

| Hạng mục | Trạng thái |
|---|---|
| Script backup (custom format + SHA-256 + retention) | Có, chưa chạy được trên máy này |
| Script restore (bắt buộc `CONFIRM_RESTORE=yes`, verify checksum) | Có; guard hoạt động |
| `pg_dump` / `pg_restore` | **Không có trong PATH/máy dev** → backup dừng với `pg_dump not found in PATH` (exit 1) |
| Restore drill | **BLOCKED** — cần PostgreSQL client tools + DB đích |
| RPO/RTO đề xuất | 24 h / ≤ 2 h |

Đã kiểm chứng: restore từ chối chạy khi thiếu xác nhận (exit 1). Chưa có bằng
chứng phục hồi dữ liệu thật, nên **không được coi backup là đã kiểm chứng**.

Phương án DB production: xem `docs/DEPLOYMENT_ARCHITECTURE.md` (VPS + PostgreSQL
managed được đề xuất; chờ chủ dự án chọn).

## D. Media Storage Readiness

### D.1 Pipeline hiện tại

```
multipart (≤10 file) → authorize + same-origin + rate limit 60/h
→ MIME allowlist → sharp decode (format khớp, ≤100 MP) → size ≤ MAX_UPLOAD_MB
→ key UUID uploads/YYYY/MM/… → storage driver → Media row (key, url, w/h)
```

- SVG bị chặn; client filename chỉ là metadata; key không đoán được.
- `assertSafeKey` chặn `..`, null byte, ký tự lạ; local driver kiểm tra path nằm
  trong root.
- Xoá media bị từ chối khi còn được tham chiếu.
- Serve local qua `/media/*` với cache immutable + `nosniff`.

### D.2 Driver và persistence

| Driver | Trạng thái | Persistent? |
|---|---|---|
| `local` | Chạy, có test put/get/delete/URL/traversal | Chỉ khi `UPLOAD_DIR` nằm trên volume persistent |
| `s3` | Code đầy đủ (Put/Get/Delete/HeadBucket), **chưa test với bucket thật** | Có, nếu bucket tồn tại |

Mặc định hiện tại `UPLOAD_DIR=./storage/uploads` (trong thư mục repo) → **không
an toàn cho production**; preflight từ chối đường dẫn tương đối.

Readiness mới: local kiểm tra thư mục ghi được; S3 gọi `HeadBucket` → cần quyền
`s3:ListBucket`, nếu không `/api/ready` trả 503 dù upload có thể chạy. Đây là
hành vi có chủ đích (không báo healthy giả).

### D.3 Backup media

Media **không** nằm trong dump DB. Cần một trong hai:

- Volume: `rsync -a --delete` hằng ngày sang máy/ổ khác + snapshot định kỳ.
- S3: bật versioning + lifecycle, hoặc sync sang bucket thứ hai.

Chưa có job backup media và chưa có job dọn file orphan (media row bị xoá nhưng
file còn). Rủi ro: dung lượng tăng dần.

## E. Deployment Infrastructure

Chi tiết trong `docs/DEPLOYMENT_ARCHITECTURE.md`. Tóm tắt:

| Hạng mục | Trạng thái |
|---|---|
| Domain/DNS | Chưa có |
| HTTPS/TLS | Chưa có; app đã gửi HSTS khi `NODE_ENV=production` |
| Reverse proxy | Mẫu nginx có trong `PRODUCTION_DEPLOYMENT.md` |
| `TRUSTED_PROXY_HOPS` | Chưa xác định topology → chưa đặt giá trị |
| Runtime | Node 20+ / `next start`, systemd mẫu |
| PostgreSQL | Chưa provision |
| Media | Chưa chọn volume/S3 |
| Health checks | `/api/health` (liveness), `/api/ready` (readiness) |
| Supervision/restart | systemd `Restart=always` mẫu |
| Firewall | Khuyến nghị chỉ 22/80/443; 3000 và 5432 loopback |
| Deployment descriptor | Không có Dockerfile/CI/manifest (chờ chọn target) |

Ba phương án (A: VPS tự quản lý; B: VPS + managed PostgreSQL + S3; C: PaaS
container) đã so sánh chi phí/độ phức tạp/rủi ro. **Chưa chọn target.**

## F. Security

### F.1 CSP

| Mục | Kết quả |
|---|---|
| Header | `Content-Security-Policy-Report-Only`, nonce mỗi request |
| `script-src` | `'self' 'nonce-…' 'strict-dynamic'` (dev thêm `'unsafe-eval'`) |
| Nonce trong HTML | Có; test + runtime header xác nhận |
| `unsafe-inline` cho script | Không |
| Dữ liệu violation production | **Chưa có** |
| Quyết định | Giữ Report-Only; chưa đủ bằng chứng để enforce |

### F.2 Authentication và seed account

- Session opaque token hash trong DB, cookie httpOnly/Secure (production)/
  SameSite; logout revoke; đổi mật khẩu thu hồi session khác.
- bcrypt cost 12; không log credential.
- Seed admin vẫn dùng mật khẩu mặc định từ `.env` (theo Phase 4). **Chưa xoay**
  vì cần chủ dự án phê duyệt. Preflight cảnh báo nếu mật khẩu là giá trị mặc
  định của repo.
- Quy trình rotation (khi được duyệt): đổi mật khẩu trong `/admin` (tự thu hồi
  session khác), xác nhận đăng nhập lại, sau đó xoá `SEED_ADMIN_PASSWORD` khỏi
  env. Rollback: đặt lại mật khẩu cũ trong DB từ bản backup trước đó — chỉ thực
  hiện khi có backup hợp lệ. Không chạy seed lại để "đổi" mật khẩu (seed không
  ghi đè user đã tồn tại).

### F.3 Rate limiting

| Câu hỏi | Trả lời |
|---|---|
| Mất trạng thái sau restart? | Có (in-memory) |
| Bypass khi nhiều instance? | Có — mỗi process đếm riêng |
| Giới hạn RAM? | Map tối đa ~5000 key, dọn bucket hết hạn khi vượt |
| Trusted proxy đúng? | Có; chỉ đọc phần proxy append, `hops=0` bỏ qua header |

Chiến lược: chấp nhận in-memory cho **một instance** (đúng mô hình đề xuất).
Nếu scale ngang, thay backend bằng Redis/Upstash giữ nguyên interface
`rateLimit()`; chưa thêm dịch vụ khi chưa có nhu cầu và phê duyệt.

### F.4 Logging / alerting

- JSON một dòng: `ts`, `level`, `event`, `requestId`, `route`, `status`,
  `durationMs`; lỗi chỉ ghi `error.name` + `code`, không stack/DSN/body.
- Redact theo tên key: password/secret/token/cookie/authorization/api-key/session.
- `x-request-id` sinh trong middleware, trả về client.
- Chưa có log rotation trong repo (dùng journald/logrotate trên server) và chưa
  có alerting; đây là cấu hình hạ tầng, không phải code.

## G. Reliability

| Kiểm tra | Kết quả |
|---|---|
| `/api/health` | 200 `{status:"ok", uptimeSeconds, timestamp}`, không chạm DB |
| `/api/ready` | 200 `{database:"ok",storage:"ok"}` |
| `/vi` | 200 |
| `/api/articles?locale=vi` | 200 |
| HSTS | `max-age=63072000` (không includeSubDomains) |
| CSP | Report-Only + nonce |
| Request ID | Có trong response |
| DB down | Phase 4: ready 503, API 503, trang public 200 outage shell |
| Storage down | Local: ready 503; S3: HeadBucket fail → ready 503 |
| Graceful shutdown | systemd `SIGINT`, `TimeoutStopSec=30` (mẫu) |

Rủi ro tài nguyên:

- Log tăng vô hạn nếu không rotate → cấu hình journald `SystemMaxUse` hoặc
  logrotate.
- Media orphan tích luỹ → chưa có job dọn.
- Rate-limit map có trần mềm; dưới tải rất lớn vẫn có thể phình tạm thời.
- Một instance: không có HA; chấp nhận cho portfolio, cần backup để bù.

## H. Test Results (chạy thật)

| Lệnh | Kết quả |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx eslint src tests scripts/preflight.mjs --max-warnings=0` | exit 0 |
| `npx vitest run` | **107/107 pass, 14 file**, 7.2 s |
| `npx next build` | exit 0; First Load JS 103 kB; middleware 34.4 kB. Lần chạy đầu trong batch kiểm tra song song bị OOM native của Node (`HashMap::Initialize`); chạy lại riêng với `NODE_OPTIONS=--max-old-space-size=3072` pass — không phải lỗi code |
| `npx prisma migrate status` | Database schema is up to date |
| Migration trên DB trống | 30 bảng / 78 index / 2 migration / 0 lỗi |
| Runtime smoke (`next start` port 3100) | health 200, ready 200, `/vi` 200, API 200 |
| Fresh clone RC | npm ci + tsc + eslint + 107 test + build đều pass |
| Fresh clone HEAD | tsc fail 4 lỗi, build fail (`../storage`) |
| Backup script | exit 1 `pg_dump not found in PATH` (đúng guard) |
| Restore script | exit 1 từ chối khi thiếu `CONFIRM_RESTORE` (đúng guard) |
| Preflight | 7 test: pass env hợp lệ, bắt http URL, thiếu S3, UPLOAD_DIR tương đối; cảnh báo seed mặc định; không lộ secret |
| `npm audit --omit=dev` | 5 advisory (4 high, 1 moderate) trong chuỗi Prisma/PostCSS; chưa xử lý vì cần nâng major |

**Không chạy được:** S3 thật (không có bucket), restore dữ liệu thật (thiếu
`pg_restore` + DB đích), kiểm thử đa instance, browser/responsive (UI không đổi
trong Phase 5), load test lặp lại (Phase 4 đã có 30 request đồng thời).

## I. Remaining Blockers

| # | Mức | Blocker | Nguyên nhân | Hành động | Cần chủ dự án? |
|---|---|---|---|---|---|
| 1 | High | Production database | Chưa provision instance/role | Chọn provider, tạo DB + role, chạy `migrate deploy` | **Có** |
| 2 | High | Restore drill | Máy dev không có `pg_dump`/`pg_restore`; chưa có DB đích | Cài `postgresql-client`, backup, restore vào DB tạm, đối chiếu | Không (kỹ thuật), cần hạ tầng |
| 3 | High | Media persistence | Chưa chọn volume/S3 | Chọn driver, cấu hình bucket/volume, test upload + restart | **Có** |
| 4 | High | Deployment target + domain/HTTPS | Chưa có server/domain/proxy | Chọn A/B/C, trỏ DNS, cấp TLS, đặt `TRUSTED_PROXY_HOPS` | **Có** |
| 5 | High | Seed password rotation | Chưa được phê duyệt | Xoay qua `/admin`, xác nhận, xoá env seed | **Có** |
| 6 | Medium | CSP enforce | Chưa có violation data từ domain thật | Thu thập report ≥ vài ngày, sửa nguồn, rồi enforce | **Có** (thời điểm) |
| 7 | Medium | Distributed rate limit | In-memory, single instance | Chỉ xử lý khi scale; thay backend shared store | Không (khi cần) |
| 8 | Medium | Log rotation + alerting | Cấu hình host chưa có | journald/logrotate + alert ready/disk/backup | Không |
| 9 | Medium | S3 driver chưa kiểm chứng | Không có bucket | Test put/get/delete/HeadBucket trên bucket staging | Không |
| 10 | Low | Orphan media cleanup | Chưa có job | Thêm job định kỳ khi có nhu cầu | Không |
| 11 | Low | Artifact ảnh trong base commit | `.artifacts/*.png` đã bị commit trước Phase 5 | Xoá khỏi Git trong một commit riêng nếu được đồng ý | **Có** |
| 12 | Medium | Thiếu CI/deployment descriptor | Target chưa chọn | Tạo sau khi chọn A/B/C | **Có** |
| 13 | Medium | Advisory dependency | `npm audit --omit=dev`: 4 high + 1 moderate (Prisma/PostCSS build chain) | Đánh giá nâng Prisma/Next major trên nhánh thử; không `audit fix --force` trên production | Không (cần kế hoạch) |

## J. Git Change Summary (chưa commit)

### Đã sửa trong Phase 5

| File | Loại | Lý do |
|---|---|---|
| `src/server/storage/types.ts` | Required | Thêm `healthCheck()` vào interface |
| `src/server/storage/local.ts` | Required | Kiểm tra thư mục upload ghi được |
| `src/server/storage/s3.ts` | Required | `HeadBucket` cho readiness, không báo healthy giả |
| `src/server/storage/index.ts` | Required | Ủy quyền readiness cho driver |
| `src/server/media/upload.ts` | Recommended | Giới hạn 100 MP khi decode |
| `.gitignore` | Recommended | Ignore `/.artifacts/` |
| `.env.example` | Recommended | Quyền S3 cần thiết + hướng dẫn preflight |
| `docs/PRODUCTION_CHECKLIST.md` | Required | Cập nhật trạng thái Phase 5 |
| `docs/PRODUCTION_DEPLOYMENT.md` | Required | Preflight, rotation admin, backup tool |

### File mới trong Phase 5

- `scripts/preflight.mjs`
- `tests/preflight.test.ts`
- `docs/DEPLOYMENT_ARCHITECTURE.md`
- `docs/PHASE_5_PRODUCTION_READINESS_REPORT.md` (tài liệu này)

### File mới từ các phase trước, vẫn chưa commit

`src/lib/{csp,json-ld,logger,origin,setup-guard}.ts`,
`src/lib/services/site-context.ts`, `src/server/storage/*`, `src/app/api/health/`,
`src/app/api/ready/`, `src/components/site/service-unavailable.tsx`,
`scripts/{backup-db,restore-db}.sh`, các test bảo mật, 3 tài liệu vận hành.

### Xoá / staged

- `.next-server.log` — staged deletion, không khôi phục.

### Không đưa vào release

`.env`, `.next/`, `.pgdata/`, `storage/uploads/`, `backups/`, `*.log`,
`tsconfig.tsbuildinfo`, `.artifacts/`.

Số liệu cuối: **51 modified, 1 staged deletion, 29 untracked** (26 mục source/docs/script/test + 3 thư mục/file mới được liệt kê riêng bởi Git).

**Chưa commit, chưa push, chưa stage thêm bất kỳ file nào.**

## Phân loại thay đổi

| Loại | Nội dung |
|---|---|
| Required | Readiness storage, 4 file storage phải commit, preflight, tài liệu trạng thái |
| Recommended | Giới hạn pixel ảnh, ignore artifact, cảnh báo seed trong preflight |
| Deferred | Shared rate-limit store, orphan cleanup, CSP enforce, CI/deploy descriptor |
| Blocked | DB production, restore drill, media target, domain/HTTPS, rotation mật khẩu |

## Kết luận

**BLOCKED — WAITING FOR OWNER DECISIONS**

Phần kỹ thuật trong tầm kiểm soát đã hoàn tất và có bằng chứng (fresh clone,
107 test, build, migration trên DB trống, runtime smoke). Không thể tiến tới
Release Review cho tới khi chủ dự án chọn database/hosting/domain/media target
và duyệt rotation mật khẩu seed; restore drill chỉ có thể hoàn tất khi có
PostgreSQL client tools và một database đích.
