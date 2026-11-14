# Phase 9 Baseline — Final Code Freeze, E2E Testing & Release Validation

- **Repo:** NhatNguyenYn/Base-Porfolio-Website-Demo — main @ `be00cee`.
- **Ngày baseline:** 2026-11-14. **Working copy:** `~/workspace/base-portfolio-review/repo-main/` (shallow clone của main @ `be00cee` + toàn bộ thay đổi Phase 8/9 chưa commit).
- **Nguyên tắc freeze:** chỉ sửa bug / bảo mật / dữ liệu / routing / responsive / a11y / hiệu năng / build. Mọi ý tưởng cải tiến không-phải-bug → `docs/POST_LAUNCH_BACKLOG.md`, không implement trong Phase 9.

## 1. Trạng thái lúc bắt đầu Phase 9 (9A)

### Code & docs
- Main @ `be00cee` (merge "combine backend work with GitHub Pages export", 2026-11-13 19:40Z). PR #1 đã merge (`fa5d5fb`); PR #2 mở (branch `fix/ci-postgres-service`).
- `docs/` có: ANALYTICS_PROPOSAL, DEPLOYMENT_ARCHITECTURE, PHASE_5_PRODUCTION_READINESS_REPORT, PHASE_7_MOTION_EDITORIAL_REPORT, POST_DEPLOYMENT_REPORT, PRODUCTION_CHECKLIST, PRODUCTION_DEPLOYMENT, backend.md, phase-3-report. **Không có** báo cáo Phase 8, Phase 9 baseline/report, và **không có báo cáo riêng Phase 1/2/4/6** (`backend.md` là design doc mang tựa "Phase 2", không phải báo cáo verification).
- `src/lib/json-ld.ts` (cơ chế `serializeJsonLd` của Phase 1), `src/app/sitemap.ts`, `src/app/robots.ts` đã tồn tại.
- Live GitHub Pages demo đang chạy (static export trang công khai). Full-stack app chưa deploy ở đâu (Vercel/Postgres chưa chốt).

### CI — vấn đề đã biết, parent xử lý riêng (không thuộc Phase 9)
- CI đỏ trên main tại bước `npx prisma generate && npx next build` (typecheck + lint pass; Pages export build xanh).
- **Root cause (từ log CI thật, không phải DB):** `next/font/google` fail ở font Lora trong `src/app/fonts.ts` — `TypeError: Cannot read properties of null (reading '1')` trong Google Fonts CSS parser của Next. PR #2 thêm Postgres service là chưa đủ.
- **Fix (parent-owned):** self-hosted fonts — 23 file `.woff2`, `@font-face` trong `src/app/fonts.css`, `@import` ở `globals.css:1`, 0 import `next/font/google`. Phase 9 ghi nhận là known issue đã có hướng fix, không tự implement competing fix. Build local với self-hosted fonts pass (xem §3).

### Môi trường kiểm chứng
Node 24.22.1 · Next 15.5.29 · React 19 · Prisma 6.19.3 · PostgreSQL 18 (embedded, `127.0.0.1:5432`, DB `portfolio` + `portfolio_test`) · Prisma engines mirror local `http://127.0.0.1:8811` · Chrome for Testing 158.0.8127.18 (tải từ `storage.googleapis.com` vì `cdn.playwright.dev` bị proxy chặn 400) · Playwright 1.65.0 · Lighthouse 13.6.0 · Vitest.

## 2. Baseline tests & builds (đầu Phase 9, trước implement)

| Kiểm tra | Kết quả |
|---|---|
| `npm ci` | exit 0 (452 packages; postinstall `prisma generate` OK) |
| `npm run typecheck` | 0 lỗi |
| `npm run lint` | 0 warning / 0 lỗi |
| `prisma validate` | OK |
| Vitest (DB up) | 20 file, **141/141 pass** |
| Vitest (DB down) | 3 file fail ở suite-level (`PrismaClientInitializationError` tại `127.0.0.1:5433` — vitest default port; cần override `TEST_DATABASE_URL` sang 5432) |
| `prisma migrate deploy` | OK (3 migrations) |
| Seed | OK (admin `admin@example.com`, 4 projects, 8 artworks, 5 articles) |
| Server build #1 (font cũ) | exit 0, 56/56 pages — lỗi font **không tái hiện** trên Node 24 local |
| Pages export build | exit 0, `out/` 187 file, 6.9 MB |
| Server build #3 (font mới, `.next` sạch) | exit 0, 56/56 pages |

Lưu ý: build #2 exit 1 chỉ do collision `.next` cũ (chạy server build trên `.next` của export build) — không chạy 2 chế độ build trên cùng `.next` mà không clean.

## 3. Security baseline (9A/9D audit — đọc code, không chạy production)

- **Secrets scan:** sạch, ngoại trừ 1 High dưới đây. Không có API key/token/private key/connection string thật, không `.env`/`.db` thật.
- **Findings: 19 (1 High, 6 Medium, 12 Low).**
  - **High:** mật khẩu admin mặc định của seed là literal trong repo public (`scripts/preflight.mjs:16`). Rotation BLOCKED — chờ chủ dự án duyệt (preflight chỉ warn; `docs/PRODUCTION_DEPLOYMENT.md:61` nói preflight dừng deploy — mâu thuẫn đã ghi nhận).
  - **Medium:** (1) CSP chỉ Report-Only, chưa enforce; (2) không origin check trên Server Actions (chỉ 3 API mutation có check); (3) rate-limit bucket cleanup không chạy (claim của Phase 5 sai — sweep ở top-level module, chạy 1 lần lúc import khi map rỗng); (4) không rate limit trên public GET APIs + `listProjects` load toàn bộ rows rồi filter trong bộ nhớ; (5) session lifecycle thiếu (không revoke session khác khi login, không sliding refresh, IP/UA lưu nhưng không check, không purge job); (6) `setupAction`/`changePasswordAction` không rate limit.
  - **Low (12):** login timing oracle; upload Server Action không throttle; login `next` validation ad-hoc; rate-limit bucket key case-sensitive; session IP lấy từ leftmost XFF không tin cậy; `hashedKey` salt fallback `"dev"`; setup TOCTOU race; contact timing tin client timestamp; Pages export ship 0 security headers; `dangerouslyAllowSVG`; role là String tự do; không audit log login thất bại.
- **`npm audit`:** BLOCKED (registry 403) — claim "5 advisories" của Phase 5 chưa verify được.
- **Tests lúc baseline:** 20 file, 149 test đếm tĩnh, chưa chạy.
- **Playwright lúc baseline:** chưa cài; không có browser nào trên VM (`~/.cache/ms-playwright/` chỉ có pointer file).

## 4. E2E readiness baseline (9B)

- Không có E2E suite nào trong repo.
- Không có Chromium/Chrome/Firefox/Safari trên VM.
- Cross-browser ngoài Chromium: không khả thi trên VM này — ghi rõ trong validation report, không claim.

## 5. Dữ liệu seed baseline

4 projects · 8 artworks · 5 articles · 3 collections · 8 categories (6 kind `article`) · 1 user (`admin@example.com`, SUPER_ADMIN) · 3 contact messages · 0 sessions. Template: cả 5 article đều `default` (chưa có editorial — seed Wave 2b chưa áp dụng vì DB seed trước Wave 2b; xem validation report §4).

## 6. Các file / trạng thái cần nhớ khi đọc validation report

- `.artifacts/*.png` còn tracked trong git (10 file) — xóa cần chủ duyệt.
- `src/app/fonts.ts`, `src/app/fonts.css`, `src/app/fonts/*.woff2`, 1 dòng `@import` trong `globals.css` — parent-owned, coordinator không sửa.
- `.github/workflows/` — parent xử lý qua browser, coordinator không sửa (trong đó còn 1 chuỗi `hidaniel` ở `pages.yml:8`).
- Backend/Postgres cho full-stack Vercel deploy: **chưa chốt** — không làm Vercel trong Phase 9.
- Landing repo PR #3 (robots.txt + sitemap.xml) vẫn mở — ngoài phạm vi repo này.
