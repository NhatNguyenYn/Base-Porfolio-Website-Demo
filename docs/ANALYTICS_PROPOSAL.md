# Analytics readiness — Phase 8H

Trạng thái: **chưa tích hợp analytics**. Không có script, cookie, tracking ID
hoặc tài khoản dịch vụ nào được thêm trong Phase 8. Tài liệu này là đề xuất để
chủ dự án quyết định trước khi bật đo lường.

## 1. Hiện trạng

- Không có Google Analytics, Plausible, Umami, PostHog hay pixel quảng cáo.
- Không có mã theo dõi bên thứ ba trong layout, CMS hoặc API.
- `viewCount` của bài viết/tác phẩm là bộ đếm nội bộ trong PostgreSQL, không phải
  analytics người dùng và không gửi dữ liệu ra ngoài.
- Không có consent banner vì hiện tại không có cookie phân tích/quảng cáo.

## 2. Sự kiện tối thiểu nên đo

Chỉ thuộc tính không định danh; không gửi nội dung form, email, IP thô hoặc
thông tin phiên đăng nhập.

| Event | Khi nào | Thuộc tính đề xuất |
|---|---|---|
| `page_view` | Một lần mỗi điều hướng | `path`, `locale`, `template` (nếu là bài viết) |
| `article_view` | Bài viết published được mở | `slug`, `template`, `category` |
| `article_complete` | Đọc hết bài (xem mục 3) | `slug`, `template` |
| `cta_click` | Click CTA chính (liên hệ, xem dự án) | `label`, `location` (`hero`, `article`, `footer`) |
| `contact_submit` | Server action trả về thành công | `result` (`success` / `error`), không có nội dung |
| `outbound_click` | Link ngoài (GitHub, demo, mạng xã hội) | `host`, `location` |

Không cần đo lượt cuộn, hover, thời gian trên trang hoặc mọi click.

## 3. Cách đo `article_complete` nếu được duyệt

Chỉ dùng tín hiệu đọc thực:

- Bài ngắn: đạt cuối bài và tab còn visible ít nhất 5 giây.
- Bài dài: đạt 90% chiều cao nội dung hoặc cuối bài, kèm 10 giây visible.
- Gửi tối đa một lần cho mỗi `(slug, page load)`.
- Không dùng `scroll` để suy ra "đọc hiểu"; đây chỉ là proxy.

## 4. Quyết định cần chủ dự án phê duyệt

1. **Provider**: tự host (Plausible/Umami) hay SaaS? Nếu SaaS, chọn nhà cung cấp
   và vùng lưu trữ dữ liệu.
2. **Consent**: có cần banner trước khi ghi nhận không? Nếu dùng cookie/tracking
   không thiết yếu, cần consent theo khu vực người dùng; nếu dùng analytics
   không cookie, vẫn nên có privacy notice.
3. **Retention**: giữ dữ liệu bao lâu (đề xuất 12 tháng), ai có quyền xem?
4. **IP**: có lưu IP đầy đủ không? Đề xuất không lưu, hoặc hash/loại bỏ octet cuối.
5. **Mục tiêu**: chỉ đo nội dung hay cần attribution chiến dịch (`utm_*`)?
6. **Chủ sở hữu tài khoản**: dùng email nào, có chia sẻ với cộng tác viên không?

## 5. Nguyên tắc triển khai khi được duyệt

- Script analytics tải sau tương tác hoặc bằng `next/script` với chiến lược phù
  hợp; không chặn LCP/INP.
- Không đặt tracking ID giả hoặc commit secret.
- Không gửi email, mật khẩu, nội dung liên hệ, token phiên, tham số tìm kiếm nội
  bộ có thể chứa dữ liệu cá nhân.
- Không bật trước khi có quyết định về consent và privacy notice.
- Ghi lại quyết định vào báo cáo Phase 8 và cập nhật `docs/PRODUCTION_CHECKLIST.md`.

## 6. Việc không làm trong Phase 8

- Không tạo tài khoản analytics.
- Không thêm mã theo dõi hoặc ID giả.
- Không thêm banner consent khi chưa có công cụ cần consent.
- Không gửi dữ liệu ra ngoài từ form liên hệ.
