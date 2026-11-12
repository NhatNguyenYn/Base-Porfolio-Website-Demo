import { prisma } from "@/server/db";
import { requireUser, roleLabels } from "@/server/auth";
import { changePasswordAction } from "@/server/actions/auth";
import { PageHeader } from "@/components/admin/page-header";
import { ActionForm } from "@/components/admin/action-form";
import { formatDate } from "@/lib/utils";

export default async function AccountPage() {
  const sessionUser = await requireUser();
  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  const sessionCount = await prisma.session.count({ where: { userId: sessionUser.id } });

  return (
    <>
      <PageHeader
        title="Tài khoản & mật khẩu"
        description="Thông tin đăng nhập quản trị. Chỉ tài khoản có vai trò Super Admin mới có toàn quyền."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <section className="border border-line bg-surface p-5">
          <h2 className="text-[13px] font-medium">Thông tin tài khoản</h2>
          <dl className="mt-4 divide-y divide-line text-[12.5px]">
            <div className="flex items-center justify-between gap-4 py-2.5">
              <dt className="text-muted">Tên</dt>
              <dd>{user?.name}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2.5">
              <dt className="text-muted">Email</dt>
              <dd>{user?.email}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2.5">
              <dt className="text-muted">Vai trò</dt>
              <dd>{user ? roleLabels[user.role as keyof typeof roleLabels] ?? user.role : "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2.5">
              <dt className="text-muted">Đăng nhập gần nhất</dt>
              <dd>{user?.lastLoginAt ? formatDate(user.lastLoginAt, "vi", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2.5">
              <dt className="text-muted">Phiên đang hoạt động</dt>
              <dd className="tabular-nums">{sessionCount}</dd>
            </div>
          </dl>

          <p className="mt-5 border-t border-line pt-4 text-[11px] leading-relaxed text-muted">
            Mật khẩu được lưu dưới dạng băm bcrypt (12 vòng). Phiên đăng nhập lưu trong cơ sở dữ liệu và tự
            hết hạn sau 7 ngày.
          </p>
        </section>

        <section className="border border-line bg-surface p-5">
          <h2 className="text-[13px] font-medium">Đổi mật khẩu</h2>
          <p className="mt-1 text-[11px] text-muted">
            Sau khi đổi, tất cả phiên khác (trên thiết bị khác) sẽ bị đăng xuất.
          </p>

          <div className="mt-5">
            <ActionForm action={changePasswordAction} submitLabel="Cập nhật mật khẩu">
              <div className="space-y-4">
                <div>
                  <label className="field-label" htmlFor="currentPassword">
                    Mật khẩu hiện tại
                  </label>
                  <input
                    id="currentPassword"
                    name="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    required
                    className="field"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="newPassword">
                    Mật khẩu mới
                  </label>
                  <input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={10}
                    required
                    className="field"
                    placeholder="Tối thiểu 10 ký tự, có chữ và số"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="confirmPassword">
                    Nhập lại mật khẩu mới
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={10}
                    required
                    className="field"
                  />
                </div>
              </div>
            </ActionForm>
          </div>
        </section>
      </div>
    </>
  );
}
