# Phase 9 — Final Release Validation

- **Repo:** NhatNguyenYn/Base-Porfolio-Website-Demo — main @ `be00cee` + working copy chưa commit.
- **Ngày:** 2026-11-14. **Nỗ lực:** ULTRA.
- **Trạng thái cuối Phase 9: BUILD COMPLETE — READY FOR REAL-WORLD TESTING.**
- Baseline đối chiếu: `docs/PHASE_9_BASELINE.md`. Báo cáo Phase 8: `docs/PHASE_8_SEO_PERFORMANCE_REPORT.md`. Checklist test thật: `docs/REAL_WORLD_TEST_CHECKLIST.md`. Backlog: `docs/POST_LAUNCH_BACKLOG.md`.

"Ready for real-world testing" nghĩa là: build đã hoàn chỉnh và đã kiểm chứng bằng máy ở mọi tầng có thể chạy local; bước tiếp theo là con người test thật + deploy production theo checklist. Hai cổng production (rotate mật khẩu admin mặc định, quyết định CSP) vẫn phải xong trước khi mở traffic thật — xem §7.

## 1. Kết quả kiểm chứng cuối (code cuối cùng, 2026-11-14)

| Tầng | Lệnh / cách chạy | Kết quả |
|---|---|---|
| Typecheck | `npm run typecheck` | **0 lỗi** |
| Lint | `npm run lint` (`--max-warnings=0`) | **0 warning, 0 lỗi** |
| Unit/integration (vitest) | `TEST_DATABASE_URL=…/portfolio_test npx vitest run` | **22 file, 193/193 pass, 0 skip** |
| Server production build | `rm -rf .next && npm run build` (prisma generate + migrate deploy + next build) | **exit 0**, "Compiled successfully" ~24s, **69/69 static pages**, 57 routes, 23 woff2 emit |
| Pages export build | replicate đúng `.github/workflows/pages.yml` (staging + sed + `PAGES_EXPORT=1`) | **exit 0**, `out/` **215 file / 7.4 MB / 67 HTML** |
| E2E | Playwright 1.65.0 + Chrome for Testing 158.0.8127.18, `npx playwright test --config e2e/playwright.config.ts` | **49/49 pass, 0 skip, 0 fail** |
| Lighthouse (lab) | Lighthouse 13.6.0, Chrome 158, server local | home mobile 63 / desktop 98; article mobile 65; project mobile 75; a11y/BP/SEO 100 mọi trang |
| Live server checks | curl `next start` :3000 | 14 URL 200, 3 URL 404 đúng, sitemap 62 `<url>`, robots đúng |
| Live export checks | serve `out/` qua basePath `/Base-Porfolio-Website-Demo` | 17 URL 200 với nội dung thật (đã check `<title>`) |

Số liệu trên là của **code cuối cùng** (sau mọi fix ở §4–§5). Không claim PASS cho mục nào chưa chạy.

## 2. Những gì đã sửa trong Phase 9 (bug/security/data/routing/responsive/a11y/perf/build)

### 2.1 Security fixes (Wave 2a, 11/11 mục)
- Rate-limit prune chạy thật mỗi lần gọi (kèm test); dummy bcrypt compare khi email không tồn tại (chống timing oracle); login redirect qua `safeInternalPath`; key rate-limit lowercase theo email; session IP qua `clientIp()` trusted-hop; preflight **exit 1** khi mật khẩu seed mặc định còn ở production (không rotate giá trị, không đổi DB); rate limit cho setup (10/10 phút/IP), change-password (5/10 phút/user), upload Server Action (60/giờ/user); setup TOCTOU xử lý P2002; audit log cho login/setup thất bại (không log password/token); revoke các session khác khi login.
- Test mới `tests/security-phase9d-actions.test.ts` (13 test). Targeted vitest 37/37 pass lúc đó; full suite sau cùng 193/193.

### 2.2 Performance & accessibility fixes (Wave 2a, 14/15)
- `src/components/site/art-lightbox.tsx` (mới) + `src/lib/focus-trap.ts` (mới); lightbox tách bằng `next/dynamic` (`ssr: false`); `Reveal` giữ `priority`, bỏ `getBoundingClientRect()`; scroll listeners qua rAF-gate; Parallax theo reduced-motion; hover gate `@media (hover: hover)`; `content-visibility` chỉ cho article/project cards; focus ring 14% → 30%; About h3; `LevelDots role="img"`; sửa trùng h2 blog; 18 label `htmlFor`; 1 stretched link/card; focus trap + Escape + focus return cho lightbox/mobile menu/media-picker; `LocaleTabs` arrow-key navigation.
- **Chưa làm:** `placeholder="blur"` — cần migration DB (`Media.blurDataUrl`, generate lúc upload bằng sharp + backfill) → backlog.

### 2.3 SEO/content/linking (Wave 2a + 2b — chi tiết trong Phase 8 report)
24 mục SEO core + 15/15 mục editorial/content/linking, gồm: sitemap `x-default` + category entries, robots host bare, bare-path redirect, canonical/trailing-slash, filtered/pagination metadata, JSON-LD (CreativeWork/Listing/SearchAction/author `@id`), H1 demotion, byline + updated date, seed SEO riêng biệt, 1 editorial article, alt locale-aware, dọn placeholder links, related projects + DB-side pagination, category landing pages, broken-link tests.

### 2.4 E2E suite mới (Wave 3)
- `e2e/` (mới): `playwright.config.ts`, `helpers.ts`, `smoke.spec.ts`, `responsive.spec.ts`, `admin.spec.ts`, `admin.setup.ts`, `temp-admin.mjs`.
- `@playwright/test ^1.65.0` thêm vào `devDependencies` (minimal addition, không đổi kiến trúc).
- **Lưu ý chạy suite:** phải dùng `--config e2e/playwright.config.ts` (config nằm trong `e2e/`, không ở root). Chạy `npx playwright test` trần sẽ dùng default config và cố chạy cả `tests/*.test.ts` của vitest → lỗi import. Đã ghi chú trong `e2e/playwright.config.ts`.

## 3. E2E chi tiết (49/49 pass)

| Nhóm | Pass | Nội dung |
|---|---|---|
| Smoke | 24 (+1 setup) | Public pages vi/en (home, about, projects list + detail, art list + detail, collection, blog list + article, category, contact); `/` → `/vi`; bare `/blog/<slug>` → `/vi/blog/<slug>`; locale switcher giữ nguyên trang; contact submit → 1 row `ContactMessage` (đã xóa sau test; Server Action chỉ lưu DB, không có code SMTP); SEO live (title/canonical/hreflang/JSON-LD `BlogPosting`); sitemap/robots; 404 (bogus URL + bogus slug) |
| Responsive | 14 | 7 viewport (1920/1440/1366/1024/768/390/375) × 2 trang (home + project detail), không overflow sau fix |
| Admin | 9 | Sai mật khẩu → alert; login → dashboard + cookie `ps_session` (Secure cookie chạy được trên http loopback); tạo draft editorial → public 404 khi chưa auth → authed `/preview/article/<id>` 200 → publish → render `prose-editorial` → soft-delete → public 404 → logout → `/admin/login`; preview khi logged-out redirect về login |
| Editorial (smoke) | 1 | Bài editorial seed render đúng markup editorial (từng skip ở lần chạy đầu vì DB chưa re-seed; pass sau re-seed) |

**Browser coverage (trung thực):** chỉ Chromium (Chrome for Testing 158). Chrome/Edge/Firefox/Safari/iOS không có trên VM — không chạy, không claim. Playwright `install chromium` fail 2 lần (proxy trả 400 cho `cdn.playwright.dev`); workaround tải Chrome for Testing từ `storage.googleapis.com`, binary giữ tại `~/chrome-for-testing/chrome-linux64/chrome`. `/tmp` là tmpfs 512 MB (từng đầy 100% làm truncate download) — nay còn trống 492 MB.

## 4. Bug tìm thấy trong Phase 9 (đều đã sửa + verify lại)

### 4.1 Từ Wave 3 E2E (2 bug responsive thật)
1. **Overflow ngang 130px @390 / 145px @375** (home + project detail, mọi `.card-cv` grid). Nguyên nhân: `globals.css` `.card-cv { content-visibility: auto; contain-intrinsic-size: auto 500px; }` — card off-screen lấy placeholder width 500px, grid 1 cột mobile sizing theo đó. Fix: thêm `contain-intrinsic-width: 0` (giữ height estimate 500px cho scrollbar).
2. **Project detail vẫn overflow 33px @390 / 48px @375** sau fix 1. Nguyên nhân: grid `gap-12 lg:grid-cols-12` là 1 implicit `auto` track dưới `lg`; khối `<pre>` (~403px min-content) ép track rộng 403.234px. Fix: `min-w-0` cho cả 2 grid children (project + blog detail — cùng pattern).
- Verify: re-run E2E 49/49 (responsive 14/14).

### 4.2 Từ final verification của coordinator (4 bug)
1. **Lint warning `src/lib/focus-trap.ts:66`** (Wave 2a để lại): `exhaustive-deps` thiếu `options?.onEscape`; lint fail do `--max-warnings=0`. Fix: sync `onEscape` vào ref ở effect riêng (không phụ thuộc identity của callback inline — thêm vào deps sẽ re-run trap và cướp focus mỗi render). Verify: lint 0, typecheck 0.
2. **Hreflang home lệch canonical (server mode):** canonical `/vi`, hreflang `/vi/` (URL redirect 308). Nguyên nhân: `languageAlternates()` không xử lý riêng path `/` như `canonicalPath()`. Fix 1 dòng `src/lib/seo.ts` + test mới + sửa expectation cũ trong `tests/sitemap-robots.test.ts`. Verify live: canonical = hreflang = `/vi`; export mode vẫn `/vi/` đúng.
3. **Export build gãy vì `manifest.ts` (Wave 2a thêm mới, chưa từng chạy export):** file không có `export const dynamic` nên workflow sed không rewrite được → Next lỗi `force-static/revalidate not configured on route /manifest.webmanifest`, build exit 1. Fix: thêm `export const dynamic = "force-dynamic"` + comment theo convention `sitemap.ts`/`robots.ts`.
4. **Export lặng lẽ rớt 16 trang (nghiêm trọng nhất):** blog/projects list (vi/en) + toàn bộ 12 category pages không có trong `out/` và prerender manifest (53 routes) dù build exit 0 và route table vẫn liệt kê chúng. Nguyên nhân: `generateMetadata` của 3 trang await `searchParams` (Wave 2a thêm cho blog/projects, Wave 2b cho category) — route opt-out khỏi static generation mà **không báo lỗi**. Fix: guard `PAGES_EXPORT === "1" ? {} : await searchParams` trong 3 `generateMetadata` (server mode giữ nguyên metadata theo view). Verify: export rebuild → 69 routes, 67 HTML, đủ 16 trang, nội dung thật (đã check `<title>` từng trang; trước đó `/vi/blog/` 200 chỉ là directory listing của python http.server, không phải trang thật).

### 4.3 Vấn đề dữ liệu local (đã xử lý)
- **Mật khẩu admin seed không khớp:** hash trong DB `portfolio` không khớp literal default trong `scripts/preflight.mjs:16` cũng không khớp các mật khẩu test — vì lần seed đầu dùng mật khẩu khác, đã bị redact trong `BASELINE-2026-11-14.md` (chỉ ghi `SEED_ADMIN_PASSWORD=<redacted>`). Login as `admin@example.com` từng BLOCKED ở Wave 3. **Xử lý:** reset mật khẩu admin của **DB scratch local** về đúng default đã document (`ChangeMe!2026`) bằng script 1 lần ở `/tmp` (đã xóa sau khi chạy), verify `bcrypt.compare = true`. Sau đó login as seeded admin **PASS** (dashboard `/admin`, Playwright script 1 lần). Ghi rõ: đây KHÔNG phải mật khẩu production — production phải rotate (High finding, §7).
- **Seed drift (template):** DB seed trước Wave 2b nên cả 5 article đều `template=default` dù seed code đã có editorial. Code upsert ĐÃ update `template` (không phải bug seed) — chỉ cần re-seed. Đã re-seed DB `portfolio`: editorial = 1 (`design-systems-start-before-components`), counts còn lại nguyên vẹn (4 projects, 8 artworks, 5 articles, 3 messages, 1 user, 0 sessions). E2E editorial check từ skip → pass.
- **Hạ tầng kiểm chứng chết giữa chừng:** Postgres + Prisma mirror (background từ session infra) đã tắt; user/group hệ thống `postgres` (uid/gid 1000) cũng không còn (file `.pgdata` còn, owned 1000:1000). Đã khởi động lại: tạo lại user/group `postgres` 1000:1000, launcher persistent mới `~/workspace/base-portfolio-review/dev-db-root.mjs` (bản cũ ở `/tmp` đã mất; bản mới dùng `createRequire` vì ESM import không resolve từ ngoài repo), mirror 8811 chạy lại. DB nguyên vẹn.

## 5. Kiểm chứng live trên server build (final code)

- `/` 307 → `/vi`; `/vi/`, `/en/`, `/vi/blog/` 308 → dạng không slash (final 200).
- Detail pages 200: article, project `aurora-design-system`, art `after-the-rain`, collection `noise-and-light`, category `technology`, contact.
- 404 đúng: `/vi/blog/bogus-slug`, `/bogus`, `/vi/bogus`.
- Sitemap: 62 `<url>`, home entry `<loc>…/vi</loc>` với alternates `/vi`, `/en`, `x-default /vi` (nhất quán, không slash thừa). 5 category có bài published trong sitemap; `technology` (0 bài) không advertise nhưng trang render 200.
- Robots: `User-Agent: *`, `Allow: /`, disallow `/admin`, `/api/`, `/media/`, `/preview`; `Host` = bare hostname; `Sitemap:` đúng.
- JSON-LD live: article có `"@type":"BlogPosting"`; art có `"dateModified":"2026-11-13T21:49:53.319Z"` (thật, từ `updatedAt`).
- Canonical/hreflang home: `<link rel="canonical" href="…/vi"/>` + alternates `/vi`, `/en`, `x-default /vi`.

## 6. Kiểm chứng live trên export build (final code)

- Replicate đúng `pages.yml`: staging server routes ra `/tmp/pages-staging-local`, sed `force-dynamic` → `force-static` **sau** staging (đúng thứ tự CI), build `PAGES_EXPORT=1`, restore có trap (verify 0 literal `force-static` còn sót).
- `out/`: 215 file, 7.4 MB, 67 HTML. Không có `admin/`, `api/`, `preview/`, `media/`.
- Serve qua basePath, 17 URL đều 200 với nội dung thật: `/`, `/vi/`, `/en/`, `/vi/blog/`, `/en/blog/`, `/vi/projects/`, `/en/projects/`, category `technology`/`software-engineering`/`creative-work`, article, project, art, collection, contact, `sitemap.xml`, `robots.txt`, `manifest.webmanifest`.
- `<title>` export đã dùng enriched titles (vd blog list: "Ghi chép & chia sẻ về thiết kế, kỹ thuật và sáng tạo — Portfolio Studio").
- Export sitemap có 5 category URL kèm trailing slash; home canonical/hreflang đều `/vi/` (nhất quán trong export mode); robots `Host: nhatnguyenyn.github.io`, `Sitemap:` đúng.

## 7. Cổng pre-launch (phải xong trước traffic production thật)

1. **Rotate mật khẩu admin mặc định** — High. Default là literal trong repo public; local test DB đang dùng đúng default đó (có chủ đích, để verify). Production phải đặt mật khẩu mạnh riêng + xóa `SEED_ADMIN_PASSWORD` khỏi env sau seed.
2. **Quyết định CSP**: enforce hay giữ Report-Only (hiện chỉ Report-Only).
3. **Backend/deploy**: chốt Vercel/Postgres (hay giữ home server) thì mới có hosting redirect, Search Console, Rich Results validation.
4. Chạy `docs/REAL_WORLD_TEST_CHECKLIST.md` bằng người thật (không thay bằng kết quả máy ở đây).

## 8. Những gì KHÔNG chạy được / KHÔNG claim

- `npm audit`: BLOCKED (registry 403).
- Google indexing / CWV thực tế / Rich Results / Search Console: cần production + quyền chủ sở hữu.
- Cross-browser ngoài Chromium; iOS/Safari; axe run (Lighthouse a11y 100 là tín hiệu lab, không thay axe hay test bàn phím/screen reader thật).
- INP thực tế: Lighthouse lab không đo được (không có tương tác thật).
- Không đo trên thiết bị thật, không đo mạng thật.

## 9. Danh sách file thay đổi (so với main @ `be00cee`)

54 file modified + 9 nhóm file mới (untracked). Không commit/push/deploy.

### Modified (54)
`package.json`, `package-lock.json`, `prisma/seed.ts`, `scripts/preflight.mjs`,
`src/app/(public)/[locale]/[...rest]/page.tsx`, `src/app/(public)/[locale]/about/page.tsx`,
`src/app/(public)/[locale]/art/[slug]/page.tsx`, `src/app/(public)/[locale]/art/collections/[slug]/page.tsx`,
`src/app/(public)/[locale]/art/page.tsx`, `src/app/(public)/[locale]/blog/[slug]/page.tsx`,
`src/app/(public)/[locale]/blog/page.tsx`, `src/app/(public)/[locale]/contact/page.tsx`,
`src/app/(public)/[locale]/layout.tsx`, `src/app/(public)/[locale]/projects/[slug]/page.tsx`,
`src/app/(public)/[locale]/projects/page.tsx`, `src/app/fonts.ts` (parent), `src/app/globals.css` (parent: 1 dòng `@import` + fix `.card-cv`),
`src/app/robots.ts`, `src/app/sitemap.ts`,
`src/components/admin/locale-tabs.tsx`, `src/components/admin/media-picker.tsx`, `src/components/admin/profile-sections.tsx`,
`src/components/blog/editorial-article.tsx`,
`src/components/site/art-gallery.tsx`, `src/components/site/article-card.tsx`, `src/components/site/artwork-card.tsx`,
`src/components/site/back-to-top.tsx`, `src/components/site/language-switcher.tsx`, `src/components/site/page-hero.tsx`,
`src/components/site/project-card.tsx`, `src/components/site/share-bar.tsx`, `src/components/site/site-header.tsx`,
`src/components/ui/parallax.tsx`, `src/components/ui/reveal.tsx`,
`src/data/projects.ts`, `src/i18n/messages/en.ts`, `src/i18n/messages/vi.ts`,
`src/lib/markdown.ts`, `src/lib/rate-limit.ts`, `src/lib/seo.ts`, `src/lib/structured-data.ts`,
`src/middleware.ts`, `src/server/actions/auth.ts`, `src/server/actions/media.ts`, `src/server/auth.ts`,
`src/server/queries/artworks.ts`, `src/server/queries/projects.ts`,
`tests/article-template.test.ts`, `tests/auth-and-rate-limit.test.ts`, `tests/preflight.test.ts`,
`tests/routing-seo.test.ts`, `tests/seo-metadata.test.ts`, `tests/sitemap-robots.test.ts`, `tests/structured-data.test.ts`.
Tổng diff: **3820 insertions, 488 deletions** (kèm cả phần fonts của parent + Playwright/Lighthouse devDeps).

### Mới (untracked)
- `e2e/` (Playwright suite: config, helpers, smoke, responsive, admin, setup, temp-admin).
- `src/app/(public)/[locale]/blog/category/` (category landing pages).
- `src/app/manifest.ts` (Web app manifest).
- `src/app/fonts.css` + `src/app/fonts/` (parent — self-hosted fonts, 23 woff2).
- `src/components/site/art-lightbox.tsx`, `src/lib/focus-trap.ts`.
- `tests/broken-links.test.ts`, `tests/security-phase9d-actions.test.ts`.
- `docs/PHASE_8_SEO_PERFORMANCE_REPORT.md`, `docs/PHASE_9_BASELINE.md`, `docs/REAL_WORLD_TEST_CHECKLIST.md`, `docs/PHASE_9_FINAL_RELEASE_VALIDATION.md` (file này), `docs/POST_LAUNCH_BACKLOG.md`.

### Không đụng
`.github/workflows/` (parent), `src/app/fonts.ts` (parent — trừ việc nó nằm trong diff chung), hidaniel / SERENITY / ca-mini-game, DB production (không có), `portfolio_test` (chỉ vitest dùng).
