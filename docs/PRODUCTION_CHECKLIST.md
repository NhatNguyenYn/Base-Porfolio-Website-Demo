# Production Readiness Checklist

Trạng thái: **DONE** = có bằng chứng chạy thật trong repo/môi trường local;
**PENDING** = đã có hướng dẫn nhưng chưa thực hiện; **BLOCKED** = cần quyết định
hoặc quyền truy cập; **N/A** = không áp dụng cho dự án này.

Cập nhật lần cuối: Phase 5 (release blocker remediation).

## Application

| # | Hạng mục | Trạng thái | Bằng chứng / ghi chú |
|---|---|---|---|
| A1 | `next build` production pass | DONE | `npx next build` exit 0 |
| A2 | TypeScript / ESLint / Vitest | DONE | tsc 0, eslint 0, vitest 107/107 (14 file) |
| A3 | Không có `NEXT_PUBLIC_*` chứa secret | DONE | `grep NEXT_PUBLIC` → none |
| A4 | Không hardcode credential trong source | DONE | chỉ `.env.example` placeholder |
| A5 | `start` script chạy production | DONE | `next start` đã chạy local |
| A6 | Error boundary/outage shell khi DB lỗi | DONE | `/vi` 200 + thông báo, API 503 JSON |
| A7 | Không phụ thuộc dữ liệu dev khi chạy production | PENDING | Cần deploy với DB riêng và seed thật |

## Environment

| # | Hạng mục | Trạng thái | Ghi chú |
|---|---|---|---|
| E1 | `.env.example` đủ biến + mô tả | DONE | gồm `HSTS_INCLUDE_SUBDOMAINS`, backup |
| E2 | `SETUP_TOKEN` bắt buộc ở production | DONE (unit) | Chưa test runtime vì DB đã có admin |
| E3 | `TRUSTED_PROXY_HOPS` đúng topology | BLOCKED | Chưa biết proxy thực tế; hướng dẫn trong docs |
| E4 | Secret production không nằm trong repo | DONE | `.env` ignored, history chỉ có placeholder |
| E5 | `APP_URL` là domain HTTPS thật | PENDING | Cần domain trước khi build |
| E6 | Preflight biến môi trường production | DONE | `scripts/preflight.mjs` + 7 test; không in giá trị |

## Database

| # | Hạng mục | Trạng thái | Ghi chú |
|---|---|---|---|
| D1 | PostgreSQL service riêng (không embedded) | PENDING | Dev đang dùng embedded :5433 |
| D2 | Migration baseline + status sạch | DONE | 2 migration, "Database schema is up to date!" |
| D3 | Index/constraint cho query chính | DONE | 78 index/unique trong schema |
| D4 | Migration không phá huỷ dữ liệu | DONE | Chỉ additive; rollback = restore |
| D5 | Backup tự động + retention | PENDING | Script sẵn sàng, chưa đặt cron |
| D6 | Off-site backup | PENDING | Cần hạ tầng đích |
| D7 | Restore đã diễn tập | BLOCKED | Chưa chạy trên DB thật (được yêu cầu không xoá dữ liệu) |
| D8 | Connection pool/timeout phù hợp | PENDING | Đặt `connection_limit` theo DB production |
| D9 | Quyền DB tối thiểu (không superuser) | PENDING | Cần tạo role khi provisioning |
| D10 | PostgreSQL client tools (`pg_dump`/`pg_restore`) | BLOCKED | Máy dev không có trong PATH; script dừng đúng guard |

## Storage & Media

| # | Hạng mục | Trạng thái | Ghi chú |
|---|---|---|---|
| S1 | MIME + magic-byte validation | DONE | sharp decode; HTML giả PNG → 415 |
| S2 | Chặn SVG, chặn path traversal | DONE | allowlist raster; `assertSafeKey` |
| S3 | Giới hạn dung lượng | DONE | `MAX_UPLOAD_MB` (10) + body limit 12 MB |
| S4 | Tên file an toàn (UUID) | DONE | không dùng filename client |
| S5 | Persistent storage production | BLOCKED | Chọn volume hoặc S3 trước deploy |
| S6 | Backup media | PENDING | Phụ thuộc S5 |
| S7 | Dọn file orphan | PENDING | Chưa có job; rủi ro dung lượng |
| S8 | Giới hạn pixel ảnh | DONE | `sharp(..., { limitInputPixels: 100_000_000 })` |

## Security

| # | Hạng mục | Trạng thái | Ghi chú |
|---|---|---|---|
| C1 | CSP Report-Only + nonce | DONE | 45/45 script nonce, 0 violation sau fix |
| C2 | CSP Enforce | BLOCKED | Phase 2: CONDITIONAL; chờ dữ liệu production |
| C3 | JSON-LD escaping | DONE | test + runtime |
| C4 | Session cookie httpOnly/Secure/SameSite | DONE | kiểm tra code + runtime |
| C5 | Origin check admin mutations | DONE | 403 evil/same-site/browser-no-Origin |
| C6 | Security headers (nosniff, referrer, permissions) | DONE | curl header |
| C7 | HSTS | DONE (conditional) | chỉ production + HTTPS; includeSubDomains opt-in |
| C8 | Rate limit login/contact/upload | DONE (single instance) | in-memory, reset khi restart |
| C9 | Distributed rate limit | BLOCKED | Cần Redis khi scale |
| C10 | Seed password rotation (H4) | BLOCKED | Chờ chủ dự án xác nhận |
| C11 | Admin API 401/403 đúng | DONE | curl + test |
| C12 | SQL injection | DONE | Prisma parameterized; chỉ `SELECT 1` literal |
| C13 | Advisory dependency | PENDING | `npm audit --omit=dev`: 4 high + 1 moderate (Prisma/PostCSS); cần nâng major có kế hoạch |

## Observability

| # | Hạng mục | Trạng thái | Ghi chú |
|---|---|---|---|
| O1 | `/api/health` liveness | DONE | trả 200, không chạm DB |
| O2 | `/api/ready` readiness | DONE | DB + storage; local kiểm tra quyền ghi, S3 gọi HeadBucket; 503 khi lỗi |
| O3 | Structured JSON logging | DONE | `logEvent`, redact key nhạy cảm |
| O4 | Request ID | DONE | middleware `x-request-id` |
| O5 | Log rotation | PENDING | logrotate/journald trên server |
| O6 | Error monitoring service | N/A | Không thêm dịch vụ trả phí; log là nguồn chính |
| O7 | Alerting | PENDING | Cần hạ tầng giám sát |

## Performance & Reliability

| # | Hạng mục | Trạng thái | Ghi chú |
|---|---|---|---|
| P1 | Bundle size hợp lý | DONE | First Load JS ~103 kB |
| P2 | Image optimization | DONE | next/image AVIF/WebP |
| P3 | DB outage không sập public page | DONE | outage shell + API 503 |
| P4 | DB recovery không cần restart | DONE | Phase 1 test |
| P5 | Concurrent request smoke test | DONE | Phase 4: 30 request đồng thời → 30×200 |
| P6 | Upload bị ngắt | PENDING | Chưa test mạng yếu |
| P7 | Responsive 390/768/1440 | DONE | Chromium (trước đó + Phase 2) |
| P8 | Firefox/Safari | PENDING | Không có môi trường |

## Deployment

| # | Hạng mục | Trạng thái | Ghi chú |
|---|---|---|---|
| R1 | `docs/PRODUCTION_DEPLOYMENT.md` | DONE | 15 mục |
| R2 | Reverse proxy + HTTPS config mẫu | DONE | nginx sample |
| R3 | systemd restart policy | DONE | sample unit |
| R4 | Rollback procedure | DONE | code + DB restore |
| R5 | Domain/DNS/HTTPS thực tế | BLOCKED | Cần chủ dự án |
| R6 | Backup cron + off-site | PENDING | Cần server |
| R7 | Deploy thực tế | BLOCKED | Chưa được phép deploy |

## Release gate (Phase 4)

| # | Hạng mục | Trạng thái | Bằng chứng / ghi chú |
|---|---|---|---|
| G1 | Release scope được xác định | DONE | 55 file thay đổi + 23 file mới; loại trừ `.env`, `.next`, `.pgdata`, `storage/uploads`, `.artifacts` |
| G2 | Secret scan tracked + history | DONE | Chỉ `.env.example` placeholder; 0 private key/API key trong history |
| G3 | Storage source được đóng gói | DONE (fix) | `.gitignore` `storage/` → `/storage/`; 4 file `src/server/storage/*` giờ untracked, **phải commit** |
| G4 | Commit release | BLOCKED | Release gate chưa đạt; chưa commit |
| G5 | Push | BLOCKED | Chưa được phê duyệt |
| G6 | Production deployment | BLOCKED | Chưa có target/DB/domain/storage |
| G7 | Backup trước deploy | PENDING | Script sẵn sàng, chưa chạy |
| G8 | Restore drill | BLOCKED | Cần DB tạm |
| G9 | Post-deployment report | DONE | `docs/POST_DEPLOYMENT_REPORT.md` (trạng thái: chưa deploy) |

## Phase 5 — remediation

| # | Hạng mục | Trạng thái | Bằng chứng |
|---|---|---|---|
| R5.1 | Fresh clone từ working tree | DONE | npm ci 442 gói; tsc/eslint/107 test/build pass |
| R5.2 | Fresh clone từ HEAD | FAIL (đúng dự kiến) | Thiếu 4 file storage → 4×TS2307, build fail |
| R5.3 | Migration trên DB trống | DONE | 30 bảng, 78 index, 2 migration, 0 lỗi |
| R5.4 | Readiness S3 không báo giả | DONE | `HeadBucket` trong `healthCheck()` |
| R5.5 | Giới hạn pixel ảnh | DONE | `limitInputPixels` |
| R5.6 | Preflight env production | DONE | `scripts/preflight.mjs` + `tests/preflight.test.ts` |
| R5.7 | Backup/restore thực tế | BLOCKED | Thiếu `pg_dump`/`pg_restore` |
| R5.8 | Kiến trúc triển khai | DONE (đề xuất) | `docs/DEPLOYMENT_ARCHITECTURE.md` |
| R5.9 | Báo cáo Phase 5 | DONE | `docs/PHASE_5_PRODUCTION_READINESS_REPORT.md` |

## Trước khi go-live

1. Xác nhận `TRUSTED_PROXY_HOPS` và cấu hình XFF của proxy.
2. Chọn persistent storage (volume hoặc S3), test upload + restart container.
3. Tạo DB production, role tối thiểu, chạy `prisma migrate deploy`, seed admin
   bằng `SETUP_TOKEN` rồi xoá token.
4. Đặt cron backup + copy off-site; diễn tập restore trên DB tạm.
5. Cấu hình `/api/ready` làm health check; logrotate.
6. Chạy một vòng CSP report trên domain thật trước khi cân nhắc Enforce.
7. Rotation mật khẩu seed (H4) sau khi được duyệt.
