# Post-Launch Backlog — ý tưởng cải tiến, KHÔNG làm trong Phase 9 (feature freeze)

Mọi mục dưới đây là **không-phải-bug**: hoặc cần quyết định của chủ dự án, hoặc cần migration/thay đổi hạ tầng, hoặc là cải tiến. Không implement cho tới khi chủ dự án duyệt từng mục (ghi ngày duyệt + người duyệt khi bắt đầu làm).

## P0 — Bảo mật & vận hành (ưu tiên trước hoặc ngay sau launch)

1. **Rotate mật khẩu admin mặc định** (High — `scripts/preflight.mjs:16` là literal trong repo public). Preflight đã exit 1 ở production khi còn default; việc rotate thuộc về chủ dự án.
2. **CSP enforce**: hiện chỉ Report-Only. Cần test kỹ (đặc biệt inline script JSON-LD + nonce) rồi mới enforce; xem báo cáo CSP violations trước khi bật.
3. **Origin check cho ~30 Server Actions**: hiện chỉ 3 API mutation có check. Thêm origin validation thống nhất.
4. **Rate limit cho public GET APIs** (`/api/articles`, `/api/artworks`, `/api/projects`, `/api/categories`, `/api/collections`, `/api/profile`, `/api/settings`, `/api/tags` và các `[slug]`). `/api/health`, `/api/ready` cố tình loại trừ.
5. **Session lifecycle**: revoke session khác khi login (đã làm) + sliding refresh + kiểm tra IP/UA đã lưu + purge job cho session hết hạn.
6. **Nối `scripts/preflight.mjs` vào pipeline deploy**: hiện `npm run build` không tự gọi preflight (APP_URL production guard chỉ chạy khi gọi tay).
7. **Xóa `.artifacts/*.png` khỏi git** (10 file đang tracked) — cần chủ duyệt.

## P1 — SEO & hiệu năng (sau khi có production)

8. **Search Console + Rich Results validation** trên URL production (xem checklist §6).
9. **Hosting redirects**: HTTP→HTTPS, host canonical (non-www→www hoặc ngược lại) — chờ chốt deploy (Vercel/home server).
10. **Thống nhất trailing slash canonical** giữa server mode (`/vi`) và Pages export (`/vi/`): Lighthouse lab ghi redirect chain tốn ~610ms. Cần quyết định 1 dạng thống nhất rồi chỉnh `next.config.ts` + helpers cho khớp.
11. **Blur placeholder cho ảnh**: migration `Media.blurDataUrl String?` + generate lúc upload bằng sharp + backfill cho media cũ. (Thiết kế đã có trong Phase 8 report §F.)
12. **Ảnh OG/cover raster thật** thay SVG placeholder + fallback `/icon.png`; logo publisher thật cho JSON-LD.
13. **Tối ưu mobile perf lab (63–75)**: TBT 700–1450ms, LCP 3.3–3.9s dưới mobile throttle; desktop đã 98. Ưu tiên giảm JS main-thread trước; đo lại bằng PageSpeed Insights trên production rồi mới tối ưu sâu (số lab ≠ CWV thực tế).
14. **Cache layer cho các route `force-dynamic`**: hiện mọi trang đều dynamic, không cache. Cân nhắc revalidate/tagged cache sau khi đo production.

## P2 — Nội dung & khám phá

15. **Mở rộng nội dung mỏng** (report-only ở Phase 8): project write-ups 66–180 từ (`signal-api` en 66 từ, `lantern-notes` 72 từ) và artwork descriptions 18–42 từ. Articles 178–343 từ đã đủ dài.
16. **Tag landing pages** (`/{locale}/blog/tag/{slug}`): category đã có; tag tương tự (route + sitemap + test broken-links).
17. **Related articles đã có; mở rộng ShareBar** sang project/art detail (hiện chỉ article có ShareBar đầy đủ).
18. **RSS feed** (`/rss.xml` hoặc `/feed.xml`) cho blog — nếu chủ muốn độc giả subscribe.
19. **Editorial template cho thêm bài** (hiện seed chỉ 1 bài editorial) — do chủ biên tập quyết định, không phải việc code.

## P3 — Analytics & đo lường

20. **Analytics implementation** theo `docs/ANALYTICS_PROPOSAL.md` §4–§5 (provider, consent, retention 12 tháng, IP handling, chủ tài khoản). Không tạo tài khoản hay gắn tracking ID khi chưa duyệt.
21. **Theo dõi Search Console định kỳ**: coverage, Core Web Vitals thực tế, queries — sau khi production chạy 2–4 tuần.

## P4 — Trải nghiệm & công cụ

22. **Axe automated run** trong CI (hiện chỉ có Lighthouse a11y 100 lab) + test bàn phím/screen reader định kỳ theo checklist.
23. **E2E mở rộng**: thêm Firefox/WebKit khi có browser trên máy chạy test (hiện chỉ Chromium); thêm test cho flow quên mật khẩu / đổi mật khẩu khi có.
24. **Dọn `console.warn` của Prisma** (`package.json#prisma` deprecated, sẽ bỏ ở Prisma 7 — migrate sang `prisma.config.ts` khi lên Prisma 7).
25. **Ghi chú vận hành local**: launcher Postgres persistent `~/workspace/base-portfolio-review/dev-db-root.mjs` + mirror `~/workspace/base-portfolio-review/prisma-mirror/` — đã dùng trong Phase 9 sau khi hạ tầng cũ tắt; cân nhắc đưa vào `docs/` chính thức nếu còn dùng lâu dài.

## Đã loại khỏi backlog (đã xong trong Phase 8/9 — ghi để khỏi làm lại)

- Sitemap `x-default`, robots host bare, bare-path redirect, canonical/trailing-slash, filtered/pagination metadata, JSON-LD listing/author/SearchAction, H1 demotion, byline + updated date, seed SEO, editorial seed, alt locale-aware, dọn placeholder links, related projects + DB-side pagination, category landing pages + sitemap, broken-link tests, self-hosted fonts, lightbox split, focus trap, LocaleTabs arrow keys, rate-limit fixes, session revoke on login, preflight exit 1, responsive overflow fixes, home hreflang fix, manifest export fix, searchParams-metadata export fix.
