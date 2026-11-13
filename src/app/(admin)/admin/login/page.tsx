import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, userCount } from "@/server/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Đăng nhập quản trị",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect("/admin");

  const [{ next }, count] = await Promise.all([searchParams, userCount()]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="relative grid h-8 w-8 place-items-center border border-line-strong text-[10px] font-semibold">
            PS
            <span className="absolute -right-[2px] -top-[2px] h-1.5 w-1.5 bg-accent" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[13px] font-medium leading-tight">Portfolio Studio</p>
            <p className="text-[9px] uppercase tracking-[0.18em] text-muted">Quản trị nội dung</p>
          </div>
        </div>

        <span className="mb-5 block h-px w-10 bg-ruby" aria-hidden="true" />
        <h1 className="text-[26px] leading-tight tracking-[-0.02em]">Đăng nhập</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          Khu vực quản trị chỉ dành cho chủ sở hữu website.
        </p>

        <div className="mt-7 border border-line bg-surface p-6">
          <LoginForm nextPath={next ?? ""} />
        </div>

        {count === 0 && (
          <p className="mt-5 text-center text-[12px] text-muted">
            Chưa có tài khoản quản trị.{" "}
            <Link href="/admin/setup" className="underline underline-offset-4 hover:text-ink">
              Thiết lập tài khoản đầu tiên
            </Link>
          </p>
        )}

        <p className="mt-6 text-center text-[11px] text-muted">
          <Link href="/vi" className="hover:text-ink">
            ← Về website
          </Link>
        </p>
      </div>
    </div>
  );
}
