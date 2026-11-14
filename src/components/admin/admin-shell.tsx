"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BookOpen,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  ExternalLink,
  FolderOpen,
  Frame,
  Image as ImageIcon,
  KeyRound,
  Layers,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Settings,
  Tags,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { logoutAction } from "@/server/actions/auth";
import type { SessionUser } from "@/server/auth";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Tổng quan", icon: LayoutDashboard, exact: true },
  { href: "/admin/profile", label: "Hồ sơ", icon: UserRound },
  { href: "/admin/projects", label: "Dự án", icon: FolderOpen },
  { href: "/admin/art", label: "Tác phẩm", icon: Frame },
  { href: "/admin/art/collections", label: "Bộ sưu tập", icon: Layers },
  { href: "/admin/blog", label: "Bài viết", icon: BookOpen },
  { href: "/admin/taxonomy", label: "Danh mục & thẻ", icon: Tags },
  { href: "/admin/media", label: "Thư viện ảnh", icon: ImageIcon },
  { href: "/admin/messages", label: "Tin nhắn", icon: Mail },
  { href: "/admin/surveys", label: "Khảo sát", icon: ClipboardList },
  { href: "/admin/bookings", label: "Đặt lịch", icon: CalendarDays },
  { href: "/admin/schedule-import", label: "Nhập lịch", icon: CalendarClock },
  { href: "/admin/settings", label: "Cài đặt", icon: Settings, superOnly: true },
  { href: "/admin/users", label: "Người dùng", icon: Users, superOnly: true },
  { href: "/admin/account", label: "Tài khoản", icon: KeyRound },
];

const TITLES: Record<string, string> = {
  "/admin": "Tổng quan",
  "/admin/profile": "Hồ sơ cá nhân",
  "/admin/projects": "Dự án",
  "/admin/projects/new": "Dự án mới",
  "/admin/art": "Tác phẩm",
  "/admin/art/new": "Tác phẩm mới",
  "/admin/art/collections": "Bộ sưu tập",
  "/admin/blog": "Bài viết",
  "/admin/blog/new": "Bài viết mới",
  "/admin/taxonomy": "Danh mục & thẻ",
  "/admin/media": "Thư viện ảnh",
  "/admin/messages": "Tin nhắn liên hệ",
  "/admin/surveys": "Khảo sát",
  "/admin/bookings": "Đặt lịch",
  "/admin/schedule-import": "Nhập lịch",
  "/admin/settings": "Cài đặt website",
  "/admin/users": "Người dùng quản trị",
  "/admin/account": "Tài khoản & mật khẩu",
};

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({
  user,
  unread,
  siteName,
  children,
}: {
  user: SessionUser;
  unread: number;
  siteName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "/admin";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const title =
    TITLES[pathname] ??
    (pathname.startsWith("/admin/surveys/")
      ? "Chỉnh sửa khảo sát"
      : pathname.startsWith("/admin/bookings/")
        ? "Đặt lịch"
        : pathname.startsWith("/admin/schedule-import/")
          ? "Nhập lịch"
        : pathname.startsWith("/admin/projects/")
      ? "Chỉnh sửa dự án"
      : pathname.startsWith("/admin/blog/")
        ? "Chỉnh sửa bài viết"
        : pathname.startsWith("/admin/art/")
          ? "Chỉnh sửa tác phẩm"
          : "Quản trị");

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-[60px] items-center gap-2.5 border-b border-line px-5">
        <span className="relative grid h-7 w-7 place-items-center border border-line-strong text-[10px] font-semibold">
          PS
          <span className="absolute -right-[2px] -top-[2px] h-1.5 w-1.5 bg-accent" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[12px] font-medium leading-tight">{siteName}</p>
          <p className="text-[9px] uppercase tracking-[0.16em] text-muted">Quản trị</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="ml-auto grid h-7 w-7 place-items-center rounded-full border border-line text-muted lg:hidden"
          aria-label="Đóng menu"
        >
          <X size={13} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Điều hướng quản trị">
        <ul className="space-y-0.5">
          {NAV.filter((item) => !("superOnly" in item && item.superOnly) || user.role === "SUPER_ADMIN").map((item) => {
            const active = isActive(pathname, item.href, item.exact);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-[2px] px-3 py-2 text-[12.5px] transition-colors",
                    active ? "bg-primary text-primary-fg" : "text-muted hover:bg-surface-muted hover:text-ink",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon size={15} strokeWidth={1.6} aria-hidden="true" />
                  <span className="flex-1">{item.label}</span>
                  {item.href === "/admin/messages" && unread > 0 && (
                    <span
                      className={cn(
                        "grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[9px] font-medium tabular-nums",
                        active ? "bg-primary-fg text-primary" : "bg-accent text-white",
                      )}
                    >
                      {unread}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-line p-3">
        <Link
          href="/vi"
          target="_blank"
          className="flex items-center gap-3 rounded-[2px] px-3 py-2 text-[12px] text-muted transition-colors hover:bg-surface-muted hover:text-ink"
        >
          <ExternalLink size={14} strokeWidth={1.6} aria-hidden="true" />
          Xem website
        </Link>
        <div className="mt-2 flex items-center gap-2.5 border-t border-line px-3 pt-3">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-accent-soft text-[11px] font-medium text-accent">
            {user.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium">{user.name}</p>
            <p className="truncate text-[10px] text-muted">{user.email}</p>
          </div>
        </div>
        <form action={logoutAction} className="mt-2">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-[2px] px-3 py-2 text-[12px] text-muted transition-colors hover:bg-surface-muted hover:text-ink"
          >
            <LogOut size={14} strokeWidth={1.6} aria-hidden="true" />
            Đăng xuất
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="lg:grid lg:grid-cols-[248px_1fr]">
        <aside className="sticky top-0 hidden h-screen border-r border-line bg-surface lg:block">{sidebar}</aside>

        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/40"
              role="presentation"
              onClick={() => setOpen(false)}
            />
            <aside className="relative h-full w-[264px] border-r border-line bg-surface shadow-xl">{sidebar}</aside>
          </div>
        )}

        <div className="min-w-0">
          <header className="sticky top-0 z-30 flex h-[60px] items-center gap-3 border-b border-line bg-background/92 px-4 backdrop-blur-md sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="grid h-8 w-8 place-items-center rounded-full border border-line text-muted lg:hidden"
              aria-label="Mở menu"
            >
              <Menu size={15} />
            </button>

            <div className="min-w-0">
              <nav className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted" aria-label="Breadcrumb">
                <Link href="/admin" className="hover:text-ink">
                  Quản trị
                </Link>
                {pathname !== "/admin" && (
                  <>
                    <span aria-hidden="true">/</span>
                    <span className="truncate text-ink">{title}</span>
                  </>
                )}
              </nav>
              <p className="mt-0.5 truncate text-[13px] font-medium tracking-tight">{title}</p>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Link href="/vi" target="_blank" className="btn btn-outline btn-sm hidden sm:inline-flex">
                <ExternalLink size={12} aria-hidden="true" />
                Website
              </Link>
              <span className="hidden text-[11px] text-muted md:block">
                {user.name} · {user.role === "SUPER_ADMIN" ? "Super admin" : "Editor"}
              </span>
            </div>
          </header>

          <main className="px-4 py-7 sm:px-6 lg:px-8 lg:py-9">{children}</main>
        </div>
      </div>
    </div>
  );
}
