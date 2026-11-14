# Báo cáo Phase 8 — SEO Excellence, Performance & Discoverability

- **Repo:** NhatNguyenYn/Base-Porfolio-Website-Demo — main @ `be00cee` + working copy chưa commit (xem §K).
- **Ngày:** 2026-11-14. **Nỗ lực:** ULTRA — mọi khẳng định đều có bằng chứng chạy thật; mục nào không chạy được ghi BLOCKED kèm lý do, không bỏ qua lặng lẽ.
- **Phạm vi:** chỉ repo này. Không đụng hidaniel.io.vn / Dan Platform / SERENITY / ca-mini-game. Không commit, không push, không deploy, không đổi DB production, không dịch vụ trả phí.
- **Trạng thái cuối Phase 8: COMPLETED WITH WARNINGS** (xem §A — phần việc đã xong và đã kiểm chứng; còn lại là cảnh báo + quyết định của chủ dự án + kiểm chứng ngoài cần URL live).

Tài liệu này map các mục 8A–8J của master prompt vào các section A–K như sau: A = tổng kết & trạng thái; B = 8A Technical SEO; C = 8B Structured Data; D = 8C Content; E = 8D Social/Sharing; F = 8E Performance; G = 8F Accessibility; H = 8G Internal Linking & Discoverability; I = 8H Analytics; J = 8I bằng chứng kiểm chứng; K = 8J quyết định còn lại & rủi ro.

## A. Tổng kết & trạng thái

### Đã xong (có bằng chứng)
- Audit đầy đủ 8A–8G trên code + DB seed, sau đó implement toàn bộ mục MISSING/PARTIAL mà prompt cho phép (Wave 2a + 2b + tích hợp + final verification).
- Sitemap/robots/canonical/hreflang/JSON-LD đã kiểm chứng **live** trên cả 2 chế độ: server build (`next build` + `next start`) và static export (replicate đúng `.github/workflows/pages.yml`).
- Lighthouse đo thật lần đầu (trước đây BLOCKED vì không có Chrome): lab local, xem §F.
- 4 bug do coordinator phát hiện ở vòng final verification và đã sửa + verify lại (xem §J.4): lint warning focus-trap, hreflang home lệch canonical, export build gãy vì `manifest.ts`, export lặng lẽ rớt 16 trang (blog/projects list + 12 category) vì `generateMetadata` await `searchParams`.
- Không còn chuỗi `hidaniel` nào trong repo ngoại trừ 1 comment trong `.github/workflows/pages.yml:8` (file workflow thuộc parent, coordinator không sửa).

### Cảnh báo còn lại (không chặn Phase 8, cần chủ dự án / URL live)
1. Chưa verify Google Search Console, Rich Results, index thật (cần URL production + quyền chủ sở hữu).
2. Chưa có redirect mức hosting (HTTP→HTTPS, non-www→www) — thuộc hạ tầng deploy, chưa chốt backend/Vercel.
3. Ảnh OG/cover vẫn là SVG placeholder + fallback `/icon.png`; chưa có ảnh raster thật.
4. Blur placeholder cho ảnh chưa làm — cần migration DB (`Media.blurDataUrl`), xem POST_LAUNCH_BACKLOG.
5. Nội dung mỏng: project 66–180 từ, artwork 18–42 từ (xem §D).
6. Tag landing pages chưa có (chỉ có category landing pages).
7. Analytics chưa tích hợp (đúng chủ trương — chỉ đề xuất, xem §I).

### Số liệu kiểm chứng cuối (trên code cuối cùng)
| Kiểm tra | Kết quả |
|---|---|
| `npm run typecheck` | 0 lỗi |
| `npm run lint` (`--max-warnings=0`) | 0 warning, 0 lỗi |
| Vitest full | **22 file, 193/193 pass**, 0 skip |
| Server production build | exit 0, 69/69 static pages, 57 routes, 23 woff2 self-hosted |
| Pages export build (replicate `pages.yml`) | exit 0, `out/` 215 file, 7.4 MB, 67 trang HTML |
| E2E Playwright 1.65 + Chrome for Testing 158 | **49/49 pass, 0 skip** |
| Lighthouse 13.6.0 (lab, localhost) | home mobile 63 / desktop 98; article mobile 65; project mobile 75; a11y/BP/SEO 100 mọi trang (xem §F) |
| Live server checks | 14 URL 200, 3 URL 404 đúng, sitemap 62 `<url>`, robots Host/Sitemap đúng |
| Seed DB (`portfolio`) | 4 projects, 8 artworks, 5 articles (1 editorial), 3 collections, 8 categories, 1 user, 3 messages |

## B. 8A — Technical SEO

### DONE
- **APP_URL production guard:** `scripts/preflight.mjs` báo lỗi khi `APP_URL` là localhost/`127.0.0.1`/`::1`/`*.localhost` ở production. Lưu ý: `npm run build` không tự gọi preflight — việc nối preflight vào pipeline deploy còn mở (ghi trong backlog).
- **Sitemap:** `x-default` cho cả static lẫn detail entries; loại SVG khỏi sitemap images; category landing pages (`/{locale}/blog/category/{slug}`) đã có entries — chỉ category có ≥1 bài published (5/6 category; `technology` có 0 bài nên không advertise nhưng trang vẫn render 200); `lastModified` của category = bài mới nhất trong category. Kiểm chứng live: sitemap server 62 `<url>`, export sitemap có đủ 5 category URL kèm trailing slash.
- **Robots:** `host` = bare hostname (không còn full URL); giữ `Disallow: /media/` — có căn cứ: route `/media/` serve mọi object theo key, không kiểm tra quyền/visibility, `Media` không có cột visibility.
- **Bare-path redirect:** middleware redirect 307/308 bare path (`/about`) → `/vi/about`, giữ query string. Kiểm chứng live: `/` → 307 `/vi`; `/vi/` → 308 `/vi` (chuẩn Next `trailingSlash: false`).
- **Canonical:** helper riêng cho Pages export (trailing slash chỉ khi `PAGES_EXPORT=1`); filtered/pagination metadata: `?q=` → `noindex,follow`, canonical theo view, link prev/next. Kiểm chứng live: home canonical = hreflang vi/en/x-default (xem §J.4 vụ lệch slash đã sửa).
- **404 noindex** qua metadata (đã verify bằng test; kiểm chứng live: bogus URL → 404 đúng).
- **`generateViewport` + `src/app/manifest.ts` mới** (xem §J.4 — manifest từng làm gãy export build, đã sửa).
- **Breadcrumbs** trên list pages; language switcher dùng thẻ `<a href>` thật.

### PARTIAL / còn mở
- **8A-16 hosting redirect (HTTP→HTTPS, host canonical):** cần cấu hình ở tầng hosting/deploy — chưa làm được khi backend/Vercel chưa chốt. → Owner decision.
- **`<title>` list pages:** đã chuyển sang dùng enriched `dict.*.title` thay cho `label` chung chung ("Writing"/"Work"/"Contact") — kiểm chứng live trên export: `<title>Ghi chép &amp; chia sẻ về thiết kế, kỹ thuật và sáng tạo — Portfolio Studio</title>`.
- **Manifest trong export:** `manifest.ts` ban đầu không có `export const dynamic`, làm export build fail — đã thêm theo đúng convention của `sitemap.ts`/`robots.ts` (xem §J.4).

## C. 8B — Structured Data (`src/lib/json-ld.ts` — KHÔNG thay bằng `JSON.stringify` thô)

### DONE
- **CreativeWork:** project có technologies + `dateModified`; art có `dateModified` từ `artwork.updatedAt` (query đã trả `updatedAt`, page đã gắn `dateModified: artwork.updatedAt.toISOString()` — kiểm chứng live: art page có `"dateModified":"2026-11-13T21:49:53.319Z"`).
- **Listing schemas:** `Blog` + `ItemList` (blog list), `CollectionPage` + `ItemList` (art collections + category pages).
- **Author `@id` linkage:** article author link tới `Person @id`.
- **`SearchAction`:** đã thêm.
- **Publisher logo fallback:** `/icon.png` khi seed `logoMediaId` rỗng.
- **OG dims + Twitter:** đã bổ sung; `twitter:site/creator` theo cơ chế derive từ socials (null khi không có — không bịa handle).
- **SVG fallback:** đã verify bằng test (ảnh SVG không đưa vào sitemap images / OG).
- Kiểm chứng live: home + 1 article (`BlogPosting`) + 1 project đều có `application/ld+json`; E2E SEO spot-checks pass.

### Còn mở
- **8B-12 Rich Results validation:** cần URL live + Google Rich Results Test — BLOCKED tới khi deploy (không fake kết quả).
- **Publisher logo thật:** hiện fallback `/icon.png`; logo raster thật thuộc về chủ dự án.

## D. 8C — Content

### DONE
- **H1 duy nhất:** Markdown `h1` trong body được demote → `h2` trước khi gán heading id/TOC (code fence không bị đụng); `h1` removed khỏi sanitize allow-list. Test `tests/article-template.test.ts` 11/11 pass.
- **Byline:** tên tác giả link tới `/{locale}/about` (cả default lẫn editorial: header/sidebar/footer card) + ngày `Updated:` kèm `<time dateTime>`.
- **List titles/descriptions giàu hơn:** blog/projects/art/contact trong `en.ts`/`vi.ts` (vd: blog "Notes & essays on design, engineering and making"); `<title>` đã dùng enriched title (xem §B). About không có key `description` (meta description lấy từ profile `shortBio`) — giữ nguyên.
- **Seed SEO riêng biệt:** cả 10 bản dịch article đều có `seoTitle ≠ title`, `seoDescription ≠ excerpt` (verify trên scratch DB, đã drop). Profile SEO cũng riêng biệt.
- **Editorial template:** đúng 1 bài seed là editorial — `design-systems-start-before-components` (verify: `editorial count = 1` sau re-seed).
- **Alt ảnh theo locale:** seed lưu `alt: ""` (21 media rows, 0 alt non-empty) vì `Media.alt` là chuỗi đơn-locale, còn fallback render (`cover.alt || article.title`…) mới đúng theo locale.
- **Truncation:** art description dùng `truncate()` (không còn cắt giữa từ).
- **Placeholder links:** 5 social URL → `url: ""` + `visible: false` (không render); 4 project `githubUrl`/`demoUrl` → `null`. Không còn URL `example.com` nào trong seed (chỉ còn email).

### REPORT-ONLY (không rewrite body — quyết định của chủ dự án)
Đếm từ trên nội dung seed (`content.split(/\s+/)`):

| Loại | Phạm vi từ | Mỏng nhất |
|---|---|---|
| Articles (5 × 2 locale) | 178–343 | `a-day-of-deep-work` en 178 |
| Projects `fullDescription` | 66–180 | `signal-api` en 66 |
| Artworks `description` | 18–42 | `field-notes-ochre` en 18 |

Articles đủ dài dạng essay; **cần mở rộng trước: project write-ups (`signal-api`, `lantern-notes`) và artwork descriptions**. Không rewrite trong Phase 8 — chờ chủ dự án duyệt hướng mở rộng (xem POST_LAUNCH_BACKLOG).

## E. 8D — Social / Sharing

### DONE
- `twitter:site/creator` theo cơ chế (không bịa).
- ShareBar dùng canonical URL (prop `canonicalUrl`) trên project/art/blog detail, không còn `window.location.href`.
- Seed socials + project URL placeholder đã dọn (xem §D).

### Còn mở
- ShareBar chỉ có trên article detail (mở rộng sang project/art là ý tưởng backlog, không phải bug).
- Ảnh OG thật (raster) chưa có — dùng SVG cover + fallback `/icon.png`.

## F. 8E — Performance (đo thật bằng Lighthouse 13.6.0)

Trước Phase 8, Lighthouse BLOCKED (không có Chrome trên VM). Trong final verification, Chrome for Testing 158 đã có (do Wave 3 E2E tải về) nên đã đo được — lab trên localhost, KHÔNG phải Core Web Vitals thực tế.

### Kết quả lab (server build local, `http://127.0.0.1:3000`)
| Trang | Perf | A11y | Best practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|
| Home mobile (Moto G Power throttle) | **63** | 100 | 100 | 100 | 3.9s | 0 | 1390ms |
| Article mobile | **65** | 100 | 100 | 100 | 3.5s | 0 | 1450ms |
| Project mobile | **75** | 100 | 100 | 100 | 3.3s | 0 | 700ms |
| Home desktop | **98** | 100 | 100 | 100 | 0.9s | 0 | 110ms |

INP không đo được trong lab run (Lighthouse không có tương tác thật — ghi rõ, không bịa số).

### Đọc kết quả
- **Desktop tốt (98). Mobile yếu (63–75)** — chủ yếu do TBT cao (JS main-thread 3.7s, JS execution 1.3s ở home mobile) + LCP 3.3–3.9s dưới throttle di động.
- **Cơ hội lớn nhất:** "Avoid multiple page redirects — tiết kiệm ~610ms": chuỗi `/` → 307 `/vi` → 308 `/vi` (trailing-slash redirect). Đây là hệ quả của Next `trailingSlash: false` ở server mode trong khi Pages export dùng `trailingSlash: true` — 2 chế độ không thống nhất dạng URL. Ghi vào backlog (cần quyết định canonical slash thống nhất trước khi tối ưu sâu).
- **CLS = 0 mọi trang** — tốt.
- **A11y/BP/SEO = 100 mọi trang** trong lab.

### DONE (implementation)
- `Reveal` giữ `priority`, bỏ `getBoundingClientRect()` on mount; scroll listeners (header/back-to-top) qua rAF-gate; lightbox tách bằng `next/dynamic` (`ssr: false`); Parallax tôn trọng reduced-motion thay đổi; hover chỉ `@media (hover: hover)`; `content-visibility` chỉ cho article/project cards; `priority` cho PageHero h1, editorial cover, project thumbnail, art-detail.
- **Fonts (8E.5):** `next/font/google` từng làm CI fail (`TypeError: Cannot read properties of null (reading '1')` khi parse Google Fonts CSS — xem Phase 9 baseline). Parent đã chuyển sang **self-hosted**: 23 file `.woff2` (Be Vietnam Pro + Lora, đủ subsets latin/latin-ext/vietnamese…), `@font-face` trong `src/app/fonts.css`, `@import` ở `src/app/globals.css:1`, 0 import `next/font/google` còn lại. Build emit đủ 23 woff2 vào `.next/static/media`. Zero visual change theo thiết kế.
- **Images:** AVIF/WebP + `sizes` OK; Pages export serve ảnh gốc unoptimized (giới hạn của static export). **Blur placeholder CHƯA làm** — cần migration DB (`Media.blurDataUrl` + generate lúc upload bằng sharp + backfill) → backlog.
- **Bundle:** không có lib nặng; lightbox là ứng viên split duy nhất và đã split; 0 `next/dynamic` trước Phase 8 → nay có.
- **LCP:** hero có `priority` đúng; `AnimatedHeadline` vẫn delay paint một phần; mọi route vẫn `force-dynamic` (không cache) — chấp nhận được cho CMS, ghi chú trong backlog nếu muốn cache layer sau này.

## G. 8F — Accessibility

### DONE
- Lang/skip-link/landmarks/nav labels có sẵn và giữ nguyên.
- About item titles → `h3`; `LevelDots` có `role="img"`; blog featured trùng h2/h3 đã sửa (h2 → p); 18 label trong `profile-sections` có `htmlFor` + id tương ứng; 1 stretched link/card (ArtworkCard đã đúng).
- Focus trap + Escape + focus return cho lightbox và mobile menu; focus ring alpha 14% → 30%.
- Media picker dùng shared `useFocusTrap`; `LocaleTabs` có điều hướng phím mũi tên (ArrowLeft/Right/Home/End, roving tabIndex) — giữ tab roles theo WAI-ARIA thay vì drop roles.
- Lighthouse a11y = 100 (home/article/project, cả mobile lẫn desktop) — lab, không thay cho kiểm tra thủ công bằng bàn phím/screen reader (xem checklist real-world).

### Còn mở
- Focus trap cho media-picker đã làm; LocaleTabs đã làm. Chưa có axe run tự động (không có wiring) — Lighthouse a11y 100 là tín hiệu hiện có, không khẳng định thay axe.
- Kiểm tra bàn phím/screen reader thật thuộc real-world checklist.

## H. 8G — Internal Linking & Discoverability

### DONE
- **Related projects:** `getRelatedProjects` (cùng category trước, rồi khác, tối đa 3, loại chính nó) + section trên project detail + test. **DB-side pagination** cho `listProjects` (filter category/status/tech + count + take/skip qua Prisma; facets qua aggregation). Caveat đã ghi trong code: `q` (diacritic-folded search — Postgres không có extension `unaccent`) và sort `title` (Prisma không `orderBy` được trên relation translations) vẫn load sort keys rồi xử lý trong bộ nhớ — không load full rows.
- **Category landing pages (mới):** route `/{locale}/blog/category/[slug]/` — `generateMetadata` riêng, breadcrumbs, `PageHero`, grid + `Pagination`, JSON-LD `CollectionPage` + `ItemList`. Sitemap đã bổ sung (xem §B). Không làm tag pages (backlog).
- **Broken-link test mới:** `tests/broken-links.test.ts` 6/6 pass — rebuild mọi href từ live queries, resolve qua route table, assert 0 broken; assert slug private/draft/unpublished không bao giờ được link; assert link trong Markdown resolve.
- Language switcher dùng anchor thật; breadcrumbs đã có.

### Bug phát hiện ở final verification (đã sửa)
- Category + blog/projects list **lặng lẽ biến mất khỏi static export** (xem §J.4): `generateMetadata` await `searchParams` làm route opt-out khỏi static generation. Đã sửa bằng guard `PAGES_EXPORT` ở 3 file; export hiện có đủ 16 trang (53 → 69 routes trong prerender manifest, 51 → 67 file HTML).

## I. 8H — Analytics

- **Không tích hợp analytics nào trong Phase 8** — đúng chủ trương: không tài khoản mới, không tracking ID giả, không script bên thứ ba, không cookie phân tích.
- `docs/ANALYTICS_PROPOSAL.md` đã bao quát đầy đủ 8H (hiện trạng, 6 event tối thiểu không định danh, cách đo `article_complete`, 6 quyết định cần duyệt: provider, consent, retention, IP, mục tiêu, chủ tài khoản) — **không cần cập nhật thêm**.
- `viewCount` nội bộ trong Postgres không phải analytics người dùng và không gửi dữ liệu ra ngoài.

## J. 8I — Bằng chứng kiểm chứng (tổng hợp)

### J.1 Lệnh & số liệu cuối (code cuối cùng, 2026-11-14)
- `npm run typecheck`: 0 lỗi. `npm run lint`: 0 warning / 0 lỗi.
- Vitest full: 22 file, **193/193 pass**.
- Server build: exit 0, "Compiled successfully" ~24s, 69/69 static pages, 57 routes.
- Export build (replicate `pages.yml` đúng từng bước staging + sed): exit 0, `out/` 215 file / 7.4 MB / 67 HTML.
- E2E: Playwright 1.65.0 + Chrome for Testing 158.0.8127.18, **49/49 pass, 0 skip**.
- Lighthouse 13.6.0: xem §F.
- Live server (`next start` :3000): `/` 307→`/vi`; `/vi/` 308→`/vi` (final 200); detail pages 200; `/vi/blog/bogus-slug`, `/bogus`, `/vi/bogus` → 404 đúng; sitemap 62 `<url>`; robots `Host` + `Sitemap` đúng.
- Live export (serve `out/` qua basePath): 17 URL 200 với nội dung thật (đã check `<title>` từng trang, không phải directory listing).

### J.2 Môi trường kiểm chứng
Node 24.22.1, Next 15.5.29, Prisma 6.19.3, PostgreSQL 18 embedded tại `127.0.0.1:5432` (DB `portfolio` + `portfolio_test`), Prisma engines mirror local `http://127.0.0.1:8811`. Playwright Chromium không tải được (proxy trả 400 cho `cdn.playwright.dev`) — dùng Chrome for Testing từ `storage.googleapis.com`, binary tại `~/chrome-for-testing/chrome-linux64/chrome`. Chrome/Edge/Firefox/Safari/iOS không có trên VM — không chạy, không claim.

### J.3 Các mục BLOCKED (ghi rõ, không bỏ qua)
- `npm audit`: BLOCKED — registry trả 403 (policy). Claim "5 advisories" của Phase 5 chưa verify được.
- Google indexing / CWV thực tế / Rich Results / Search Console: BLOCKED tới khi có URL production + quyền chủ sở hữu.
- Cross-browser ngoài Chromium: BLOCKED (không có browser khác trên VM).
- Axe run: chưa chạy (không có wiring).

### J.4 Bug phát hiện & sửa ở vòng final verification (coordinator)
1. **Lint warning `focus-trap.ts:66`** (`react-hooks/exhaustive-deps`, `options?.onEscape` thiếu trong deps) — lint fail vì `--max-warnings=0`. Sửa bằng latest-ref pattern: sync `onEscape` vào ref ở effect riêng, trap effect không còn phụ thuộc identity của callback inline. Verify: lint 0, typecheck 0.
2. **Hreflang home lệch canonical (server mode):** canonical `/vi` nhưng hreflang `/vi/` (redirect 308). Nguyên nhân: `languageAlternates()` không xử lý riêng path `/` như `canonicalPath()` đã làm. Sửa 1 dòng trong `src/lib/seo.ts` + thêm test + sửa expectation cũ trong `tests/sitemap-robots.test.ts`. Verify live: canonical = hreflang = `/vi`; export mode vẫn `/vi/` (do `canonicalAbsoluteUrl` thêm slash lại).
3. **Export build gãy vì `manifest.ts` mới (Wave 2a):** file không có `export const dynamic`, workflow sed không rewrite được → Next báo `force-static/revalidate not configured on route /manifest.webmanifest`, build exit 1. Sửa: thêm `export const dynamic = "force-dynamic"` + comment theo đúng convention của `sitemap.ts`/`robots.ts`.
4. **Export lặng lẽ rớt 16 trang:** blog/projects list (vi/en) + toàn bộ 12 category pages không có trong `out/` và prerender manifest (53 routes) dù build exit 0 và route table vẫn liệt kê chúng. Nguyên nhân: `generateMetadata` của 3 trang await `searchParams` (thêm ở Wave 2a/2b) — route opt-out khỏi static generation mà không báo lỗi. Sửa: guard `PAGES_EXPORT === "1" ? {} : await searchParams` trong 3 `generateMetadata` (server mode giữ nguyên metadata theo view). Verify: export rebuild → 69 routes, 67 HTML, đủ 16 trang, nội dung thật.
5. **Hạ tầng kiểm chứng chết giữa chừng:** Postgres + Prisma mirror (background từ session infra) đã tắt; user/group hệ thống `postgres` (uid/gid 1000) cũng không còn. Đã khởi động lại: tạo lại user/group `postgres` 1000:1000, launcher persistent mới `~/workspace/base-portfolio-review/dev-db-root.mjs` (bản cũ ở `/tmp` đã mất; bản mới dùng `createRequire` vì ESM import không resolve từ ngoài repo), mirror 8811 chạy lại. DB nguyên vẹn (đã verify counts).

### J.5 Các mục đã sửa từ Wave 3 E2E (để đối chiếu)
- Mobile horizontal overflow 130px @390 / 145px @375 (`.card-cv` `contain-intrinsic-size: auto 500px`) — sửa bằng `contain-intrinsic-width: 0`.
- Project detail overflow 33px @390 / 48px @375 (grid `auto` track + `<pre>` 403px) — sửa bằng `min-w-0` ở cả 2 grid children (project + blog detail).
- Cả 2 đã verify fix bằng re-run E2E 49/49.

## K. 8J — Quyết định cần chủ dự án + rủi ro còn lại

### Quyết định của chủ dự án (chưa có)
1. **Backend/Postgres cho full-stack deploy (Vercel?)** — vẫn chưa chốt từ 2026-11-12; mọi redirect mức hosting + Search Console đều chờ quyết định này.
2. **Rotate mật khẩu admin mặc định** (High — xem Phase 9 baseline): giá trị default là literal trong repo public. Local test DB đã reset về default để verify login (xem Phase 9 report) — production PHẢI rotate trước go-live.
3. **CSP enforce** (hiện chỉ Report-Only) + **origin check cho ~30 Server Actions** + **rate limit cho public GET APIs**.
4. **Search Console + Rich Results validation** sau khi deploy production.
5. **Ảnh OG/cover raster thật** thay SVG placeholder + fallback icon.
6. **Blur placeholder:** duyệt migration `Media.blurDataUrl` (sharp lúc upload + backfill) hay để backlog.
7. **Mở rộng nội dung mỏng** (project/artwork) hay chấp nhận độ dài hiện tại.
8. **Tag landing pages:** làm hay không (category đã có).
9. **Analytics:** provider (tự host Plausible/Umami hay SaaS), consent, retention 12 tháng, IP handling — theo `docs/ANALYTICS_PROPOSAL.md` §4.
10. **Thống nhất trailing slash canonical** giữa server mode (`/vi`) và Pages export (`/vi/`) — Lighthouse ghi nhận redirect chain tốn ~610ms lab.

### Rủi ro còn lại
- **Export build lặng lẽ rớt trang:** Next không báo lỗi khi `generateMetadata` await `searchParams` làm mất trang khỏi export — rủi ro tái phát mỗi khi ai đó thêm `searchParams` vào metadata. Giảm thiểu: checklist release phải đếm HTML trong `out/` (nay đã có trong Phase 9 report), và comment cảnh báo đã ghi trong code.
- **Mobile perf lab 63–75:** cần tối ưu JS main-thread trước khi coi mobile là xong; số lab không phải CWV thực tế.
- **Nội dung seed là placeholder** (tên, email `example.com`, ảnh SVG) — demo được, production cần thay bằng nội dung thật trước khi công bố.
- **`.artifacts/*.png` còn tracked trong git** (10 file) — chờ chủ duyệt xóa.
- **CI vẫn đỏ trên main** (font loader — parent đang xử lý riêng bằng self-hosted fonts; PR #2 Postgres service là chưa đủ). Không thuộc Phase 8 nhưng ảnh hưởng deploy.
- **File workflow `.github/workflows/pages.yml:8`** còn 1 chuỗi `hidaniel` trong comment — parent sửa qua browser (coordinator không đụng workflow).

### File thay đổi (Phase 8, tóm tắt theo nhóm — danh sách đầy đủ trong Phase 9 Final Release Validation)
- SEO core: `src/lib/seo.ts`, `src/lib/structured-data.ts`, `src/lib/json-ld.ts` (giữ nguyên cơ chế), `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/manifest.ts` (mới), `src/app/(public)/[locale]/**/page.tsx` (metadata/canonical/breadcrumbs), `src/middleware.ts`, `scripts/preflight.mjs`.
- Content/editorial: `src/lib/markdown.ts`, `prisma/seed.ts`, `src/app/(public)/[locale]/blog/category/[slug]/page.tsx` (mới), `src/components/blog/editorial-article.tsx`, `src/i18n/messages/en.ts` + `vi.ts`.
- Performance/a11y: `src/components/ui/reveal.tsx`, `src/components/site/art-lightbox.tsx` (mới), `src/lib/focus-trap.ts` (mới), `src/components/site/page-hero.tsx`, `src/components/site/back-to-top.tsx`, `src/components/ui/parallax.tsx`, `src/app/globals.css`, `src/app/fonts.*` (parent).
- Tests: `tests/seo-metadata.test.ts`, `tests/sitemap-robots.test.ts`, `tests/structured-data.test.ts`, `tests/routing-seo.test.ts`, `tests/article-template.test.ts`, `tests/broken-links.test.ts` (mới).
