# Post-Deployment Report — Portfolio

> **Trạng thái: CHƯA DEPLOY.** Tài liệu này được tạo ở Phase 4 với trạng thái
> thực tế của hệ thống. Các mục đánh dấu N/A sẽ được điền sau khi chủ dự án phê
> duyệt và triển khai lên môi trường production.

## 1. Release identification

| Trường | Giá trị |
|---|---|
| Deployment timestamp | N/A — chưa deploy |
| Release commit | Chưa tạo (working tree chưa commit) |
| Base commit | `30c20fd` (#1: First push for Deloy) |
| Branch | `main` |
| Remote | `origin` → GitHub (`Base-Porfolio-Website-Demo`) |
| Deployment target | Chưa xác định (không có Dockerfile/CI/manifest) |
| Domain | Chưa cấu hình |
| Environment | Local: Next.js production build, PostgreSQL 18.6 embedded |

## 2. Release gate status

| Gate | Trạng thái | Ghi chú |
|---|---|---|
| Không còn Critical/High chưa xử lý | PARTIAL | H4 seed password chưa được duyệt rotation |
| CSP decision | DONE | Report-Only, CONDITIONAL (Phase 2) |
| Production environment ready | **BLOCKED** | Chưa có server/DB/domain/storage |
| Database backup hợp lệ | PENDING | Script sẵn sàng, chưa chạy; chưa có DB production |
| Restore đã kiểm chứng | **BLOCKED** | Cần DB tạm; chưa diễn tập |
| Media persistent strategy | **BLOCKED** | Chưa chọn volume/S3 |
| Authentication/authorization | DONE | Kiểm thử local (login, RBAC, 401/403) |
| Production build | DONE | `next build` pass |
| Regression tests | DONE | 99/99 vitest, tsc/eslint pass |
| Env variables verified | PARTIAL | `.env.example` đủ; giá trị production chưa có |
| Không có thay đổi chưa giải thích | DONE | Audit Phase 4 hoàn tất |

## 3. Pre-deployment test results

| Kiểm tra | Kết quả |
|---|---|
| `npx tsc --noEmit` | 0 |
| `npx eslint src tests` | 0 |
| `npx vitest run` | 99/99 (13 file) |
| `npx next build` | Pass |
| `/api/health` | 200 `{status:"ok"}` |
| `/api/ready` | 200 `{database:"ok",storage:"ok"}` |
| DB unavailable | `/api/ready` 503 `{database:"unavailable"}`, `/api/articles` 503 JSON, `/vi` 200 outage shell |
| 30 request đồng thời | 30×200 |
| Public routes | `/vi`, `/en`, `/blog`, `/projects`, `/art`, `/about`, `/contact`, `/admin/login` đều 200 |
| Security headers | nosniff, referrer, permissions, XFO, HSTS (không includeSubDomains), CSP Report-Only |
| Nonce | Khác nhau mỗi request; 0 script thiếu nonce trên các trang đã kiểm |
| Mobile 390 px | Không overflow, console sạch |

## 4. Health status after deployment

N/A — chưa deploy.

## 5. Security verification (production)

N/A — chưa có domain/HTTPS. Checklist sẽ chạy lại trên origin thật:
redirect HTTP→HTTPS, `Secure` cookie, header thực tế, nonce qua proxy, ẩn
`/admin` với người dùng ẩn danh, không lộ stack/env, không public source map.

## 6. Incidents

Không có — chưa deploy.

## 7. Rollback status

Không áp dụng. Kế hoạch rollback đã có trong `docs/PRODUCTION_DEPLOYMENT.md`
(mục 15); database rollback dựa trên restore dump, không dựa vào down-migration
vì Prisma migration là forward-only.

## 8. Monitoring window

Chưa bắt đầu. Khi deploy, theo dõi:

- 30 phút: health/ready mỗi phút, 5xx, login, upload, CSP console.
- 24 giờ: tỷ lệ 5xx/4xx, độ trễ trung bình, lỗi DB, restart.
- 72 giờ: dung lượng disk/media, log bất thường, độ ổn định tổng thể.

Nguồn dữ liệu hiện có: JSON log của ứng dụng (`requestId`, `route`, `status`,
`durationMs`), `journalctl`/file stdout, `/api/ready`.

## 9. Findings từ Phase 4 audit

| Phát hiện | Mức | Trạng thái |
|---|---|---|
| `.gitignore` rule `storage/` khớp cả `src/server/storage/` khiến 4 file source storage bị ignore và **không có trong Git** | **Critical cho release** (fresh clone không build được) | Đã sửa rule thành `/storage/`; 4 file giờ hiện untracked, **phải được commit** trước release |
| Chưa có deployment descriptor/CI | High cho vận hành | BLOCKED — cần chọn target |
| Chưa có DB production/backup restore drill | High | BLOCKED |
| Chưa có persistent media | High | BLOCKED |
| H4 seed password | High | BLOCKED — chờ xác nhận |
| CSP Report-Only | Medium | Giữ nguyên theo quyết định Phase 2 |

## 10. Kết luận

**DEPLOYMENT BLOCKED** — release chưa thể thực hiện cho tới khi các mục ở mục 2
được đóng. Không có thay đổi production nào được thực hiện trong Phase 4.
