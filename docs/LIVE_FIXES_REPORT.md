# Live Fixes — 4 lỗi demo tĩnh Base Portfolio (sau PR #3)

- **Repo:** `NhatNguyenYn/Base-Porfolio-Website-Demo`, làm việc trên `main @ d5d9182` + cây làm việc chưa commit.
- **Ngày:** 2026-11-14. **Trạng thái: ĐÃ SỬA XONG + KIỂM CHỨNG ĐẦY ĐỦ, chưa commit/push/deploy.**
- **Phạm vi:** 37 file thay đổi (+1220/−42), gồm 8 file mới. Không đụng `src/app/fonts.ts`, `src/app/fonts.css`, `src/app/fonts/*.woff2`, dòng `@import` fonts trong `globals.css`. Diff lần này không thêm chuỗi tên miền cũ nào (xem mục Mở, item 5).
- **Cách kiểm chứng:** mọi số liệu dưới đây chạy trên code cuối đã tích hợp (3 worker + 2 sửa nhỏ ở bước tích hợp), không phải trên bản build riêng lẻ của từng worker — trừ khi ghi chú khác.

## Kết quả kiểm chứng (code cuối)

| Kiểm chứng | Kết quả |
|---|---|
| `npm run typecheck` | 0 lỗi |
| `npm run lint` (`--max-warnings=0`) | 0 cảnh báo |
| Vitest full (`TEST_DATABASE_URL` → `portfolio_test` trên Postgres 5432; suite mặc định tìm DB ở 5433 — xem Ghi chú môi trường) | **25 file, 214/214 xanh** |
| Server build (`npm run build`, DB `portfolio`) | exit 0, 58 routes |
| Export build (đúng recipe `.github/workflows/pages.yml`, DB riêng `portfolio_integration`) | exit 0, **73 file HTML** (67 cũ + 6 trang projects/category mới), 228 file |
| HTML export (grep trên `out/`) | `src="/demo` trần = **0**; `href="/en"` / `href="/vi"` trần = **0**; `?category=` = **0**; 42 URL ảnh có prefix; canonical/OG đủ subpath; `manifest.webmanifest` đủ prefix; sitemap 16 `<loc>` category (10 blog + 6 projects) |
| Serve `out/` dưới subpath + curl (cổng 4190) | **17/17 trang 200** (home, vi, en, lists, category VI+EN, detail, sitemap, robots, manifest); **7/7 ảnh/asset 200**; đối chứng `/demo/article-01.svg` trần → **404** |
| E2E spec mới trên bản export đã serve | assets **11/11**, filter **5/5**, headings **23/23** (+1 skipped theo thiết kế) |
| E2E suite cũ trên server build (`next start` :3000, `APP_URL=http://127.0.0.1:3000`) | **72/72 xanh** (+1 skipped theo thiết kế) |

## Lỗi 1 — Toàn bộ ảnh hỏng

**Nguyên nhân gốc:** URL ảnh lưu trong DB là đường dẫn tuyệt đối gốc (`/demo/*.svg`, `prisma/seed.ts` ~947–951); components truyền thẳng vào `next/image`. Ở chế độ export, `images.unoptimized: true` khiến loader của Next **không** thêm `basePath` → HTML live có `src="/demo/..."` trần trong khi site serve dưới `/Base-Porfolio-Website-Demo/` → 404. Chỉ sửa render-time mới sửa được cả DB đã seed (không đổi seed).

**Đã sửa:**
- `src/lib/asset.ts` (mới): `getBasePath()` (đọc `process.env.NEXT_PUBLIC_BASE_PATH`), `assetUrl(path)` — chỉ prefix đường dẫn tuyệt đối nội bộ; giữ nguyên http(s), `//`, `data:`, `blob:`, đường dẫn đã có prefix, đường dẫn tương đối.
- `next.config.ts`: tách `const basePath`, thêm `env: { NEXT_PUBLIC_BASE_PATH: basePath }` để client bundle cũng đọc được (cùng giá trị với `basePath`, `""` khi không export). Không sửa `.github/workflows/*`.
- `src/lib/utils.ts` — `absoluteUrl` thêm basePath, chống double-prefix 2 lớp (APP_URL đã chứa subpath; path đã prefix thì strip trước khi nối). Server mode giữ nguyên hành vi cũ.
- Bọc `src` ảnh qua `assetUrl` ở **25 điểm**: `article-card`, `artwork-card`, `project-card`, `art-lightbox`, `editorial-article`, `media-picker` (4 điểm), home `page.tsx`, `about/page.tsx`, `art/page.tsx`, `art/[slug]/page.tsx` (ảnh + `<a href>` xem full-size), `blog/[slug]/page.tsx`, `projects/[slug]/page.tsx`, admin art/collections, art, media, projects, `preview/[type]/[id]/page.tsx`.
- Phát hiện thêm cùng gốc: `src/lib/seo.ts` để `icons: { icon: "/icon.png" }` (Next emit verbatim → 404 trên export) → đã bọc `assetUrl`.
- Tích hợp bổ sung (không phải worker): `src/app/manifest.ts` — `start_url`/`scope`/`icons` đều trần → dùng `getBasePath()` + `assetUrl`; `src/app/(public)/[locale]/layout.tsx:107` — `icons: { icon: assetUrl(settings.favicon?.url || "/icon.png") }` (favicon S3 giữ nguyên nhờ `assetUrl`).

**Kiểm chứng:** xem bảng trên (grep HTML 0 trần; curl ảnh 200; E2E assets 11/11 với `naturalWidth > 0` từng ảnh sau `scrollIntoViewIfNeeded`).

## Lỗi 2 — Chuyển ngôn ngữ VI/EN → 404 cả hai chiều

**Nguyên nhân gốc:** `LanguageSwitcher` dùng thẻ `<a>` với `hrefFor()` tự build `/${next}${path}`; `usePathname()` của Next **không** bao gồm `basePath` nên href thiếu prefix. `<Link>` thì Next tự thêm basePath, `<a>` trần thì không.

**Đã sửa:** `src/components/site/language-switcher.tsx`: `<a>` → `<Link>` (vẫn render `<a>` thật trong HTML nên giữ tính crawlable); `hrefFor()` giữ nguyên không-prefix vì Link tự thêm. `src/i18n/config.ts` **không đổi** `localeHref` (đổi sẽ double-prefix — đã chứng minh). Rà toàn repo: `locale-tabs.tsx` không có link nào (chỉ `<button>`); `admin-shell.tsx` chỉ có `<Link href="/vi">` (Link tự prefix, server mode basePath rỗng nên không hỏng); middleware không sửa (không chạy ở export).

**Kiểm chứng:** HTML export 0 `href="/en"`/`"/vi"` trần; E2E assets có test switcher chứa prefix + click EN sang `/en/` thành công.

## Lỗi 3 — Lọc `?category=` không lọc

**Nguyên nhân gốc:** cả hai trang list đều là Server Component đọc `searchParams` phía server rồi mới lọc. Ở bản export tĩnh, trang chỉ được prerender **một lần với searchParams rỗng** nên `category` luôn `""` trong HTML đã build; chip `<Link href="?category=slug">` bấm vào chỉ đổi URL, không có server nào render lại nội dung. Trang category riêng hoạt động vì lọc bằng path param (`generateStaticParams`), không dùng query. Projects thì **chưa hề có** trang category riêng.

**Đã sửa:**
- `src/app/(public)/[locale]/blog/page.tsx`, `src/app/(public)/[locale]/projects/page.tsx`: `categoryHref` ở export mode (`PAGES_EXPORT === "1"`, cùng guard như `generateMetadata`) trỏ tới `/category/<slug>`; server mode giữ `?category=` để còn lọc kết hợp q/tag/tech/sort.
- `src/app/(public)/[locale]/blog/category/[slug]/page.tsx`: bổ sung dãy chip (trước đây không có), chip category đang xem có `chip-active`.
- `src/app/(public)/[locale]/projects/category/[slug]/page.tsx` (**mới**): theo mẫu blog — `generateStaticParams` bằng `prisma.project.groupBy`, `listProjects(locale, {category})`, `notFound()` khi slug không có, `generateMetadata` giữ guard `PAGES_EXPORT`, chip row + `Pagination` + JSON-LD.
- `src/app/sitemap.ts`: thêm nhóm `/projects/category` (suy ra từ project public đã fetch, không thêm query mới) + test mới trong `tests/sitemap-robots.test.ts`.
- Link `?category=` trên trang chi tiết blog (`blog/[slug]/page.tsx:129,200`, `editorial-article.tsx:50,78`) cũng trỏ về `/blog/category/<slug>/` ở export mode (helper `categoryHref` cùng pattern).

**Kiểm chứng:** export 73 HTML (không rớt trang); chip trong HTML trỏ đủ basePath, 0 `?category=`; `/vi/blog/category/software-engineering/` chỉ có 1 bài; `/vi/projects/category/product/` chỉ có 2 dự án (Aurora + Lantern); E2E filter 5/5 (click chip → đúng trang + đúng số lượng + chip active, cả VI lẫn EN).

## Lỗi 4 — Tiêu đề lớn bị cắt chân dấu

**Nguyên nhân gốc (đo được, không đoán):** hai nguyên nhân cộng hưởng ở tầng class dùng chung — (a) `.display { line-height: 0.98 }` (`globals.css:245-249`): font Be Vietnam Pro có ascent ≈ 1.00em, descent ≈ 0.26em nên mực tiếng Việt vẽ ra ngoài line box 8,9px (font 76,8px) tới 11,6px (font 94,7px); (b) `.js .reveal.is-visible { clip-path: inset(0 0 0 0) }` (`globals.css:799-804`): mọi wrapper Reveal khi hiện đều clip về đúng border box — ở PageHero, đáy Reveal trùng đúng đáy h1 (đo được 469,8 = 469,77 trên /vi/blog/ desktop) → ~10,7px mực dưới baseline bị xén. Đính chính: hero trang chủ đo được là không bị cắt trên trang (đáy Reveal nằm 57px dưới đáy h1), nhưng h1 của nó vẫn tràn box riêng 13px/7px nên fix tầng chung đã bao luôn nó. Gạch chân nav: clearance trước sửa chỉ 1,0–1,8px (`.underline-sweep::after { bottom: -2px }`).

**Đã sửa (chỉ `src/app/globals.css`, dòng 1 `@import "./fonts.css"` nguyên vẹn):** ① `.display` + `.editorial-title`: thêm `padding-bottom: 0.15em` (chứa mực dưới baseline trong chính box heading, không đổi nhịp dòng, không đổi font/cỡ chữ). ② `.js .reveal.is-visible`: **bỏ `clip-path: inset(0 0 0 0)`**; chỉ giữ ở `.js .reveal[data-variant="mask"].is-visible` (mask chỉ bọc ảnh, không bọc chữ). ③ `.underline-sweep::after`: `bottom: -2px` → `bottom: -0.3em`. Không đụng `reveal.tsx` (chỉ thêm class), `parallax.tsx`, `page-hero.tsx`, `.prose-editorial h2` (lh 1,25, ổn), `SectionHeader` (tràn 3,5px nhưng không có ancestor nào clip — không sửa theo nguyên tắc "đừng vỡ heading đang ổn").

**Kiểm chứng (Playwright, `scrollHeight − clientHeight` của h1, 0 = mực nằm gọn trong box):**

| Trang | Desktop 1280 trước → sau | Mobile 390 trước → sau |
|---|---|---|
| home "Tên Của Bạn" | 13 → **0** | 7 → **0** |
| /vi/blog/ | 11 → **0** | 6 → **0** |
| /vi/contact/ | 10 → **0** | 5 → **0** |
| /vi/blog/category/technology/ | 11 → **0** | 6 → **0** |
| bài viết (editorial) | 9 → **0** | 4 → **0** |
| dự án / about | 10 / 11 → **0** | 6 / 6 → **0** |

- Ancestor clip h1: trước — `reveal is-visible clip=inset(0px)` ở mọi PageHero; sau — **không còn clipper nào** trên mọi h1, cả hai viewport.
- Tràn ngang 390px: `documentElement.scrollWidth == innerWidth` (390) ở mọi trang, trước và sau.
- Gạch chân `.underline-sweep`: clearance nhỏ nhất trước **1,0px** → sau **≥ 3,2px**.
- Ảnh padded trước/sau (trong `/tmp/livefix-evidence/` của worker): dấu dưới ậ/ạ/ệ từ "vệt mỏng" thành dấu tròn nguyên vẹn; mask reveal vẫn hoạt động.

## Danh sách file thay đổi (37 file, +1220/−42 so với `d5d9182`)

**Mới (8):** `src/lib/asset.ts`, `src/app/(public)/[locale]/projects/category/[slug]/page.tsx`, `tests/asset-base-path.test.ts`, `tests/live-fixes-filter.test.ts`, `tests/live-fixes-headings.test.ts`, `e2e/live-fixes-assets.spec.ts`, `e2e/live-fixes-filter.spec.ts`, `e2e/live-fixes-headings.spec.ts`.

**Sửa (29):** `next.config.ts`, `src/app/globals.css`, `src/app/manifest.ts`, `src/app/sitemap.ts`, `src/app/(public)/[locale]/layout.tsx`, `src/app/(public)/[locale]/page.tsx`, `src/app/(public)/[locale]/about/page.tsx`, `src/app/(public)/[locale]/art/page.tsx`, `src/app/(public)/[locale]/art/[slug]/page.tsx`, `src/app/(public)/[locale]/blog/page.tsx`, `src/app/(public)/[locale]/blog/[slug]/page.tsx`, `src/app/(public)/[locale]/blog/category/[slug]/page.tsx`, `src/app/(public)/[locale]/projects/page.tsx`, `src/app/(public)/[locale]/projects/[slug]/page.tsx`, `src/app/preview/[type]/[id]/page.tsx`, `src/app/(admin)/admin/(protected)/art/page.tsx`, `src/app/(admin)/admin/(protected)/art/collections/page.tsx`, `src/app/(admin)/admin/(protected)/media/page.tsx`, `src/app/(admin)/admin/(protected)/projects/page.tsx`, `src/components/admin/media-picker.tsx`, `src/components/blog/editorial-article.tsx`, `src/components/site/art-lightbox.tsx`, `src/components/site/article-card.tsx`, `src/components/site/artwork-card.tsx`, `src/components/site/language-switcher.tsx`, `src/components/site/project-card.tsx`, `src/lib/seo.ts`, `src/lib/utils.ts`, `tests/sitemap-robots.test.ts`.

## Việc còn mở (không chặn bàn giao, cần quyết riêng)

1. **Ô tìm kiếm `q` và lọc tag — cùng bệnh với lỗi 3, mức độ cao.** Form `method="get"` ở blog (`q` + select `tag`) và projects (`q` + `tech` + `sort`) submit tới `?q=…` nhưng bản tĩnh chỉ serve HTML chưa lọc → tìm kiếm không có tác dụng trên demo tĩnh. `?tag=` cũng vậy, và **không tồn tại route `/blog/tag/[slug]/`** để link tới như category. Sửa đúng cần search client-side hoặc route search riêng (nhúng toàn bộ dữ liệu) — vượt scope lần này.
2. **Link tag `?tag=` còn sót (cố tình để lại):** `blog/[slug]/page.tsx:261`, `editorial-article.tsx:194` vẫn trỏ `${blogHref}?tag=<slug>` — bấm vào ở bản tĩnh cũng rơi về list chưa lọc. Cần quyết: tạo trang tag như category, hoặc bỏ link tag ở export.
3. **Phân trang `?page=2+` cùng bệnh** (chỉ trang 1 được prerender) trên cả list và category page. Chưa lộ với seed (tối đa 5 bài/4 dự án, 9/trang) nhưng sẽ hỏng khi nội dung tăng.
4. **Ảnh markdown trong bài viết:** seed hiện không có ảnh markdown (`![...](/...)`) nên `src/lib/markdown.ts` không cần sửa; nếu sau này bài viết có ảnh markdown nội bộ thì cần prefix ở đó.
5. **Tên miền cũ còn sót trong 1 comment (có từ trước, không phải do lần sửa này):** 1 comment trong `.github/workflows/pages.yml:8` nhắc tên domain web cũ của Nguyen + các dòng nhắc tới nó trong `docs/PHASE_8_*`/`PHASE_9_*` (chỉ để ghi chú sự tồn tại của comment đó). Diff lần này: **0 chuỗi mới**. File workflow thuộc parent (không push được qua API).
6. **Kiểm chứng live trên điện thoại thật (390px) chưa làm được từ VM** (trình duyệt automation không đổi được viewport; headless Chrome bị egress proxy chặn). Tràn ngang 390px đã đo bằng Playwright trên bản export (scrollWidth == innerWidth ở mọi trang) — vẫn nên mở demo trên điện thoại thật sau khi deploy.

## Ghi chú môi trường / tích hợp

- **Hạ tầng đã sửa để làm việc:** lúc bắt đầu, Postgres (5432) và Prisma mirror (8765) đều chết — đã tạo lại user `postgres` uid/gid 1000 (mất sau restart VM) và sửa `/home/hatch` từ `2770` → `2771` (thêm o+x, nếu không user postgres không traverse được tới binary và EACCES). DB `portfolio` còn nguyên; mirror chạy lại ở 8765. Cả hai vẫn đang chạy.
- **Vitest:** suite mặc định tìm test DB ở cổng 5433 (`tests/setup.ts`); máy này Postgres chạy ở 5432 nên chạy mặc định sẽ fail 6 file/13 test với `Can't reach database server at 127.0.0.1:5433` (lỗi môi trường có từ trước, không liên quan sửa đổi). Chạy đúng: `TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/portfolio_test?schema=public' npx vitest run` → 214/214.
- **E2E:** spec headings cần `E2E_BASE_PATH=/Base-Porfolio-Website-Demo` khi chạy trên bản demo tĩnh (path `/vi/` sẽ resolve theo origin và rơi mất subpath — lần chạy đầu thiếu biến này nên 11 test 404 với `<h1>Error response</h1>`; không phải lỗi site). Spec assets/filter dùng `E2E_BASE_URL` gồm subpath. Chạy trên server build thì để trống `E2E_BASE_PATH`. Suite cũ cần server chạy với `APP_URL=http://127.0.0.1:3000` (không set sẽ fail 1 test smoke canonical vì fallback là `localhost:3000` — cũng là lỗi harness, không phải code).
- **Build tích hợp:** export build chạy trong bản copy riêng `~/workspace/base-portfolio-review/livefix-integration/` (tránh làm hỏng `.next` của repo-main), DB riêng `portfolio_integration`, script `~/workspace/base-portfolio-review/livefix-integration-build.sh`; serve kiểm chứng ở cổng 4190 (đã dừng sau khi xong). Các server scratch khác (4181, 4187, 3000) cũng đã dừng. `/tmp` là tmpfs 512M, lúc cao điểm từng đầy 100% vì nhiều worker cùng build — các bản build đã dời sang `~/workspace`.
- **Sai sót đã xử lý trung thực:** worker lỗi 1+2 vô tình kill nhầm server 4181 của worker lỗi 3 trong lúc chạy E2E/curl, đã khôi phục và chạy lại toàn bộ trên server riêng 4187 (11/11); worker lỗi 3 từng rsync sai làm bản build đầu ra 75 HTML thay vì 73, đã đồng bộ lại và build sạch lần 2. Số liệu trong báo cáo này đều lấy từ bản build tích hợp cuối, không phải các bản build lỗi đó.
