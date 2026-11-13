import type { Metadata } from "next";
import { prisma } from "@/server/db";
import { requireSuperAdmin, roleLabels, type Role } from "@/server/auth";
import { createUserAction, toggleUserActiveAction, updateUserRoleAction } from "@/server/actions/users";
import { PageHeader } from "@/components/admin/page-header";
import { ActionForm } from "@/components/admin/action-form";
import { Flash } from "@/components/admin/flash";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Người dùng — Quản trị", robots: { index: false, follow: false } };

const ERROR_TEXT: Record<string, string> = {
  self: "Bạn không thể tự đổi vai trò hoặc vô hiệu hoá chính mình.",
  "last-super": "Cần giữ ít nhất một SUPER_ADMIN đang hoạt động.",
  invalid: "Dữ liệu không hợp lệ.",
  missing: "Không tìm thấy người dùng.",
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string; error?: string }>;
}) {
  const actor = await requireSuperAdmin();
  const query = await searchParams;

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      _count: { select: { sessions: true, articles: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Người dùng quản trị"
        description="Chỉ SUPER_ADMIN thấy trang này. Mọi thay đổi vai trò được kiểm tra phía server và ghi vào nhật ký hoạt động."
      />

      {query.updated && <Flash message="Đã cập nhật người dùng." />}
      {query.error && (
        <div role="alert" className="mb-6 border-l-2 border-danger bg-danger-soft px-4 py-3 text-[12.5px] text-danger">
          {ERROR_TEXT[query.error] ?? "Không thể hoàn tất thao tác."}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="border border-line bg-surface">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-[14px] tracking-tight">Tài khoản ({users.length})</h2>
          </div>
          <ul className="divide-y divide-line">
            {users.map((user) => {
              const isSelf = user.id === actor.id;
              return (
                <li key={user.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">
                        {user.name} {isSelf && <span className="text-muted">(bạn)</span>}
                      </p>
                      <p className="truncate text-[11.5px] text-muted">{user.email}</p>
                      <p className="mt-1 text-[10.5px] text-muted">
                        Tạo {formatDate(user.createdAt, "vi")} · Đăng nhập gần nhất{" "}
                        {user.lastLoginAt ? formatDate(user.lastLoginAt, "vi") : "chưa"} · {user._count.sessions} phiên ·{" "}
                        {user._count.articles} bài viết
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={user.isActive ? "active" : "inactive"} />
                      <StatusBadge status={user.role} />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    <form action={updateUserRoleAction} className="flex items-end gap-2">
                      <input type="hidden" name="id" value={user.id} />
                      <label className="flex flex-col gap-1">
                        <span className="text-[9.5px] uppercase tracking-[0.14em] text-muted">Vai trò</span>
                        <select name="role" defaultValue={user.role} className="field h-8 py-0 text-[12px]" disabled={isSelf}>
                          {(Object.keys(roleLabels) as Role[]).map((role) => (
                            <option key={role} value={role}>
                              {roleLabels[role]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button type="submit" className="btn btn-outline btn-sm" disabled={isSelf}>
                        Lưu
                      </button>
                    </form>

                    <form action={toggleUserActiveAction}>
                      <input type="hidden" name="id" value={user.id} />
                      <button type="submit" className="btn btn-outline btn-sm" disabled={isSelf}>
                        {user.isActive ? "Vô hiệu hoá" : "Kích hoạt"}
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="border border-line bg-surface p-5">
          <h2 className="text-[14px] tracking-tight">Thêm tài khoản</h2>
          <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
            Mật khẩu tối thiểu 10 ký tự, có chữ và số. Tài khoản mới không tự động nhận email.
          </p>

          <ActionForm
            action={createUserAction}
            submitLabel="Tạo tài khoản"
            resetOnSuccess
            className="mt-5"
            footer={null}
          >
            <div className="grid gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="label">Tên</span>
                <input name="name" required maxLength={80} className="field" autoComplete="off" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="label">Email</span>
                <input name="email" type="email" required maxLength={160} className="field" autoComplete="off" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="label">Mật khẩu ban đầu</span>
                <input name="password" type="password" required minLength={10} maxLength={200} className="field" autoComplete="new-password" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="label">Vai trò</span>
                <select name="role" defaultValue="ADMIN" className="field">
                  <option value="ADMIN">{roleLabels.ADMIN} — nội dung &amp; tin nhắn</option>
                  <option value="SUPER_ADMIN">{roleLabels.SUPER_ADMIN} — toàn quyền</option>
                </select>
              </label>
            </div>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
