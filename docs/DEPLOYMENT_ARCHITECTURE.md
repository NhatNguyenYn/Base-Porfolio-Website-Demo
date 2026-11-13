# Deployment Architecture — Portfolio

> **Trạng thái: đề xuất, chưa chọn target và chưa triển khai.** Tài liệu này mô tả
> các kiến trúc khả thi cho một portfolio Next.js tự host, kèm yêu cầu vận hành.
> Việc chọn nhà cung cấp/domain thuộc quyết định của chủ dự án.

## 1. Luồng request

```
Người dùng
   │ HTTPS (443)
   ▼
DNS (A/AAAA) ──► TLS termination: nginx/Caddy hoặc CDN
                   │  X-Forwarded-For (ghi đè), X-Forwarded-Proto=https
                   ▼
            Next.js 15 `next start`  (127.0.0.1:3000, systemd/container)
              │            │                  │
              │            │                  └─► Log stdout (journald/logrotate)
              │            └─► /media/* ── local volume HOẶC redirect/CDN S3
              ▼
        PostgreSQL 15–18 (private network, TLS, role tối thiểu)
              │
              └─► pg_dump hằng ngày ──► off-site (object storage/máy khác)
```

Thành phần bắt buộc:

| Thành phần | Vai trò | Ghi chú |
|---|---|---|
| Reverse proxy | TLS, nén, giới hạn body 12 MB, header forwarding | Không đặt CSP/XFO ở proxy (app đã gửi) |
| Next.js Node server | SSR/API, cổng loopback | 1 instance là đủ cho quy mô portfolio |
| PostgreSQL | Dữ liệu CMS | Role riêng, `connection_limit` ≤ 10 |
| Media store | Ảnh upload | Volume persistent hoặc S3-compatible |
| Backup | DB + media | DB dump + checksum; media rsync/versioning |
| Giám sát | `/api/health`, `/api/ready`, log JSON | Alert khi ready fail 2 lần liên tiếp |

## 2. Ba kiến trúc khả thi

Chi phí dưới đây là **khoảng tham khảo**, phải xác nhận lại tại thời điểm mua;
không có cam kết giá.

### Phương án A — Một VPS tự quản lý

```
VPS 1 vCPU / 2 GB RAM / 20–40 GB disk
├─ nginx + Certbot
├─ Next.js (systemd)
├─ PostgreSQL cùng máy
└─ /srv/portfolio/uploads (volume/disk)
```

| Tiêu chí | Đánh giá |
|---|---|
| Chi phí | Thấp nhất (≈ 5–12 USD/tháng) |
| Độ phức tạp | Trung bình: bạn quản trị OS, DB, backup |
| Backup | `pg_dump` + `rsync` media + snapshot của nhà cung cấp |
| Rủi ro | Single point of failure; mất máy là mất cả app và DB |
| Phù hợp khi | Ngân sách tối thiểu và chấp nhận RTO thủ công |

### Phương án B — VPS app + PostgreSQL quản lý + object storage

```
VPS nhỏ (app + nginx)  ──TLS──►  PostgreSQL managed (backup/PITR)
        │
        └──► S3-compatible bucket (media, public read qua CDN)
```

| Tiêu chí | Đánh giá |
|---|---|
| Chi phí | Thấp–trung bình: VPS + DB tier nhỏ + vài GB object storage |
| Độ phức tạp | Trung bình: app stateless, DB do nhà cung cấp vận hành |
| Backup | DB do provider; media bật versioning; vẫn cần dump off-site định kỳ |
| Rủi ro | Phụ thuộc mạng giữa app và DB; cần `sslmode=require` |
| Phù hợp khi | Muốn giảm rủi ro mất dữ liệu mà vẫn kiểm soát server |

### Phương án C — Nền tảng container quản lý (PaaS)

```
Git push ──► build container ──► instance + managed PostgreSQL + bucket
```

| Tiêu chí | Đánh giá |
|---|---|
| Chi phí | Cao hơn A/B (≈ 7–25+ USD/tháng tuỳ instance) |
| Độ phức tạp | Thấp: TLS, deploy, rollback có sẵn |
| Backup | Phụ thuộc gói của provider; kiểm tra RPO/PITR trước khi chọn |
| Rủi ro | Persistent disk thường giới hạn/không có → nên dùng S3; ít kiểm soát OS |
| Phù hợp khi | Ưu tiên quy trình deploy đơn giản, ít vận hành |

**Không khuyến nghị** chạy Next.js + Prisma + `sharp` trên edge/serverless runtime
nếu chưa có adapter và kiểm thử riêng: `sharp`, connection pooling và tính
`force-dynamic` của CMS không tương thích mặc định.

**Đề xuất kỹ thuật (chờ duyệt):** Phương án B cho quy mô này — app không giữ
state, DB có backup tự động, media không nằm trên filesystem ephemeral. Phương
án A chỉ nên chọn nếu cam kết chạy và **diễn tập** backup/restore định kỳ.

## 3. Domain, DNS, HTTPS

1. Trỏ `A` (và `AAAA` nếu có IPv6) của domain về IP server/proxy.
2. Cấp certificate bằng ACME (Certbot/Caddy) và bật auto-renew.
3. Chỉ bật HSTS sau khi HTTPS đã ổn định; `HSTS_INCLUDE_SUBDOMAINS=true` chỉ khi
   mọi subdomain đã HTTPS.
4. `APP_URL=https://<domain>` không có dấu `/` cuối; đây là nguồn canonical/OG.
5. Kiểm tra redirect 80 → 443 và cookie `Secure` sau khi cấu hình.

## 4. Trusted proxy

`TRUSTED_PROXY_HOPS` **phải khớp topology thật**, không đặt theo mẫu:

| Topology | Giá trị | Hệ quả |
|---|---|---|
| App lộ trực tiếp | `0` | Bỏ qua XFF/X-Real-IP; mọi khách chung một bucket rate-limit |
| Một nginx/Caddy | `1` | Dùng địa chỉ proxy append vào bên phải XFF |
| CDN + nginx | `2` | Dùng địa chỉ do CDN append; CDN phải ghi đè XFF |
| Nhiều hơn | `N` | Chỉ khi kiểm soát đủ N proxy |

Proxy phải **ghi đè** `X-Forwarded-For` bằng `$remote_addr` (mẫu trong
`docs/PRODUCTION_DEPLOYMENT.md`), không nối giá trị client gửi.

## 5. Biến môi trường

Bắt buộc: `DATABASE_URL`, `APP_URL`, `AUTH_SECRET`, `TRUSTED_PROXY_HOPS`,
`STORAGE_DRIVER`, `UPLOAD_DIR` (local) hoặc `S3_*` (s3), `NODE_ENV=production`.

Tuỳ chọn: `HSTS_INCLUDE_SUBDOMAINS`, `MAX_UPLOAD_MB`, `BACKUP_DIR`,
`BACKUP_KEEP`, `MEDIA_PUBLIC_BASE_URL`.

Chỉ dùng một lần: `SETUP_TOKEN`, `SEED_ADMIN_*` — xoá sau khi tạo admin.

Kiểm tra tự động trước build:

```bash
NODE_ENV=production node scripts/preflight.mjs
```

Script không đọc `.env` và không in giá trị; lỗi → exit 1.

## 6. Firewall và mạng

| Cổng | Nguồn | Mục đích |
|---|---|---|
| 22 | IP quản trị | SSH (key-only, fail2ban nếu có) |
| 80 | 0.0.0.0/0 | ACME + redirect HTTPS |
| 443 | 0.0.0.0/0 | Site |
| 3000 | loopback | Next.js, không mở ra ngoài |
| 5432 | loopback/private subnet | PostgreSQL, không mở Internet |

## 7. Deploy, verify, rollback

```bash
# 1) chuẩn bị
npm ci
NODE_ENV=production node scripts/preflight.mjs
./scripts/backup-db.sh && # copy .dump + .sha256 off-site

# 2) database + build
npx prisma migrate deploy
npx prisma generate
npx next build

# 3) chuyển release
systemctl restart portfolio
curl -fsS https://<domain>/api/health
curl -fsS https://<domain>/api/ready
```

Rollback: giữ release directory cũ (hoặc image cũ), trỏ lại và restart; DB là
forward-only nên rollback schema = restore dump gần nhất (cần phê duyệt). Media
không xoá khi rollback.

## 8. Khoảng trống còn lại

- Chưa có Dockerfile/CI/manifest: target chưa được chọn nên chưa tạo.
- Chưa có IaC; cấu hình server phải làm theo checklist thủ công.
- Chưa có backup off-site tự động: cần cron + đích lưu trữ.
