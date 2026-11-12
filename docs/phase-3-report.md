# Phase 3 — Full-stack Integration & Content Synchronization

Báo cáo bàn giao. Đánh dấu **[Đã kiểm thử]** = có bằng chứng chạy thực tế; **[Đã triển khai]** = code hoàn chỉnh nhưng chưa chạy kiểm thử tương ứng.

## 1. Module đã tích hợp

| Module | Frontend | Backend | Tích hợp |
|---|---|---|---|
| Profile / About | Hero, About preview/detail, education, experience, skills, social | `getProfile`, `getEducation`, `getExperience`, `getSkills`, `getSocialLinks` | **[Đã kiểm thử]** đổi `fullName` trong DB → homepage + `/api/profile` đổi ngay, không restart |
| Projects | list/filter/search/pagination/detail/related | `listProjects`, `getProjectDetail`, `getNextProject` | **[Đã kiểm thử]** (vitest + runtime 404 cho private/unpublished) |
| Art Gallery | grid, collection/category filter, lightbox, detail | `listArtworks`, `getCollection`, `getArtworkDetail` | **[Đã kiểm thử]** vitest visibility + preview artwork full-size; lightbox kiểm thử ở Phase 1 |
| Blog | list, featured, tags, search, detail, TOC, related | `listArticles`, `getArticleDetail`, `getRelatedArticles` | **[Đã kiểm thử]** draft→404, publish→200 + list + sitemap, unpublish→404 |
| Contact | form server action | `submitContactMessage` → PostgreSQL | **[Đã kiểm thử]** ở Phase 2 (submit thật + thấy trong `/admin/messages`); Phase 3 không chạy lại UI |
| Settings | header/footer/SEO | `getSettings` | **[Đã kiểm thử]** gián tiếp qua mọi trang |
| Media | `/media/[...key]`, next/image | upload + storage | **[Đã kiểm thử]** Phase 2 (201 PNG, 415 HTML giả); Phase 3 xem ảnh full-size |

Không component nào import Prisma; mọi truy cập dữ liệu đi qua seam `src/data/*` → `src/server/queries/*`.

## 2. API đã kết nối

`/api/{profile,projects,projects/[slug],artworks,artworks/[slug],collections,categories,tags,articles,articles/[slug],settings}` + admin API (`/api/admin/*`, bảo vệ `authorize(roles)`).

- **[Đã kiểm thử]** `/api/admin/me` không cookie → 401; `/admin/users` → 307 login.
- **[Đã kiểm thử]** `/api/articles` trả danh sách mới publish ngay sau khi ghi DB.
- **[Đã kiểm thử]** `Cache-Control` public API = `max-age=0, s-maxage=0, must-revalidate`.

## 3. MOCK đã loại bỏ

- `grep -rni "mock|fixture" src` → không còn kết quả. Toàn bộ nội dung công khai đọc PostgreSQL.
- **[Đã kiểm thử]** Homepage render tên/title thật từ DB (không placeholder).
- **[Đã triển khai]** Không fallback chéo ngôn ngữ: bỏ `profile.translations[0].shortBio` khỏi homepage; thiếu bản dịch → empty state/settings trung tính.
- Fixtures chỉ còn trong `tests/helpers/db.ts` (DB test riêng).

## 4. Localization Architecture

- `src/i18n` (dictionary VI/EN, `isLocale`, `localeHref`, `stripLocale`), route `/[locale]/...`, VI mặc định.
- **[Đã kiểm thử]** article VI-only: `/en/blog/<slug>` → 200 + notice "chưa có bản dịch" + `robots: noindex, nofollow`, **không** render nội dung VI; `/vi/...` bình thường.
- **[Đã kiểm thử]** hreflang chỉ chứa locale có bản dịch (VI-only → `vi` + `x-default`, không có `en`).
- **[Đã triển khai]** Language switcher giữ slug + query (`stripLocale` + `router.push`).
- Hạn chế: layout `/preview` luôn `lang="vi"` (trang nội bộ, noindex).

## 5. Cache Strategy

- Public pages `dynamic = "force-dynamic"`; API `s-maxage=0, must-revalidate`; sitemap `force-dynamic`.
- Server Actions gọi `revalidatePath("/", "layout")` sau mọi thay đổi profile/project/article/artwork/settings.
- **[Đã kiểm thử]** publish → xuất hiện ngay; unpublish → 404 ngay; không deploy lại.
- **Bug thật đã sửa:** `publishedWhere` dùng `new Date()` ở module scope (đóng băng lúc khởi động server) khiến bài publish sau đó không vào listing đến khi restart. Nay tính theo từng query + test hồi quy.

## 6. SEO Implementation

- Metadata động (title/description/canonical/OG/Twitter/locale) cho home, about, projects, art, blog, contact và 3 loại detail.
- `src/lib/seo.ts`: `languageAlternates()` chỉ phát locale có bản dịch; `canonicalPath()`.
- Sitemap **[Đã kiểm thử]**: 52 URL seed, không có draft/private/scheduled/archived, không có `/admin`; bài VI-only chỉ 1 URL.
- Robots **[Đã kiểm thử]**: `Disallow: /admin`, `/api/`, `/media/`; preview route noindex.
- **[Đã kiểm thử]** thiếu bản dịch → noindex + title "chưa có bản dịch" thay vì "404".

## 7. Preview Workflow

- Route `/preview/[type]/[id]?locale=vi|en` (`article|project|artwork`), Server Component, `requireUser()` trước khi đọc DB, `dynamic`, `robots: noindex`.
- Không dùng token/URL bí mật cố định; quyền truy cập = session admin hiện có.
- **[Đã kiểm thử]** ẩn danh → 307 `/admin/login`; đã đăng nhập → render draft thật (markdown, cover, tech, gallery, ảnh full-size), banner trạng thái `draft`, chuyển locale, cảnh báo thiếu bản dịch.
- Nút "Xem trước" trong editor Article/Project/Artwork.

## 8. Test Results

- **[Đã kiểm thử]** `npx tsc --noEmit` → 0 lỗi.
- **[Đã kiểm thử]** `npx eslint src tests` → 0 lỗi.
- **[Đã kiểm thử]** `npx next build` → thành công.
- **[Đã kiểm thử]** `npx vitest run` → **57/57 pass** (6 file; thêm `tests/integration-phase3.test.ts` 11 test: hreflang, locale availability, sitemap, cache header, publish freshness).
- **[Đã kiểm thử]** runtime: preview 3 loại, draft 404, publish/unpublish, profile rename, API 401/307, sitemap, robots, cache header, preview 375px không tràn ngang.
- Chưa chạy lại: upload ảnh qua UI, submit contact qua UI, lightbox trên mobile thật, kiểm thử tải đồng thời.

## 9. Lỗi còn tồn tại

1. Contact là Server Action, chưa có endpoint REST `/api/contact` (brief gợi ý "gửi API"). Validation 2 lớp + rate limit + honeypot + lưu DB đều ở server.
2. Không có `loading.tsx` cấp locale (bug streaming Next 15.5), nên loading state là client `PageTransition`/pending của form, không phải skeleton streaming.
3. `loadSection` (cô lập lỗi từng section homepage) chưa được kiểm thử bằng cách cố tình làm lỗi một query.
4. Preview luôn `lang="vi"` và dùng layout riêng, không tái sử dụng header/footer public.
5. `getCollection`/`getArtworkDetail` trả `not_found` khi thiếu bản dịch collection; chưa có trang thông báo riêng cho collection.

## 10. Đề xuất Phase 4

1. REST `/api/contact` + client-side fetch có retry và idempotency key; log lỗi có request id.
2. Observability: structured logging + Sentry (server actions, API, upload) và cảnh báo lỗi 5xx.
3. CDN/tag-based cache (`revalidateTag`) khi lưu lượng tăng; hiện tại revalidate mỗi request.
4. Preview có thể chia sẻ cho biên tập viên bằng token ngắn hạn (vẫn yêu cầu đăng nhập mặc định).
5. E2E Playwright cho TEST 1–8 (hiện dùng vitest + kiểm thử trình duyệt thủ công).
6. Tối ưu ảnh: AVIF/WebP + `sizes` rà soát toàn bộ, đo LCP.
