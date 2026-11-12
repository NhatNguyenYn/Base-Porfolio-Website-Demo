import Link from "next/link";
import type { Education, EducationTranslation, Experience, ExperienceTranslation, Skill, SocialLink } from "@prisma/client";
import {
  deleteEducationAction,
  deleteExperienceAction,
  deleteSkillAction,
  deleteSocialLinkAction,
  saveEducationAction,
  saveExperienceAction,
  saveSkillAction,
  saveSocialLinkAction,
} from "@/server/actions/profile";
import { ActionForm } from "./action-form";
import { ConfirmSubmit } from "./confirm-submit";

type EducationRow = Education & { translations: EducationTranslation[] };
type ExperienceRow = Experience & { translations: ExperienceTranslation[] };

function SectionShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-line bg-surface">
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-[13px] font-medium">{title}</h2>
        <p className="mt-0.5 text-[11px] text-muted">{description}</p>
      </div>
      <div className="space-y-5 p-5">{children}</div>
    </section>
  );
}

export function EducationSection({
  rows,
  editing,
}: {
  rows: EducationRow[];
  editing?: EducationRow | null;
}) {
  const vi = editing?.translations.find((item) => item.locale === "vi");
  const en = editing?.translations.find((item) => item.locale === "en");

  return (
    <SectionShell title="Học vấn" description="Hiển thị trong trang Giới thiệu và hành trình nghề nghiệp.">
      <ActionForm
        action={saveEducationAction}
        submitLabel={editing ? "Lưu học vấn" : "Thêm học vấn"}
        resetOnSuccess={!editing}
      >
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label">Tổ chức / trường</label>
              <input name="institution" defaultValue={editing?.institution ?? ""} required className="field" />
            </div>
            <div>
              <label className="field-label">Địa điểm</label>
              <input name="location" defaultValue={editing?.location ?? ""} className="field" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Từ năm</label>
                <input
                  name="startYear"
                  type="number"
                  min={1950}
                  max={2100}
                  defaultValue={editing?.startYear ?? new Date().getFullYear()}
                  required
                  className="field"
                />
              </div>
              <div>
                <label className="field-label">Đến năm</label>
                <input
                  name="endYear"
                  type="number"
                  min={1950}
                  max={2100}
                  defaultValue={editing?.endYear ?? ""}
                  className="field"
                />
              </div>
            </div>
            <div className="flex flex-col justify-end gap-2">
              <label className="flex items-center gap-2 text-[11.5px]">
                <input type="checkbox" name="isCurrent" defaultChecked={editing?.isCurrent ?? false} className="h-3.5 w-3.5 accent-[var(--accent)]" />
                Đang theo học
              </label>
              <label className="flex items-center gap-2 text-[11.5px]">
                <input type="checkbox" name="visible" defaultChecked={editing?.visible ?? true} className="h-3.5 w-3.5 accent-[var(--accent)]" />
                Hiển thị công khai
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted">Tiếng Việt</p>
            <input name="vi.degree" defaultValue={vi?.degree ?? ""} placeholder="Bằng cấp (VI)" className="field" />
            <input name="vi.field" defaultValue={vi?.field ?? ""} placeholder="Ngành học (VI)" className="field" />
            <textarea name="vi.description" defaultValue={vi?.description ?? ""} rows={3} placeholder="Mô tả (VI)" className="field" />
          </div>
          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted">English</p>
            <input name="en.degree" defaultValue={en?.degree ?? ""} placeholder="Degree (EN)" className="field" />
            <input name="en.field" defaultValue={en?.field ?? ""} placeholder="Field (EN)" className="field" />
            <textarea name="en.description" defaultValue={en?.description ?? ""} rows={3} placeholder="Description (EN)" className="field" />
          </div>

          <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label">Thứ tự</label>
              <input name="order" type="number" min={0} max={999} defaultValue={editing?.order ?? 0} className="field" />
            </div>
            {editing && (
              <div className="flex items-end">
                <Link href="/admin/profile" className="text-[11px] text-muted underline underline-offset-4 hover:text-ink">
                  Huỷ chỉnh sửa
                </Link>
              </div>
            )}
          </div>
        </div>
      </ActionForm>

      {rows.length > 0 && (
        <ul className="divide-y divide-line border-t border-line pt-2">
          {rows.map((row) => {
            const translation = row.translations.find((item) => item.locale === "vi");
            return (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-[12.5px]">{row.institution}</p>
                  <p className="text-[10.5px] text-muted">
                    {[translation?.degree, translation?.field].filter(Boolean).join(" · ")} · {row.startYear}–
                    {row.isCurrent ? "nay" : row.endYear ?? "—"}
                    {row.visible ? "" : " · đang ẩn"}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/admin/profile?editEducation=${row.id}`}
                    className="rounded-full border border-line px-2.5 py-1 text-[10.5px] text-muted hover:border-ink hover:text-ink"
                  >
                    Sửa
                  </Link>
                  <form action={deleteEducationAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <ConfirmSubmit
                      title="Xoá mục học vấn này?"
                      description="Hành động này xoá vĩnh viễn mục học vấn khỏi cơ sở dữ liệu."
                      triggerLabel="Xoá"
                      confirmLabel="Xoá"
                    />
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionShell>
  );
}

export function ExperienceSection({
  rows,
  editing,
}: {
  rows: ExperienceRow[];
  editing?: ExperienceRow | null;
}) {
  const vi = editing?.translations.find((item) => item.locale === "vi");
  const en = editing?.translations.find((item) => item.locale === "en");
  const toDate = (value: Date | null | undefined) => (value ? value.toISOString().slice(0, 10) : "");

  return (
    <SectionShell title="Kinh nghiệm" description="Mỗi mục có vai trò, mô tả và danh sách thành tựu.">
      <ActionForm
        action={saveExperienceAction}
        submitLabel={editing ? "Lưu kinh nghiệm" : "Thêm kinh nghiệm"}
        resetOnSuccess={!editing}
      >
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label">Công ty</label>
            <input name="company" defaultValue={editing?.company ?? ""} required className="field" />
          </div>
          <div>
            <label className="field-label">Địa điểm</label>
            <input name="location" defaultValue={editing?.location ?? ""} className="field" />
          </div>
          <div>
            <label className="field-label">Bắt đầu</label>
            <input name="startDate" type="date" defaultValue={toDate(editing?.startDate)} required className="field" />
          </div>
          <div>
            <label className="field-label">Kết thúc</label>
            <input name="endDate" type="date" defaultValue={toDate(editing?.endDate)} className="field" />
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted">Tiếng Việt</p>
            <input name="vi.role" defaultValue={vi?.role ?? ""} placeholder="Vai trò (VI)" className="field" />
            <textarea name="vi.summary" defaultValue={vi?.summary ?? ""} rows={2} placeholder="Mô tả ngắn (VI)" className="field" />
            <textarea
              name="vi.achievements"
              defaultValue={vi?.achievements ?? ""}
              rows={3}
              placeholder={"Mỗi dòng một thành tựu, bắt đầu bằng - "}
              className="field font-mono text-[11px]"
            />
          </div>
          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted">English</p>
            <input name="en.role" defaultValue={en?.role ?? ""} placeholder="Role (EN)" className="field" />
            <textarea name="en.summary" defaultValue={en?.summary ?? ""} rows={2} placeholder="Summary (EN)" className="field" />
            <textarea
              name="en.achievements"
              defaultValue={en?.achievements ?? ""}
              rows={3}
              placeholder={"One achievement per line, starting with - "}
              className="field font-mono text-[11px]"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-5">
          <label className="flex items-center gap-2 text-[11.5px]">
            <input type="checkbox" name="isCurrent" defaultChecked={editing?.isCurrent ?? false} className="h-3.5 w-3.5 accent-[var(--accent)]" />
            Đang làm việc tại đây
          </label>
          <label className="flex items-center gap-2 text-[11.5px]">
            <input type="checkbox" name="visible" defaultChecked={editing?.visible ?? true} className="h-3.5 w-3.5 accent-[var(--accent)]" />
            Hiển thị công khai
          </label>
          <div className="w-24">
            <label className="field-label">Thứ tự</label>
            <input name="order" type="number" min={0} max={999} defaultValue={editing?.order ?? 0} className="field" />
          </div>
          {editing && (
            <Link href="/admin/profile" className="text-[11px] text-muted underline underline-offset-4 hover:text-ink">
              Huỷ chỉnh sửa
            </Link>
          )}
        </div>
      </ActionForm>

      {rows.length > 0 && (
        <ul className="divide-y divide-line border-t border-line pt-2">
          {rows.map((row) => {
            const translation = row.translations.find((item) => item.locale === "vi");
            return (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-[12.5px]">
                    {translation?.role ? `${translation.role} · ` : ""}
                    {row.company}
                  </p>
                  <p className="text-[10.5px] text-muted">
                    {row.startDate.toLocaleDateString("vi-VN")} —{" "}
                    {row.isCurrent ? "nay" : row.endDate?.toLocaleDateString("vi-VN") ?? "—"}
                    {row.visible ? "" : " · đang ẩn"}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/admin/profile?editExperience=${row.id}`}
                    className="rounded-full border border-line px-2.5 py-1 text-[10.5px] text-muted hover:border-ink hover:text-ink"
                  >
                    Sửa
                  </Link>
                  <form action={deleteExperienceAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <ConfirmSubmit title="Xoá mục kinh nghiệm này?" description="Xoá vĩnh viễn khỏi cơ sở dữ liệu." triggerLabel="Xoá" confirmLabel="Xoá" />
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionShell>
  );
}

export function SkillsSection({ rows, editing }: { rows: Skill[]; editing?: Skill | null }) {
  return (
    <SectionShell title="Kỹ năng" description="Nhóm theo danh mục, hiển thị thanh mức độ 1–5.">
      <ActionForm action={saveSkillAction} submitLabel={editing ? "Lưu kỹ năng" : "Thêm kỹ năng"} resetOnSuccess={!editing}>
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="field-label">Tên kỹ năng</label>
            <input name="name" defaultValue={editing?.name ?? ""} required className="field" placeholder="TypeScript" />
          </div>
          <div>
            <label className="field-label">Nhóm</label>
            <select name="category" defaultValue={editing?.category ?? "engineering"} className="field">
              <option value="engineering">Kỹ thuật</option>
              <option value="design">Thiết kế</option>
              <option value="art">Nghệ thuật</option>
              <option value="tools">Công cụ</option>
            </select>
          </div>
          <div>
            <label className="field-label">Mức độ (1–5)</label>
            <input name="level" type="number" min={1} max={5} defaultValue={editing?.level ?? 3} className="field" />
          </div>
          <div>
            <label className="field-label">Thứ tự</label>
            <input name="order" type="number" min={0} max={999} defaultValue={editing?.order ?? 0} className="field" />
          </div>
          <label className="flex items-center gap-2 self-end text-[11.5px]">
            <input type="checkbox" name="visible" defaultChecked={editing?.visible ?? true} className="h-3.5 w-3.5 accent-[var(--accent)]" />
            Hiển thị
          </label>
          {editing && (
            <Link href="/admin/profile" className="self-end text-[11px] text-muted underline underline-offset-4 hover:text-ink">
              Huỷ chỉnh sửa
            </Link>
          )}
        </div>
      </ActionForm>

      {rows.length > 0 && (
        <ul className="divide-y divide-line border-t border-line pt-2">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex items-center gap-3">
                <span className="text-[12.5px]">{row.name}</span>
                <span className="text-[10px] text-muted">
                  {row.category} · {row.level}/5 {row.visible ? "" : "· ẩn"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Link
                  href={`/admin/profile?editSkill=${row.id}`}
                  className="rounded-full border border-line px-2.5 py-1 text-[10.5px] text-muted hover:border-ink hover:text-ink"
                >
                  Sửa
                </Link>
                <form action={deleteSkillAction}>
                  <input type="hidden" name="id" value={row.id} />
                  <ConfirmSubmit title="Xoá kỹ năng này?" description="Xoá vĩnh viễn khỏi hồ sơ." triggerLabel="Xoá" confirmLabel="Xoá" />
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}

export function SocialSection({ rows, editing }: { rows: SocialLink[]; editing?: SocialLink | null }) {
  return (
    <SectionShell title="Liên kết mạng xã hội" description="Hiển thị ở header, footer và trang liên hệ.">
      <ActionForm
        action={saveSocialLinkAction}
        submitLabel={editing ? "Lưu liên kết" : "Thêm liên kết"}
        resetOnSuccess={!editing}
      >
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="field-label">Nền tảng</label>
            <select name="platform" defaultValue={editing?.platform ?? "other"} className="field">
              <option value="github">GitHub</option>
              <option value="linkedin">LinkedIn</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="behance">Behance</option>
              <option value="dribbble">Dribbble</option>
              <option value="x">X</option>
              <option value="email">Email</option>
              <option value="other">Khác</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="field-label">URL</label>
            <input
              name="url"
              defaultValue={editing?.url ?? ""}
              required
              className="field"
              placeholder="https://example.com/your-username hoặc mailto:you@example.com"
            />
          </div>
          <div>
            <label className="field-label">Nhãn</label>
            <input name="label" defaultValue={editing?.label ?? ""} className="field" placeholder="GitHub" />
          </div>
          <div>
            <label className="field-label">Thứ tự</label>
            <input name="order" type="number" min={0} max={999} defaultValue={editing?.order ?? 0} className="field" />
          </div>
          <label className="flex items-center gap-2 self-end text-[11.5px]">
            <input type="checkbox" name="visible" defaultChecked={editing?.visible ?? true} className="h-3.5 w-3.5 accent-[var(--accent)]" />
            Hiển thị
          </label>
          {editing && (
            <Link href="/admin/profile" className="self-end text-[11px] text-muted underline underline-offset-4 hover:text-ink">
              Huỷ chỉnh sửa
            </Link>
          )}
        </div>
      </ActionForm>

      {rows.length > 0 && (
        <ul className="divide-y divide-line border-t border-line pt-2">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[12.5px]">
                  {row.label || row.platform} <span className="text-[10px] text-muted">· {row.platform}</span>
                </p>
                <p className="truncate text-[10.5px] text-muted">{row.url}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Link
                  href={`/admin/profile?editSocial=${row.id}`}
                  className="rounded-full border border-line px-2.5 py-1 text-[10.5px] text-muted hover:border-ink hover:text-ink"
                >
                  Sửa
                </Link>
                <form action={deleteSocialLinkAction}>
                  <input type="hidden" name="id" value={row.id} />
                  <ConfirmSubmit title="Xoá liên kết này?" description="Liên kết sẽ biến mất khỏi website." triggerLabel="Xoá" confirmLabel="Xoá" />
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}
