import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  Eye,
  FolderOpen,
  Frame,
  Image as ImageIcon,
  Mail,
  Plus,
} from "lucide-react";
import { getDashboardData } from "@/server/queries/dashboard";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatDate, formatShortDate } from "@/lib/utils";

export default async function DashboardPage() {
  const data = await getDashboardData();

  const stats = [
    {
      label: "Bài viết",
      value: data.counts.articles,
      note: `${data.counts.publishedArticles} đã xuất bản · ${data.counts.drafts} bản nháp`,
      href: "/admin/blog",
      icon: BookOpen,
    },
    {
      label: "Dự án",
      value: data.counts.projects,
      note: "Bao gồm cả chưa công khai",
      href: "/admin/projects",
      icon: FolderOpen,
    },
    {
      label: "Tác phẩm",
      value: data.counts.artworks,
      note: `${data.counts.collections} bộ sưu tập`,
      href: "/admin/art",
      icon: Frame,
    },
    {
      label: "Tin nhắn",
      value: data.counts.messages,
      note: `${data.counts.unreadMessages} chưa đọc`,
      href: "/admin/messages",
      icon: Mail,
    },
    {
      label: "Ảnh trong thư viện",
      value: data.counts.media,
      note: "Ảnh đã tải lên",
      href: "/admin/media",
      icon: ImageIcon,
    },
  ];

  return (
    <>
      <PageHeader
        title="Tổng quan"
        description="Tình trạng nội dung thật trong cơ sở dữ liệu. Không có số liệu mô phỏng ở đây."
        actions={
          <>
            <Link href="/admin/blog/new" className="btn btn-outline btn-sm">
              <Plus size={12} aria-hidden="true" />
              Bài viết mới
            </Link>
            <Link href="/admin/art/new" className="btn btn-primary btn-sm">
              <Plus size={12} aria-hidden="true" />
              Tải tác phẩm
            </Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="group border border-line bg-surface p-4 transition-colors hover:border-line-strong"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.14em] text-muted">{stat.label}</span>
                <Icon size={14} strokeWidth={1.5} className="text-muted transition-colors group-hover:text-accent" aria-hidden="true" />
              </div>
              <p className="mt-3 text-[28px] leading-none tabular-nums tracking-tight">{stat.value}</p>
              <p className="mt-2 text-[10.5px] text-muted">{stat.note}</p>
            </Link>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 border border-line bg-surface px-4 py-3">
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <Eye size={13} aria-hidden="true" />
          Lượt xem nội dung (đếm thật khi khách mở trang):
        </div>
        <span className="text-[12px] tabular-nums">
          Bài viết <strong className="font-medium">{data.views.articles.toLocaleString("vi-VN")}</strong>
        </span>
        <span className="text-[12px] tabular-nums">
          Tác phẩm <strong className="font-medium">{data.views.artworks.toLocaleString("vi-VN")}</strong>
        </span>
        <span className="ml-auto text-[10.5px] text-muted">
          Chưa có tracking cho trang chủ — không hiển thị số liệu ước lượng.
        </span>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-[13px] font-medium">Bài viết cập nhật gần đây</h2>
            <Link href="/admin/blog" className="text-[11px] text-muted hover:text-ink">
              Xem tất cả
            </Link>
          </div>
          {data.recentArticles.length === 0 ? (
            <p className="px-4 py-10 text-center text-[12px] text-muted">Chưa có bài viết nào.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.recentArticles.map((article) => (
                <li key={article.id}>
                  <Link
                    href={`/admin/blog/${article.id}`}
                    className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-surface-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px]">{article.title}</p>
                      <p className="mt-0.5 text-[10.5px] text-muted">
                        Cập nhật {formatDate(article.updatedAt, "vi")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={article.status} />
                      <ArrowUpRight size={13} className="text-muted" aria-hidden="true" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border border-line bg-surface">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-[13px] font-medium">Hoạt động quản trị gần đây</h2>
          </div>
          {data.activity.length === 0 ? (
            <p className="px-4 py-10 text-center text-[12px] text-muted">Chưa có hoạt động nào.</p>
          ) : (
            <ol className="divide-y divide-line">
              {data.activity.map((entry) => (
                <li key={entry.id} className="px-4 py-3">
                  <p className="text-[12px] leading-relaxed">{entry.summary}</p>
                  <p className="mt-1 text-[10px] text-muted">
                    {entry.user?.name ?? "Hệ thống"} · {formatShortDate(entry.createdAt, "vi")}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-[13px] font-medium">Tin nhắn mới</h2>
            <Link href="/admin/messages" className="text-[11px] text-muted hover:text-ink">
              Hộp thư
            </Link>
          </div>
          {data.recentMessages.length === 0 ? (
            <p className="px-4 py-10 text-center text-[12px] text-muted">Chưa có tin nhắn nào.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.recentMessages.map((message) => (
                <li key={message.id}>
                  <Link
                    href={`/admin/messages?focus=${message.id}`}
                    className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-surface-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px]">
                        {message.subject}
                        <span className="ml-2 text-[10.5px] text-muted">{message.name}</span>
                      </p>
                      <p className="mt-0.5 text-[10.5px] text-muted">{formatShortDate(message.createdAt, "vi")}</p>
                    </div>
                    <StatusBadge status={message.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border border-line bg-surface p-4">
          <h2 className="text-[13px] font-medium">Việc nên làm tiếp</h2>
          <ul className="mt-3 space-y-2 text-[12px]">
            <li className="flex items-center gap-2 text-muted">
              <span className="h-1 w-1 bg-accent" aria-hidden="true" />
              Thay nội dung minh hoạ bằng thông tin thật trong{" "}
              <Link href="/admin/profile" className="text-ink underline underline-offset-2">
                Hồ sơ
              </Link>
            </li>
            <li className="flex items-center gap-2 text-muted">
              <span className="h-1 w-1 bg-accent" aria-hidden="true" />
              Cập nhật logo, favicon và SEO trong{" "}
              <Link href="/admin/settings" className="text-ink underline underline-offset-2">
                Cài đặt
              </Link>
            </li>
            <li className="flex items-center gap-2 text-muted">
              <span className="h-1 w-1 bg-accent" aria-hidden="true" />
              Đổi mật khẩu quản trị mặc định trong{" "}
              <Link href="/admin/account" className="text-ink underline underline-offset-2">
                Tài khoản
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}
