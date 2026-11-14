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

## Phase 10 — follow-up (ghi 2026-11-14, sau Phase 10; xem `docs/PHASE_10_CUSTOM_SURVEY_REPORT.md` §J)

26. **Sửa 2 test Phase 10 còn fail** (High): `booking-flow` "invalid intake answers" (muốn `INVALID_ANSWERS`, nhận `INVALID` từ nhánh zod ở `src/app/api/bookings/route.ts:114`) và `flower-allocation` PII test (409 `FLOWERS_EXHAUSTED` vì test trước để lại 30 booking đang hoạt động, pool hoa đầy) — xem báo cáo §G.4.
27. **Verify `next build` + export `PAGES_EXPORT=1`** sau Phase 10 (High): build full-stack + export, kiểm tra `out/` không có HTML `survey/`/`booking/`, số HTML không đổi so với baseline 73 (báo cáo §H.3).
28. **E2E 15 bước Phase 10** (§12 master prompt: tạo → câu hỏi → theme → preview → publish → copy URL → trả lời công khai → xem/export → close → verify reject) — chạy Playwright Chromium, reuse `admin.setup.ts`.
29. **Kiểm tra responsive 6 viewport** (1920/1440/1366/768/390/375) cho trang survey/booking công khai; ưu tiên mobile 390px.
30. **Mở rộng pool hoa nếu cần**: pool hiện 30 booking đang hoạt động; booking thứ 31 bị từ chối `FLOWERS_EXHAUSTED`. Thêm loài hoa vào `src/lib/flowers.ts` khi khách cần nhiều lịch đồng thời hơn.
31. **Cảnh báo builder-vs-live**: sửa câu hỏi trên khảo sát đã có response làm thay đổi ý nghĩa đáp án đã lưu — thêm cảnh báo và ưu tiên "duplicate thành bản nháp mới" cho khảo sát đã publish.
32. **Email distribution** (nếu chủ duyệt sau này): hiện chỉ có shareable link; gửi mail mời khảo sát/xác nhận đặt lịch cần chọn provider + template + unsubscribe — không tự đăng ký dịch vụ hay giả lập gửi.
33. **Data retention policy**: export trước khi xóa, quy trình xóa response theo phê duyệt; hiện không tự động xóa gì.
34. **Phase 11 — Website Schedule JSON Importer (ĐÃ LÊN LỊCH, chạy sau Phase 10)**: import lịch từ JSON vào booking calendar Phase 10; touchpoints đã ghi trong báo cáo Phase 10 §K (reuse `vnLocalToUtc` ở `src/lib/booking-time.ts`, thêm `externalId` + `source` qua migration additive, map status `scheduled` ≈ slot `available`/booking `pending`, quyết định service binding cho lịch import, không bao giờ ghi đè `flowerCode`/`referenceCode`/contact/`surveyResponseId`, hủy = mark `cancelled` chứ không xóa, mở rộng calendar `/booking` + `/api/booking/slots` hiện có). Xem `~/workspace/base-portfolio-review/phase-11-master-prompt.md`.

## Phase 11 — follow-up (ghi 2026-11-14, sau Phase 11; xem `docs/SCHEDULE_JSON_IMPORT_SPEC.md` §1, §11 và §13 và `docs/PHASE_11_SCHEDULE_IMPORT_REPORT.md` §J)

35. **Public JSON feed cho lịch đã nhập** (Phase 11 follow-up): Phase 11 v1 chỉ có server-component query (`listUpcomingImportedSchedules`) trên trang `/booking`, không có public JSON endpoint — cần quyết định feed public, token-gated hay admin-only trước khi làm. (Đã kiểm tra lại theo code thật 2026-11-14: vẫn chưa có endpoint; danh sách public hiện trộn mọi connection + scope manual, không ghi attribution.)
36. **Hỗ trợ overnight** (Phase 11 follow-up): v1 từ chối lịch qua đêm (`end <= start` cùng ngày, message `"End time must be after start time (overnight schedules are not supported)"`); cần quyết định format (thêm field `endDate` hay tách thành 2 entry cùng ngày) trước khi implement. (Đã kiểm tra lại theo code thật 2026-11-14: vẫn từ chối, chưa có hỗ trợ qua đêm.)
37. **UI kéo-thả / kéo lịch** (Phase 11 follow-up): admin calendar Phase 11 chỉ có filter ngày/trạng thái (tối đa 500 dòng/tháng, hiện tối đa 3 lịch/ngày rồi `"+N lịch nữa"`); muốn dời lịch bằng kéo-thả thay vì import lại JSON với giờ mới thì cần thêm UI này. (Đã kiểm tra lại theo code thật 2026-11-14: vẫn chưa có kéo-thả.)
38. **Import từ file .xlsx trực tiếp** (Phase 11 follow-up): website v1 chỉ nhận JSON; agent bên ngoài hiện phải tự chuyển Excel → JSON — nếu muốn admin upload `.xlsx` thẳng lên web thì cần parser phía server.
39. **Webhook thông báo khi import xong** (Phase 11 follow-up): v1 chỉ trả kết quả đồng bộ trong response API (hoặc xem trang history); muốn hệ thống bên ngoài nhận callback khi import hoàn tất thì cần thêm webhook (URL đăng ký theo connection + ký payload).
40. **Role READONLY cho monitoring** (Phase 11 follow-up, §11 master prompt): tài khoản giám sát chỉ-đọc cho Muse sau này — chọn 1 trong 2 phương án đã ghi trong spec §11.2 (khuyến nghị: role `READONLY` mới + session riêng; hoặc scoped read-only `IntegrationConnection`); không làm trong Phase 11, cần quyết định của chủ trước khi triển khai.
41. **Setter + enforcement cho `autoApply`** (Phase 11 follow-up): v1 lưu field `autoApply` (mặc định false) nhưng không có UI/action nào đổi được nó và không code nào đọc nó (API vẫn apply trực tiếp bất kể flag) — cần quyết định semantics trước khi làm: khi `autoApply=false` thì API chỉ cho preview (apply phải xác nhận tay trong admin) hay vẫn apply trực tiếp; sau đó thêm toggle trong panel connections + gate trong route. Đừng làm khi chưa có quyết định, vì đổi semantics sẽ ảnh hưởng agent tích hợp sau này.

## Đã loại khỏi backlog (đã xong trong Phase 8/9 — ghi để khỏi làm lại)

- Sitemap `x-default`, robots host bare, bare-path redirect, canonical/trailing-slash, filtered/pagination metadata, JSON-LD listing/author/SearchAction, H1 demotion, byline + updated date, seed SEO, editorial seed, alt locale-aware, dọn placeholder links, related projects + DB-side pagination, category landing pages + sitemap, broken-link tests, self-hosted fonts, lightbox split, focus trap, LocaleTabs arrow keys, rate-limit fixes, session revoke on login, preflight exit 1, responsive overflow fixes, home hreflang fix, manifest export fix, searchParams-metadata export fix.
