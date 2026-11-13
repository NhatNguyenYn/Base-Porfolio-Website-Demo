# Phase 7 — Motion Design & Editorial Experience

Ngày: 2026-11-13
Trạng thái: **PHASE 7 COMPLETED WITH WARNINGS**

> Không commit, không push, không deploy. Database production không bị chạm.
> Một migration additive đã được áp dụng cho database development và test; một
> bài kiểm thử tạm đã được tạo rồi xoá, không ảnh hưởng 5 bài viết hiện có.

## 1. Kiến trúc animation

### 1.1 Token

Toàn bộ chuyển động dùng chung một bộ token trong `src/app/globals.css`:

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--motion-fast` | 160 ms | hover, focus, field |
| `--motion-base` | 320 ms | panel, back-to-top |
| `--motion-slow` | 700 ms | scroll reveal |
| `--motion-ease-standard` | `cubic-bezier(.2,.7,.2,1)` | micro-interaction |
| `--motion-ease-out` | `cubic-bezier(.22,1,.36,1)` | entrance |
| `--motion-stagger` | 70 ms | nhịp delay giữa các card |
| `--reading-width` | `68ch` | measure của bài Editorial |

Không thêm thư viện animation (Motion/GSAP). Tất cả dùng CSS + IntersectionObserver.

### 1.2 Component / primitive

| Thành phần | File | Vai trò |
|---|---|---|
| `Reveal` | `src/components/ui/reveal.tsx` | Entrance khi vào viewport; variant `up`, `fade`, `scale`, `mask`; `delay` để stagger; observer tự disconnect |
| `AnimatedHeadline` | `src/components/ui/animated-headline.tsx` | Tách headline theo từ, CSS stagger, server-rendered |
| `Parallax` | `src/components/ui/parallax.tsx` | Lệch tối đa 10–12 px, một passive listener + rAF, chỉ `transform` |
| `ReadingProgress` | `src/components/blog/reading-progress.tsx` | Thanh tiến độ bằng `scaleX`, không layout |
| `BackToTop` | `src/components/site/back-to-top.tsx` | Hiện sau 600 px, keyboard được, tôn trọng reduced motion |
| `SectionHeader` | `src/components/site/section-header.tsx` | Tự bọc `Reveal variant="fade"` cho mọi section heading |

`Reveal` có fallback: phần tử đang nằm trong viewport (hoặc phía trên sau khi
khôi phục scroll) được hiện ngay, không chờ callback; nếu trình duyệt không có
IntersectionObserver thì hiện luôn. Nội dung không bị giữ ẩn khi tab nền hoặc
khi observer không chạy.

### 1.3 Phạm vi áp dụng

- Hero homepage: headline theo từ, portrait reveal bằng `mask`, parallax nhẹ.
- Section heading + card: reveal và stagger 60–80 ms.
- Card hover: ảnh scale 1.035 với easing chung (đã có từ trước, nay dùng token).
- Header/mobile drawer: panel fade/slide 320 ms.
- Button: hover nhấc 1 px, active lùi 1 px.
- Editorial article: reading progress, hero cover mask, TOC, back-to-top toàn site.

Không animate nội dung đang đọc, không dùng scroll handler nặng, không đổi
layout khi animation chạy.

## 2. Editorial template

### 2.1 Bố cục

`src/components/blog/editorial-article.tsx`:

- Category badge, headline lớn, deck (serif italic), tác giả, ngày, thời gian đọc.
- Cover 21:9 với mask reveal và caption lấy từ `alt` của ảnh.
- Sidebar desktop: mục lục sticky + tác giả + CTA liên hệ.
- Mobile: mục lục thu gọn trong `<details>`, không chiếm màn hình.
- Bài viết measure 68ch, line-height 1.95, H2/H3 phân cấp, pull quote lớn.
- Hộp tác giả, tags, bài liên quan.
- `ReadingProgress` cố định trên đầu trang.

### 2.2 Interview Q&A

Markdown mở rộng, chỉ bật cho template Editorial:

```markdown
:::qa
Q: Câu hỏi?
A: Câu trả lời, có thể nhiều dòng.

Vẫn là câu trả lời.
Q: Câu hỏi tiếp?
A: ...
:::
```

Parser trong `src/lib/markdown.ts` tách block trước khi render, tạo
`.qa-pair` / `.qa-question` / `.qa-answer`; văn bản được escape (không render
HTML người dùng), nhiều đoạn được giữ. Block sai định dạng được render như text
thường, không bị mất nội dung. Blockquote Markdown trở thành pull quote.
Ảnh Markdown đứng riêng được chuyển thành `<figure>` + `<figcaption>` lấy alt,
và luôn có `loading="lazy"`.

### 2.3 Tương thích

- Template mặc định giữ nguyên JSX cũ, không đổi URL, dữ liệu hay API.
- Bài cũ không có giá trị template sẽ đọc thành `default`.
- Cả VI và EN dùng cùng bố cục vì template gắn với Article, không gắn với bản dịch.

## 3. CMS template selection

- Schema: `Article.template String @default("default")`.
- Migration: `20261113183319_article_template` — chỉ `ADD COLUMN ... DEFAULT
  'default'`, không reset, không xoá dữ liệu.
- Form admin có select **Bố cục bài viết**: `Default` / `Editorial`.
- `saveArticleAction` chuẩn hoá qua `normalizeArticleTemplate`; giá trị lạ rơi về
  `default`, nên form cũ hoặc request thiếu field không làm hỏng bài.
- Preview `/preview/article/[id]` dùng đúng template, render Q&A và hiển thị badge
  template trên thanh preview.
- Public page chọn layout theo template; metadata/JSON-LD/URL không đổi.

## 4. Database

| Mục | Kết quả |
|---|---|
| Thay đổi | `Article.template TEXT NOT NULL DEFAULT 'default'` |
| Migration | 1 file, additive |
| Áp dụng | `prisma migrate deploy` trên dev và `portfolio_test` |
| Dữ liệu hiện có | 5/5 bài = `default` sau migration |
| Kiểm thử tạm | 1 bài Editorial tạo → kiểm tra → xoá; còn 5 bài |
| Production | Không chạm |

## 5. Performance

| Chỉ số | Kết quả |
|---|---|
| First Load JS dùng chung | 103 kB (không tăng) |
| Middleware | 34.4 kB |
| Thư viện mới | 0 |
| Animation | `opacity`, `transform`, `clip-path`; không animate layout |
| Scroll | 1 passive listener + rAF cho mỗi parallax/progress; observer disconnect sau lần đầu |
| Ảnh | `next/image`, `sizes`, lazy mặc định; cover Editorial `priority` |

Không đo LCP/CLS/INP bằng Lighthouse trong môi trường này; chỉ kiểm tra bundle
build và cấu trúc animation. Đây là khoảng trống cần đo trên staging.

## 6. Accessibility

- `prefers-reduced-motion: reduce` tắt animation, xoá delay, đặt reveal về
  `opacity:1`, bỏ clip-path/transform; reading progress không transition.
- Không có nội dung chỉ tồn tại nhờ animation: headline là text thật, QA là text
  thật, reveal có fallback.
- Back-to-top là `<button>` có `aria-label`, focus-visible toàn site.
- Mobile menu vẫn dùng `<button aria-expanded>`; panel portal giữ nguyên.
- TOC là link thật; heading có id ổn định.
- Q/A label `Q`/`A` là trang trí (`aria-hidden`), câu hỏi/trả lời vẫn là text.
- Không thêm `tabindex` dương, không chặn bàn phím.

## 7. Kết quả kiểm thử

| Kiểm tra | Kết quả |
|---|---|
| `tsc --noEmit` | 0 lỗi |
| `eslint src tests` | 0 lỗi |
| `vitest run` | **121/121 pass, 16 file** |
| `prisma validate` | hợp lệ |
| `prisma migrate status` | up to date |
| `next build` | pass; 103 kB shared, middleware 34.4 kB |
| Test mới | 6 navigation visibility (Phase 6) + 8 article template/Markdown |

Kiểm tra trình duyệt (dev, dữ liệu thật):

| Trường hợp | Kết quả |
|---|---|
| Desktop 1440, VI/EN | Nav `Trang chủ / Giới thiệu / Phòng tranh / Bài viết / Liên hệ` (EN: Home/About/Gallery/Writing/Contact); không có Projects |
| Mobile 390 và 375 | Panel mở: 5 link, không Projects, số thứ tự 01–05; không overflow ngang (scrollWidth 373/358) |
| Footer | Không còn link Projects |
| Trang `/vi/projects` trực tiếp | 200, hiển thị 4 card; không bị xoá hay chặn |
| Bài Editorial | 2 `.qa-pair`, `.prose-editorial--editorial`, `.reading-progress`, TOC, related |
| Bài cũ | Không có class Editorial, 0 QA pair — template cũ nguyên vẹn |
| Hydration | Sau khi thêm `suppressHydrationWarning` cho script có nonce, console sạch (chỉ còn log DevTools) |
| Reveal fallback | 5 phần tử trong viewport được hiện ngay cả khi tab ở trạng thái `hidden` |

## 8. Giới hạn / chưa kiểm chứng

1. **Chưa click-through CMS**: không dùng credential admin trong phiên này; select
   template và preview được kiểm chứng qua typecheck/build + đọc code, chưa thao
   tác thực tế trên form. Cần một vòng đăng nhập admin để xác nhận.
2. **Chưa xem trực quan animation**: tab preview của môi trường chạy ở
   `visibility: hidden`, nên CSS animation và IntersectionObserver bị tạm dừng.
   Đã xác minh cấu trúc DOM, fallback và console; chưa đánh giá cảm giác chuyển
   động bằng mắt. Cần mở tab foreground để duyệt visual.
3. **Reduced motion** được xử lý bằng CSS nhưng chưa emulate trong browser.
4. Caption ảnh dùng `alt`; chưa có trường credit riêng, nên credit phải viết
   trong alt/caption.
5. Video embed không được hỗ trợ: sanitizer không cho `iframe`.
6. Q&A chỉ đọc plain text (escape HTML), không render bold/link bên trong câu trả lời.
7. Template gắn với Article, không gắn với từng bản dịch: VI/EN cùng layout.
8. Không đo LCP/CLS/INP; chưa có Lighthouse trong môi trường này.
9. Không dùng thư viện animation; nếu sau này cần timeline phức tạp hơn, cần audit
   bundle riêng.

## 9. File thay đổi

### Thêm

- `src/components/ui/animated-headline.tsx`
- `src/components/ui/parallax.tsx`
- `src/components/blog/article-body.tsx`
- `src/components/blog/editorial-article.tsx`
- `src/components/blog/reading-progress.tsx`
- `src/components/site/back-to-top.tsx`
- `src/lib/article-template.ts`
- `prisma/migrations/20261113183319_article_template/migration.sql`
- `tests/article-template.test.ts`
- `docs/PHASE_7_MOTION_EDITORIAL_REPORT.md`

### Sửa

- `prisma/schema.prisma` — cột `template`
- `src/app/globals.css` — motion token, variant, editorial typography, QA, progress
- `src/app/(public)/[locale]/page.tsx` — headline, parallax, mask
- `src/app/(public)/[locale]/blog/[slug]/page.tsx` — chọn layout, Markdown editorial
- `src/app/(public)/[locale]/layout.tsx` — BackToTop, nonce hydration
- `src/app/preview/[type]/[id]/page.tsx` — preview theo template
- `src/components/admin/article-form.tsx`, `admin/.../blog/[id]/page.tsx` — select
- `src/components/site/section-header.tsx`, `site-header.tsx` — reveal/panel
- `src/components/site/theme-script.tsx` — nonce hydration
- `src/components/ui/reveal.tsx` — variant + fallback
- `src/lib/markdown.ts` — QA, figure, editorial option
- `src/lib/validation.ts`, `server/actions/articles.ts`, `server/queries/articles.ts`,
  `lib/services/preview.ts` — template plumbing
- `src/i18n/messages/vi.ts`, `en.ts` — nhãn back-to-top

### Xoá

Không xoá file hay nội dung nào.

## 10. Kết luận

**PHASE 7 COMPLETED WITH WARNINGS** — hệ thống motion, editorial template và CMS
selection đã triển khai, build/test đạt, dữ liệu cũ giữ nguyên. Hai việc còn lại
là xác nhận CMS bằng tài khoản admin và duyệt visual/animation trên tab foreground;
không có blocker kỹ thuật.
