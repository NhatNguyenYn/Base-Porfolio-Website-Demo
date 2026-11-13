# Production Deployment — Portfolio

Hướng dẫn này mô tả cách chạy ứng dụng trên một máy chủ Linux với PostgreSQL
quản lý riêng. Mọi lệnh dưới đây đã được đối chiếu với repository hiện tại; các
hạng mục chưa có bằng chứng chạy thật được đánh dấu rõ.

## 1. Yêu cầu máy chủ

| Thành phần | Tối thiểu | Ghi chú |
|---|---|---|
| OS | Ubuntu 22.04/24.04 LTS | Bất kỳ distro có systemd |
| CPU / RAM | 1 vCPU / 1 GB | Sharp cần thêm RAM khi xử lý ảnh lớn |
| Node.js | 20 LTS trở lên | Next.js 15 yêu cầu Node ≥ 18.18; dùng 20/22 |
| PostgreSQL | 15–18 | Đã kiểm thử với PostgreSQL 18.6 |
| Disk | 10 GB + dung lượng media | Media nằm ngoài DB |
| Reverse proxy | nginx/Caddy | TLS + forwarding headers |

## 2. Runtime requirements

- `npm ci` (có `devDependencies` để build; Prisma CLI và TypeScript nằm ở dev).
- `sharp` cài qua npm, không cần build tool bổ sung trên Linux x64.
- Không chạy `next dev` trên production.

## 3. Cài đặt dependency

```bash
git clone <repo> /srv/portfolio && cd /srv/portfolio
npm ci
```

## 4. Cấu hình environment

Sao chép `.env.example` thành `.env` (quyền `600`, owner là user chạy app) và
điền giá trị thật. Không commit `.env`.

| Biến | Bắt buộc | Ghi chú production |
|---|---|---|
| `DATABASE_URL` | Có | PostgreSQL quản lý, thêm `?schema=public&connection_limit=10&sslmode=require` nếu có TLS |
| `APP_URL` | Có | `https://ten-mien.example` (dùng cho canonical, OG, sitemap) |
| `AUTH_SECRET` | Có | ≥ 32 ký tự ngẫu nhiên; dùng cho HMAC key rate-limit |
| `SETUP_TOKEN` | Chỉ lúc tạo admin đầu tiên | Production bắt buộc token; xoá sau khi tạo tài khoản |
| `TRUSTED_PROXY_HOPS` | Có | `1` với một nginx; `0` nếu app lộ trực tiếp; `2` với CDN + nginx |
| `HSTS_INCLUDE_SUBDOMAINS` | Không | `true` chỉ khi mọi subdomain đã HTTPS |
| `STORAGE_DRIVER` | Có | `local` (volume) hoặc `s3` |
| `UPLOAD_DIR` | Khi `local` | Đường dẫn tuyệt đối trên volume persistent |
| `MEDIA_PUBLIC_BASE_URL` | Khi `s3` | Base URL công khai của bucket/CDN |
| `MAX_UPLOAD_MB` | Không | Mặc định 10; phải ≤ `client_max_body_size` của proxy |
| `S3_*` | Khi `s3` | Endpoint/bucket/key; không đưa key vào client |
| `SEED_ADMIN_*` | Không | Chỉ dùng cho `npm run db:seed`; seed **không ghi đè** mật khẩu đã tồn tại |

Không có biến `NEXT_PUBLIC_*` trong dự án: không có secret nào đi vào client bundle.

Sau khi nạp environment, chạy preflight (không đọc `.env`, không in giá trị):

```bash
NODE_ENV=production node scripts/preflight.mjs
```

Script kiểm tra `APP_URL` HTTPS, độ dài `AUTH_SECRET`, chuỗi kết nối PostgreSQL,
`TRUSTED_PROXY_HOPS`, cấu hình storage, `UPLOAD_DIR` tuyệt đối và cảnh báo khi
`SEED_ADMIN_PASSWORD` vẫn là giá trị mặc định. Lỗi → exit 1, dừng deploy.

## 5. Database setup

1. Tạo database và user riêng cho ứng dụng (không dùng `postgres` superuser):

```sql
CREATE ROLE portfolio_app LOGIN PASSWORD '<random>';
CREATE DATABASE portfolio OWNER portfolio_app;
```

2. Bật TLS nếu database ở máy khác; thêm `sslmode=require` vào `DATABASE_URL`.
3. Kiểm tra kết nối: `npx prisma migrate status`.

**Lưu ý kiến trúc:** bản development dùng embedded PostgreSQL trên
`127.0.0.1:5433`. Đây **không phải** cấu hình production; production phải dùng
PostgreSQL service riêng, có backup và giám sát.

## 6. Migration

```bash
NODE_ENV=production node scripts/preflight.mjs
npx prisma migrate deploy
```

- Repo có 2 migration (`init_postgres`, `role_admin`), schema hiện khớp
  (`prisma migrate status` báo up to date).
- Migration là **forward-only**; rollback = restore backup (mục 12).
- `npm run build` hiện có sẵn `prisma migrate deploy`. Trên production nên chạy
  migrate như một bước riêng có kiểm soát, sau khi đã backup, rồi mới build:

```bash
./scripts/backup-db.sh
npx prisma migrate deploy
npx prisma generate && npx next build
```

Không chạy migration phá huỷ dữ liệu khi chưa có backup và xác nhận.

## 7. Build

```bash
npx prisma generate
npx next build
```

Build cần `NODE_ENV=production` và đủ biến môi trường đọc lúc build (`APP_URL`,
`S3_PUBLIC_BASE_URL` nếu dùng S3).

## 8. Start

```bash
NODE_ENV=production PORT=3000 npm run start
```

Chạy dưới systemd (ví dụ `/etc/systemd/system/portfolio.service`):

```ini
[Unit]
Description=Portfolio (Next.js)
After=network.target

[Service]
Type=simple
User=portfolio
WorkingDirectory=/srv/portfolio
EnvironmentFile=/srv/portfolio/.env
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
KillSignal=SIGINT
TimeoutStopSec=30
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

## 9. Reverse proxy (nginx)

```nginx
server {
  listen 80;
  server_name ten-mien.example;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name ten-mien.example;

  ssl_certificate     /etc/letsencrypt/live/ten-mien.example/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/ten-mien.example/privkey.pem;

  client_max_body_size 12m;   # khớp bodySizeLimit của Server Actions

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    # Ghi đè, không nối thêm giá trị client gửi:
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_read_timeout 60s;
  }

  location /_next/static/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_cache_valid 200 365d;
    add_header Cache-Control "public, max-age=31536000, immutable";
  }
}
```

- Với đúng cấu hình trên, đặt `TRUSTED_PROXY_HOPS=1`.
- Nếu có CDN phía trước, **không** để CDN nối XFF tuỳ ý; cấu hình CDN ghi đè
  `X-Forwarded-For` bằng IP người dùng, hoặc tăng hops tương ứng số proxy bạn
  kiểm soát.
- Không đặt `Content-Security-Policy` hay `X-Frame-Options` ở proxy: ứng dụng đã
  gửi các header này, đặt thêm sẽ tạo header trùng.

## 10. HTTPS

Dùng Certbot/ACME. Chỉ bật HSTS khi HTTPS đã hoạt động ổn định. Ứng dụng gửi
`Strict-Transport-Security: max-age=63072000` khi `NODE_ENV=production`;
`includeSubDomains` chỉ bật qua `HSTS_INCLUDE_SUBDOMAINS=true` sau khi rà soát
toàn bộ subdomain. Không thêm `preload` từ code.

## 11. Persistent storage

- `STORAGE_DRIVER=local`: `UPLOAD_DIR` phải là **đường dẫn tuyệt đối** trên
  volume persistent (không nằm trong thư mục build, không dùng filesystem tạm
  của container). Mount ví dụ `/var/lib/portfolio/uploads`, cấp quyền cho user
  chạy app. Preflight từ chối đường dẫn tương đối.
- `STORAGE_DRIVER=s3`: bucket riêng, không public-write; `MEDIA_PUBLIC_BASE_URL`
  trỏ CDN/bucket; cấu hình CORS chỉ cho domain site nếu cần. Credential cần
  `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` và `s3:ListBucket` — readiness
  gọi `HeadBucket`, nên policy chỉ ghi sẽ làm `/api/ready` trả 503.
- Media **không** nằm trong backup database; phải backup/sync riêng (rsync hoặc
  versioning của bucket).
- URL media hiện tại là `/media/<key>`; đổi driver không đổi URL khi dùng
  `MEDIA_PUBLIC_BASE_URL` phù hợp.

## 12. Backup & restore

Thiết kế cho quy mô portfolio: DB ~10 MB.

| Hạng mục | Giá trị đề xuất |
|---|---|
| RPO | 24 giờ (backup hằng ngày); chấp nhận mất tối đa 1 ngày nội dung |
| RTO | ≤ 2 giờ (restore + migrate + khởi động + kiểm tra) |
| Retention local | 14 bản (`BACKUP_KEEP=14`) |
| Off-site | Copy `.dump` + `.sha256` sang object storage/ máy khác mỗi ngày |

Cron ví dụ:

```cron
15 2 * * * cd /srv/portfolio && DATABASE_URL="$(grep '^DATABASE_URL=' .env | cut -d= -f2-)" BACKUP_DIR=/var/backups/portfolio ./scripts/backup-db.sh >> /var/log/portfolio-backup.log 2>&1
```

Yêu cầu công cụ: `pg_dump` và `pg_restore` phải có trong PATH (gói
`postgresql-client` trên Debian/Ubuntu). Máy phát triển Windows hiện tại không
có hai công cụ này, nên Phase 5 **chưa thể diễn tập restore**; script dừng với
`pg_dump not found in PATH` thay vì tạo backup rỗng.

Script `scripts/backup-db.sh` chỉ đọc DB, tạo dump custom-format + SHA-256, xoá
bản cũ theo retention. `scripts/restore-db.sh` yêu cầu `CONFIRM_RESTORE=yes`,
kiểm tra checksum, rồi `pg_restore --clean --if-exists`.

**Kiểm tra restore định kỳ** (bắt buộc, trên staging/DB tạm):

```bash
createdb portfolio_restore_test
CONFIRM_RESTORE=yes DATABASE_URL="postgresql://.../portfolio_restore_test" \
  ./scripts/restore-db.sh /var/backups/portfolio/portfolio-....dump
npx prisma migrate status
```

Sau restore: mở `/vi`, `/admin/login`, `/api/ready`, đăng nhập thử, kiểm tra số
lượng bài viết/media.

## 13. Monitoring

- `GET /api/health` — liveness, không chạm DB; dùng cho process supervisor.
- `GET /api/ready` — kiểm tra DB (`SELECT 1`) và thư mục upload (local); trả 503
  khi chưa sẵn sàng. Không trả host/DSN/đường dẫn.
- Log: một dòng JSON mỗi sự kiện (`ts`, `level`, `event`, `requestId`, `route`,
  `status`, `durationMs`). Không log body, cookie, token hay mật khẩu.
- Log rotation: dùng `logrotate` cho file stdout của systemd hoặc `journald`
  (`SystemMaxUse=500M`). Ứng dụng không tự ghi file log.
- Cảnh báo tối thiểu: `/api/ready` fail 2 lần liên tiếp; tỷ lệ 5xx tăng; backup
  cron không chạy; dung lượng disk > 85%.
- CSP violation hiện chỉ hiện ở console trình duyệt (Report-Only). Muốn thu thập
  tập trung cần thêm endpoint reporting (chưa triển khai).

## 14. Troubleshooting

| Triệu chứng | Nguyên nhân thường gặp | Xử lý |
|---|---|---|
| `/api/ready` 503, `database: unavailable` | DB down/sai DSN/SSL | `prisma migrate status`; kiểm tra firewall, `sslmode` |
| `/api/ready` 503, `storage: unavailable` | Volume chưa mount, sai quyền | `ls -ld $UPLOAD_DIR`, `chown` user chạy app |
| Trang public hiện "Tạm thời gián đoạn" | Query settings lỗi | Xem log `[site-context]`; DB/role quyền SELECT |
| API 503 JSON | `SERVICE_UNAVAILABLE` do DB | Khôi phục DB; không cần restart app |
| Login xong quay lại trang login | Cookie `Secure` nhưng truy cập HTTP | Kết thúc TLS tại proxy, dùng HTTPS |
| Rate limit chặn nhầm toàn bộ | `TRUSTED_PROXY_HOPS=0` hoặc proxy không gửi XFF | Đặt hops đúng, cấu hình XFF |
| 413 khi upload | `client_max_body_size` nhỏ hơn `MAX_UPLOAD_MB` | Tăng giới hạn proxy |
| CSP báo lỗi inline script | Script mới thiếu nonce | Truyền `nonce` từ `headers().get("x-nonce")` |

## 15. Rollback

1. **Code:** giữ bản build trước (release directory hoặc container image cũ),
   trỏ lại và restart; `next build` là bất biến theo release.
2. **Database:** migration forward-only → rollback bằng restore bản dump gần
   nhất, sau đó chạy `prisma migrate deploy` cho đúng phiên bản.
3. **Media:** không xoá file khi rollback; key UUID ổn định giữa các phiên bản.
4. Sau rollback: kiểm tra `/api/health`, `/api/ready`, `/vi`, đăng nhập admin.

## 16. Release process

1. Xác nhận release gate trong `docs/PRODUCTION_CHECKLIST.md`.
2. Backup: `./scripts/backup-db.sh`, copy off-site, ghi lại tên file.
3. `npx prisma migrate deploy` (chỉ migration đã review).
4. `npx prisma generate && npx next build`.
5. Restart service (`systemctl restart portfolio`).
6. Kiểm tra `/api/health`, `/api/ready`, `/vi`, `/admin/login`, `/api/articles`.
7. Theo dõi 30 phút / 24 giờ / 72 giờ; ghi vào `docs/POST_DEPLOYMENT_REPORT.md`.

Không deploy khi thiếu backup hoặc khi gate còn BLOCKED.

## 17. Incident response

| Mức | Ví dụ | Hành động |
|---|---|---|
| SEV-1 | Site down, DB hỏng, mất dữ liệu | Dừng thay đổi, kiểm tra `/api/ready`, rollback code nếu lỗi mới; restore DB chỉ khi có phê duyệt |
| SEV-2 | Upload lỗi, login lỗi một phần | Kiểm tra log JSON theo `requestId`, disk/quyền upload, DB latency |
| SEV-3 | CSP violation, cảnh báo dependency | Ghi nhận, xử lý trong bản vá kế tiếp |

Quy tắc: không sửa production bằng tay ngoài quy trình; mọi thay đổi phải có
backup và đường rollback. Không xoá log/không reset DB để "thử".

## 18. Dependency & security maintenance

- Chạy `npm audit --omit=dev` mỗi tháng; đánh giá advisory build-time riêng.
- Nâng cấp minor/patch hàng tháng, major theo kế hoạch có nhánh thử.
- Luôn pin `package-lock.json`; deploy bằng `npm ci`.
- Rà soát `.env` khi thay đổi hạ tầng; không thêm biến vào client bundle.
- Định kỳ kiểm tra CSP report, rate-limit, log 401/403 bất thường.

## 19. Admin account & seed password

Seed chỉ dùng một lần và **không ghi đè** mật khẩu của user đã tồn tại. Không
chạy lại seed để đổi mật khẩu.

Quy trình rotation (chỉ sau khi chủ dự án phê duyệt):

1. Bảo đảm có backup DB hợp lệ và biết cách restore.
2. Đăng nhập `/admin` bằng tài khoản hiện tại.
3. Đổi mật khẩu trong trang tài khoản; thao tác này thu hồi mọi session khác.
4. Đăng xuất, đăng nhập lại bằng mật khẩu mới; kiểm tra quyền SUPER_ADMIN.
5. Xoá `SEED_ADMIN_PASSWORD` (và `SETUP_TOKEN` nếu còn) khỏi environment,
   restart app.
6. Ghi thời điểm rotation vào `docs/POST_DEPLOYMENT_REPORT.md` (không ghi mật khẩu).

Rollback: chỉ restore user từ bản dump trước rotation khi thật sự cần; việc này
làm mật khẩu cũ hoạt động lại, nên phải đổi lại ngay sau đó.

## 20. CSP

Hiện tại ứng dụng gửi `Content-Security-Policy-Report-Only` (nonce theo request).
Phase 2 kết luận **CONDITIONAL**: chưa đủ dữ liệu để enforce. Khi có báo cáo
violation từ production: đổi header sang `Content-Security-Policy` trong
`src/middleware.ts` (giữ nguyên nonce, không thêm `unsafe-inline` cho script),
test lại toàn bộ luồng CMS/upload/preview trước khi phát hành.
