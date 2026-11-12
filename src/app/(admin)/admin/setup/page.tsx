import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { userCount } from "@/server/auth";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = {
  title: "Thiết lập quản trị",
  robots: { index: false, follow: false },
};

export default async function SetupPage() {
  const count = await userCount();
  if (count > 0) redirect("/admin/login");

  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "";
  const hostname = host.split(":")[0]?.toLowerCase();
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  const setupToken = process.env.SETUP_TOKEN ?? "";

  if (!setupToken && !isLocal) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md border border-line bg-surface p-8">
          <h1 className="text-xl tracking-tight">Thiết lập bị khoá</h1>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            Trang thiết lập đầu tiên chỉ mở từ localhost. Để thiết lập từ xa, hãy đặt biến môi trường{" "}
            <code className="bg-surface-muted px-1">SETUP_TOKEN</code> và tải lại trang này. Sau khi tạo tài khoản,
            hãy xoá biến đó.
          </p>
          <Link href="/admin/login" className="btn btn-outline mt-6">
            Về trang đăng nhập
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <p className="text-[9px] uppercase tracking-[0.18em] text-muted">Thiết lập lần đầu</p>
          <h1 className="mt-2 text-[26px] leading-tight tracking-[-0.02em]">Tạo tài khoản quản trị</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            Tài khoản này có toàn quyền quản trị. Mật khẩu được băm bằng bcrypt trước khi lưu.
          </p>
        </div>

        <div className="border border-line bg-surface p-6">
          <SetupForm requiresToken={Boolean(setupToken)} />
        </div>
      </div>
    </div>
  );
}
