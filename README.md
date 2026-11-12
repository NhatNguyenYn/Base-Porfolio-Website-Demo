# Base Portfolio Website — Portfolio Studio (Demo)

Website portfolio cá nhân + phòng tranh số + blog, kèm CMS quản trị tích hợp sẵn.
Code chạy bằng **Next.js 15 (App Router) + Prisma + PostgreSQL**, giao diện song ngữ
**Tiếng Việt / English**, nội dung thật đọc từ database (không còn mock).

> **Lưu ý deploy:** đây là ứng dụng **full-stack** (server actions, API routes,
> session đăng nhập, PostgreSQL). App đầy đủ deploy trên **Vercel** (hoặc
> Render / VPS có Node.js + PostgreSQL), xem mục [Deploy](#deploy). Riêng
> **bản demo tĩnh** của trang công khai (không có CMS/API) deploy được trên
> **GitHub Pages** — xem mục [Demo trên GitHub Pages](#demo-trên-github-pages).

## Tính năng

- **Trang công khai:** Trang chủ, Giới thiệu (học vấn, kinh nghiệm, kỹ năng),
  Dự án (lọc / tìm kiếm / phân trang), Phòng tranh (bộ sưu tập, lightbox),
  Blog (bài viết, tag, mục lục, bài liên quan), Liên hệ (lưu tin nhắn vào DB).
- **Song ngữ VI/EN:** route `/vi/...` và `/en/...`, mặc định `vi`. Thiếu bản dịch
  thì hiện thông báo “chưa có bản dịch” thay vì tự dịch chéo ngôn ngữ.
- **CMS quản trị (`/admin`):** quản lý dự án, tác phẩm, bộ sưu tập, bài viết,
  taxonomy, thư viện media, hộp thư liên hệ, hồ sơ, cài đặt và người dùng.
  Đăng nhập bằng session (token ngẫu nhiên, hash SHA-256 trong DB, cookie httpOnly).
- **Phân quyền:** `SUPER_ADMIN` (toàn quyền, kể cả cài đặt + người dùng) và
  `ADMIN` (quản lý nội dung + hộp thư). Tài khoản super admin cuối cùng không
  thể bị hạ quyền hay vô hiệu hoá.
- **API công khai:** `/api/profile`, `/api/projects`, `/api/artworks`,
  `/api/collections`, `/api/articles`, `/api/categories`, `/api/tags`,
  `/api/settings` — envelope `{ success, data, meta }`, chỉ trả nội dung đã
  xuất bản. API admin dưới `/api/admin/*` yêu cầu session.
- **Upload media:** kiểm tra MIME **và** định dạng giải mã thật (JPEG/PNG/WebP/
  AVIF/GIF, SVG bị từ chối), tối đa 10 MB/file, lưu local hoặc S3-compatible
  (R2 / S3 / MinIO / B2).
- **SEO:** metadata động, canonical, Open Graph, hreflang theo bản dịch có thật,
  sitemap động (`/sitemap.xml`), robots chặn `/admin`, `/api/`, `/media/`.

## Công nghệ

| Lớp | Công nghệ |
|---|---|
| Framework | Next.js 15.5, React 19, TypeScript, Tailwind CSS 4 |
| Database / ORM | PostgreSQL 18, Prisma 6 |
| Auth | Session trong DB + bcrypt (cost 12), rate limit đăng nhập |
| Upload | `sharp` validate ảnh, driver local / S3 (`@aws-sdk/client-s3`) |
| Test | Vitest (57 test, xem `docs/phase-3-report.md`) |

## Chạy local

```bash
npm install
cp .env.example .env        # rồi điền giá trị thật, xem bảng bên dưới
npm run db:start            # PostgreSQL 18 trên 127.0.0.1:5433 (chỉ Windows, xem ghi chú)
npm run db:deploy           # áp migration
npm run db:seed             # nội dung demo + tài khoản admin đầu tiên (từ .env)
npm run dev                 # http://localhost:3000 — CMS ở /admin
```

Ghi chú:

- `npm run db:start` dùng gói `@embedded-postgres/windows-x64` nên **chỉ chạy
  trên Windows**. Trên macOS/Linux, hãy trỏ `DATABASE_URL` tới một PostgreSQL
  sẵn có (Docker, Postgres.app, hoặc máy chủ) rồi chạy `db:deploy` + `db:seed`.
  Gói Windows-only đã để ở `optionalDependencies` nên `npm install` trên Linux
  (kể cả lúc deploy Vercel) không còn lỗi `EBADPLATFORM`.
- `npm run build` = `prisma generate && prisma migrate deploy && next build`,
  nên lúc build cần `DATABASE_URL` trỏ tới database thật.

## Biến môi trường

Copy `.env.example` thành `.env`. Không bao giờ commit file `.env` thật.

| Biến | Ví dụ / ghi chú |
|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5433/portfolio?schema=public` |
| `APP_URL` | `http://localhost:3000` local; URL production khi deploy |
| `AUTH_SECRET` | Chuỗi ngẫu nhiên **≥ 32 ký tự** (HMAC cho rate limit) |
| `SETUP_TOKEN` | Để trống: `/admin/setup` chỉ cho phép từ localhost |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME` | Tài khoản admin tạo 1 lần khi seed. **Đặt mật khẩu mạnh riêng (≥ 10 ký tự), không dùng mật khẩu mẫu**, rồi xoá khỏi `.env` sau khi seed xong |
| `STORAGE_DRIVER` | `local` hoặc `s3` |
| `UPLOAD_DIR` / `MAX_UPLOAD_MB` | `local`: `./storage/uploads`, `10` |
| `S3_ENDPOINT` / `S3_REGION` / `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_PUBLIC_BASE_URL` | Chỉ cần khi `STORAGE_DRIVER="s3"` |

## Tài khoản admin đầu tiên

Không có tài khoản nào hard-code trong code. Có 2 cách tạo:

1. `npm run db:seed` dùng `SEED_ADMIN_*` trong `.env` (chỉ tạo 1 lần, bỏ qua nếu
   email đã tồn tại).
2. Mở `/admin/setup` khi chưa có user nào. Mặc định chỉ chạy từ localhost, trừ
   khi đặt `SETUP_TOKEN`. Tài khoản đầu tiên luôn là `SUPER_ADMIN`.

Đổi mật khẩu sẽ thu hồi toàn bộ session khác của tài khoản đó.

## Deploy

### Vercel (khuyên dùng)

1. Tạo project Vercel từ repo này (framework tự nhận Next.js).
2. Tạo database PostgreSQL (Vercel Postgres, Neon hoặc Supabase đều được) và
   chạy `npm run db:deploy` để áp migration.
3. Đặt biến môi trường trên Vercel: `DATABASE_URL`, `APP_URL` (URL production),
   `AUTH_SECRET` (ngẫu nhiên ≥ 32 ký tự). `STORAGE_DRIVER="s3"` + thông tin
   bucket nếu muốn upload bền vững (disk của Vercel không giữ file upload).
4. Deploy. Lần đầu sau khi DB có bảng, chạy `npm run db:seed` một lần với
   `SEED_ADMIN_*` để có tài khoản admin, rồi xoá các biến seed.

### Demo trên GitHub Pages

Trang công khai (home, about, projects, art, blog, contact) có thể xuất thành
file tĩnh để demo với khách mà không cần server:

- **URL demo:** https://nhatnguyenyn.github.io/Base-Porfolio-Website-Demo/
  (tự động deploy lại mỗi khi push lên `main`, workflow
  `.github/workflows/pages.yml`).
- **Có trong bản demo:** toàn bộ trang công khai song ngữ với nội dung demo
  từ seed (4 dự án, 8 tác phẩm, 5 bài viết), sitemap + robots.
- **Không có trong bản demo:** CMS (`/admin`), API (`/api/*`), xem trước bản
  nháp (`/preview`), upload (`/media`), và form liên hệ không gửi được
  (hiện khối mailto thay thế). Muốn dùng đầy đủ thì deploy bản full-stack
  trên Vercel theo mục trên.
- **Cách nó hoạt động:** workflow chạy Postgres tạm trong CI, áp migration +
  seed dữ liệu demo, rồi build với `PAGES_EXPORT=1` (`output: "export"` +
  `basePath` + `trailingSlash` trong `next.config.ts`). Các route cần server
  tạm dời ra khỏi cây app trong lúc build rồi trả lại; trang công khai đổi
  `force-dynamic` thành `force-static` và liệt kê đường dẫn bằng
  `generateStaticParams`. Code nguồn không đổi gì cho bản full-stack —
  build Vercel vẫn chạy như cũ.

### Render / VPS

Tương tự: 1 web service Node.js + 1 PostgreSQL, đặt cùng các biến môi trường
trên, chạy `db:deploy` trước khi start.

## Kiểm thử

```bash
npm run db:create-test   # tạo database test (một lần)
npm test                 # vitest, chạy trên database portfolio_test riêng
npm run lint             # eslint src, 0 warning
npm run typecheck        # tsc --noEmit
```

57 test bao phủ: nội dung public (draft / private / hẹn giờ / chưa dịch đều 404),
envelope API, validation, hash mật khẩu, rate limit, slug, redirect an toàn và
storage driver. Xem chi tiết trong `docs/phase-3-report.md`.

## Cấu trúc

```
src/app/(public)/[locale]/   Trang công khai (vi/en): home, about, projects, art, blog, contact
src/app/(admin)/admin/       CMS: login, setup, dashboard, CRUD nội dung, users, settings
src/app/api/                 API công khai + /api/admin/* (yêu cầu session)
src/app/preview/[type]/[id]  Xem trước bản nháp (cần đăng nhập)
src/components/site|admin|ui Component trang public, CMS và UI dùng chung
src/server/                  Prisma client, auth/session, actions, queries, upload, storage (local/S3)
src/lib/                     Validation (zod), rate limit, SEO, markdown
src/i18n/                    Từ điển vi/en, định tuyến theo locale
src/data/                    Lớp nối dữ liệu (đọc từ DB qua server/queries)
prisma/                      schema.prisma, migrations, seed.ts (nội dung demo)
scripts/                     dev-db.mjs (Postgres local Windows), create-test-db.mjs
tests/                       Vitest + fixtures (database test riêng)
docs/                        backend.md (thiết kế backend), phase-3-report.md (bàn giao)
.artifacts/                  Ảnh chụp màn hình giao diện (tài liệu thiết kế)
public/demo/                 Ảnh/SVG placeholder cho nội dung demo
```

## Tài liệu

- `docs/backend.md` — thiết kế backend & CMS (phase 2): data model, API, upload, backup.
- `docs/phase-3-report.md` — báo cáo bàn giao tích hợp full-stack (phase 3), kết quả test.

## Bảo mật — đọc trước khi deploy

- Repo này là **public**: mọi thứ push lên đều ai cũng xem được. Không commit
  `.env`, database, file upload hay key/secret thật.
- Đổi `AUTH_SECRET` và mật khẩu admin seed thành giá trị riêng, mạnh, trước khi
  deploy production. Mật khẩu mẫu trong `.env.example` trước đây đã được gỡ.
- Contact chỉ lưu tin nhắn vào DB, chưa gửi email.
- Rate limit đăng nhập chạy theo từng process; deploy nhiều instance thì cần
  Redis (xem mục “Not done yet” trong `docs/backend.md`).
