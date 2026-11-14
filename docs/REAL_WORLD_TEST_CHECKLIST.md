# Real-World Test Checklist — kiểm tra bằng người thật trước khi công bố

- **Dùng sau khi:** build đã pass toàn bộ kiểm chứng máy (xem `docs/PHASE_9_FINAL_RELEASE_VALIDATION.md` — typecheck/lint/vitest/build/E2E/Lighthouse đều xanh).
- **Mục đích:** máy không thay được mắt người, tay người, thiết bị thật và mạng thật. Checklist này là việc **con người** phải làm, trên **production (hoặc staging giống production)**, trước khi coi là release xong.
- **Cách ghi kết quả:** tick từng mục, ghi lại thiết bị + trình duyệt + URL + ảnh chụp màn hình khi fail. Mọi fail đều ghi issue với bước tái hiện, không sửa lặng lẽ.

## 0. Chuẩn bị

- [ ] Deploy bản mới nhất lên production (hoặc staging có cùng dữ liệu + env production).
- [ ] **Rotate mật khẩu admin mặc định** (xem validation report §7 — bắt buộc trước traffic thật).
- [ ] Xác nhận `APP_URL` production đúng (không còn localhost), `NODE_ENV=production`.
- [ ] Chuẩn bị 2 tài khoản test: 1 admin (mật khẩu mạnh mới), 1 tài khoản xem thường (nếu có).
- [ ] Chuẩn bị thiết bị: 1 desktop/laptop, 1 điện thoại Android, 1 iPhone (nếu có); trình duyệt Chrome + Safari (iOS) + Firefox (desktop).

## 1. Trang công khai (mỗi trang, cả 2 locale vi/en)

- [ ] Home (`/` → `/vi`, `/en`): hero, stats (04 dự án / 08 tác phẩm / 05 bài viết), 4 project, gallery, bài featured — đúng nội dung, không lỗi chính tả, không ảnh vỡ.
- [ ] About (`/vi/about`, `/en/about`): đầy đủ section, không thiếu heading.
- [ ] Projects list (`/vi/projects`, `/en/projects`): filter theo tech/category, sort (mới nhất/cũ nhất/theo tên), tìm kiếm `q` (thử gõ không dấu, vd "thiet ke" phải ra "thiết kế"), phân trang.
- [ ] Project detail (`/vi/projects/aurora-design-system` + 3 project còn lại): đủ nội dung, related projects hiển thị (tối đa 3, không chứa chính nó), link GitHub/demo (hiện đang `null` ở seed — xác nhận hiển thị đúng khi không có link).
- [ ] Art list + detail (`/vi/art`, `/vi/art/after-the-rain` + 7 tác phẩm còn lại): lightbox mở/đóng, phím Escape đóng, Tab không thoát khỏi lightbox, ảnh hiển thị đúng.
- [ ] Collections (`/vi/art/collections/noise-and-light` + 2 collection còn lại).
- [ ] Blog list (`/vi/blog`, `/en/blog`): filter category/tag, tìm kiếm, phân trang, bài featured.
- [ ] Blog article (`/vi/blog/design-systems-start-before-components` — template **editorial**: kiểm tra layout editorial khác default, đọc hết bài, TOC/heading đúng) + 4 bài còn lại (template default).
- [ ] Category landing (`/vi/blog/category/software-engineering` + 4 category còn lại): đúng bài của category, phân trang.
- [ ] Contact (`/vi/contact`, `/en/contact`): form hiển thị đúng cả 2 ngôn ngữ.
- [ ] Chuyển locale vi ↔ en ở mỗi trang: ở đúng trang đó (không về home), nội dung đổi ngôn ngữ.

## 2. Contact form (thử thật)

- [ ] Gửi form hợp lệ (tên, email thật của bạn, nội dung): thấy thông báo thành công; message xuất hiện trong admin (`/admin/messages` hoặc tương đương).
- [ ] Gửi form thiếu email / email sai định dạng: thấy lỗi rõ ràng, không gửi được.
- [ ] Gửi 5 lần liên tiếp nhanh: lần thứ 5 bị rate limit (4 lần/10 phút) — xác nhận limit hoạt động, không phải bug.
- [ ] Gửi form rồi submit lại ngay (double-click nút): chỉ tạo 1 message (không trùng lặp).
- [ ] Kiểm tra email nhận được (nếu đã cấu hình email): nội dung đúng, không vào spam. Nếu chưa cấu hình email, xác nhận message chỉ lưu DB (theo thiết kế hiện tại).

## 3. Admin / CMS (`/admin`)

- [ ] Login bằng tài khoản admin mới (mật khẩu đã rotate): vào được dashboard; sai mật khẩu → báo lỗi, không vào được.
- [ ] Tạo 1 bài viết nháp mới (điền đủ title/content vi/en) → lưu → bài nháp **không** xem được ở public (thử URL public khi logged-out → 404).
- [ ] Xem trước bài nháp qua preview link khi đã login → hiển thị đúng.
- [ ] Publish bài → xuất hiện ở blog list + sitemap (đợi 1–2 phút nếu sitemap cache).
- [ ] Sửa 1 project (đổi mô tả) → xem public đổi theo.
- [ ] Upload 1 ảnh qua media picker: chọn được, focus không thoát khỏi dialog, Escape đóng, ảnh hiển thị ở public sau khi dùng.
- [ ] Đổi tab ngôn ngữ trong form admin bằng phím mũi tên (trái/phải/Home/End).
- [ ] Logout → thử vào `/admin` → redirect về `/admin/login`; thử preview link khi logged-out → redirect về login.
- [ ] Tạo 1 tài khoản admin phụ (nếu cần) rồi xóa — xác nhận không xóa nhầm tài khoản chính.

## 4. Responsive & thiết bị thật

- [ ] iPhone (Safari, 390px): home + 1 project detail + 1 article — không scroll ngang, không chữ tràn, menu mobile mở/đóng được, lightbox dùng được.
- [ ] Android (Chrome, 360–400px): tương tự.
- [ ] Tablet 768px: layout 2 cột đúng, không vỡ.
- [ ] Desktop 1366px và 1920px: không khoảng trắng thừa, không stretch quá rộng.
- [ ] Xoay màn hình điện thoại (portrait ↔ landscape): layout theo đúng, không kẹt.

## 5. Bàn phím & accessibility (người thật)

- [ ] Chỉ dùng Tab/Shift+Tab/Enter/Escape đi hết home → 1 article → contact: focus nhìn thấy rõ ở mọi element, thứ tự hợp lý, không bị kẹt focus.
- [ ] Mở lightbox bằng bàn phím → Tab chỉ chạy trong lightbox → Escape đóng → focus trở về đúng nút đã mở.
- [ ] Mở mobile menu bằng bàn phím → Escape đóng → focus trở về nút menu.
- [ ] Bật screen reader (VoiceOver/NVDA) đọc thử home + 1 article: heading đúng tầng, ảnh có alt đúng, link đọc rõ đích đến (không có "click here").
- [ ] Bật "Reduce motion" ở hệ điều hành: animation/reveal/parallax giảm hoặc tắt, trang vẫn dùng được.

## 6. SEO — kiểm tra ngoài (sau khi có URL production)

- [ ] Google Search Console: add property, verify, submit sitemap (`/sitemap.xml`), xem số URL indexed sau 2–7 ngày.
- [ ] Rich Results Test (Google): test 1 article URL + 1 project URL + home — ghi lại loại rich result nào đủ điều kiện, lỗi nào (nếu có).
- [ ] Xem source 1 article: `<title>`, canonical, hreflang vi/en/x-default, JSON-LD `BlogPosting` — khớp nhau, không trỏ vào URL redirect.
- [ ] Chia sẻ 1 article lên Facebook/Zalo/Telegram: preview card hiện đúng title + mô tả + ảnh (không phải ảnh xám/trống).
- [ ] Thử URL lạ (`/vi/khong-co-trang-nay`): trang 404 đúng thiết kế, có link về home, status 404 thật (kiểm tra bằng devtools Network).
- [ ] Kiểm tra `robots.txt` production: `Host` đúng domain thật, `Sitemap:` đúng URL, `/admin` + `/api/` + `/preview` + `/media/` vẫn disallow.

## 7. Hiệu năng cảm nhận (mạng thật)

- [ ] Mở home bằng 4G trên điện thoại: cảm nhận thời gian hiện nội dung (ghi số giây ước lượng + cảm nhận nhanh/chậm).
- [ ] Mở 1 article bằng 4G: ảnh cover hiện sau bao lâu, có bị nhảy layout (CLS) khi ảnh load không.
- [ ] Chạy PageSpeed Insights (Google) cho home + 1 article, cả mobile lẫn desktop: ghi điểm + 3 vấn đề lớn nhất nó nêu (để đối chiếu với số lab trong Phase 8 report §F).
- [ ] Thử tắt mạng giữa chừng rồi mở lại 1 trang đã xem: hành vi đúng (không treo trắng).

## 8. Nội dung & thương hiệu (đọc kỹ lần cuối)

- [ ] Không còn chữ "Tên Của Bạn", email `example.com`, link `example.com`, ảnh SVG placeholder ở vị trí nào mà khách sẽ thấy (trừ khi đó là dữ liệu demo có chủ đích).
- [ ] Mọi ngày tháng, số liệu (năm kinh nghiệm, số dự án) đều đúng sự thật.
- [ ] Favicon/logo hiển thị đúng ở tab trình duyệt + khi share.
- [ ] Không còn chuỗi "hidaniel" ở bất cứ đâu khách thấy được.

## 9. Sau khi test xong

- [ ] Liệt kê toàn bộ fail tìm được (mỗi fail: URL + thiết bị + trình duyệt + bước tái hiện + ảnh chụp).
- [ ] Phân loại: blocker (phải sửa trước công bố) / nên sửa / backlog.
- [ ] Blocker sửa xong → chạy lại đúng mục đó (không cần chạy lại toàn bộ checklist, trừ khi sửa đụng layout chung).
- [ ] Ghi ngày + người test + URL production đã test vào cuối file này (bổ sung sau khi test).
