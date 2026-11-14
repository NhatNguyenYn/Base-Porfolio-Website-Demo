import Link from "next/link";
import { Plus } from "lucide-react";
import { listSurveysForAdmin } from "@/server/queries/surveys";
import { duplicateSurveyAction, setSurveyStatusAction } from "@/server/actions/surveys";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { Flash } from "@/components/admin/flash";
import { Pagination } from "@/components/site/pagination";
import { formatShortDate, paginate, totalPages } from "@/lib/utils";

export const dynamic = "force-dynamic";

function StatusButtons({ id, status }: { id: string; status: string }) {
  const buttons: { value: string; label: string; confirm?: { title: string; description: string; confirmLabel: string } }[] = [];
  if (status === "draft" || status === "closed") {
    buttons.push({ value: "published", label: "Xuất bản" });
  }
  if (status === "published") {
    buttons.push({
      value: "closed",
      label: "Đóng",
      confirm: {
        title: "Đóng khảo sát?",
        description: "Khảo sát sẽ ngừng nhận câu trả lời mới. Các câu trả lời đã lưu không bị xoá.",
        confirmLabel: "Đóng khảo sát",
      },
    });
  }
  if (status === "published" || status === "closed") {
    buttons.push({
      value: "archived",
      label: "Lưu trữ",
      confirm: {
        title: "Lưu trữ khảo sát?",
        description: "Khảo sát sẽ không còn hiển thị như khảo sát đang hoạt động. Các câu trả lời đã lưu không bị xoá.",
        confirmLabel: "Lưu trữ",
      },
    });
  }
  if (status === "archived") {
    buttons.push({ value: "draft", label: "Mở lại nháp" });
  }
  if (buttons.length === 0) return <span className="text-[11px] text-muted">—</span>;
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {buttons.map((button) =>
        button.confirm ? (
          <form key={button.value} action={setSurveyStatusAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value={button.value} />
            <ConfirmSubmit
              title={button.confirm.title}
              description={button.confirm.description}
              triggerLabel={button.label}
              confirmLabel={button.confirm.confirmLabel}
              tone="neutral"
            />
          </form>
        ) : (
          <form key={button.value} action={setSurveyStatusAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value={button.value} />
            <button
              type="submit"
              className="rounded-full border border-line px-2.5 py-1 text-[10.5px] text-muted transition-colors hover:border-ink hover:text-ink"
            >
              {button.label}
            </button>
          </form>
        ),
      )}
    </div>
  );
}

export default async function AdminSurveysPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; sort?: string; page?: string; saved?: string }>;
}) {
  const query = await searchParams;
  const q = query.q ?? "";
  const status = query.status ?? "";
  const sort = query.sort ?? "newest";
  const surveys = await listSurveysForAdmin({ q, status, sort });
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const pages = totalPages(surveys.length, 20);
  const items = paginate(surveys, Math.min(page, pages), 20);

  return (
    <>
      <PageHeader
        title="Khảo sát"
        description="Tạo, chỉnh sửa, xuất bản và lưu trữ khảo sát. Khảo sát đã lưu trữ không nhận thêm câu trả lời; đóng hoặc lưu trữ không bao giờ xoá câu trả lời đã lưu."
        actions={
          <Link href="/admin/surveys/new" className="btn btn-primary btn-sm">
            <Plus size={12} aria-hidden="true" />
            Khảo sát mới
          </Link>
        }
      />

      {query.saved && <Flash message="Đã lưu khảo sát." />}

      <form method="get" className="mb-5 flex flex-wrap items-end gap-2 border border-line bg-surface p-3.5">
        <label className="min-w-52 flex-1">
          <span className="field-label">Tìm kiếm</span>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Tiêu đề hoặc slug…"
            className="field"
          />
        </label>
        <label>
          <span className="field-label">Trạng thái</span>
          <select name="status" defaultValue={status} className="field">
            <option value="">Tất cả</option>
            <option value="draft">Bản nháp</option>
            <option value="published">Đã xuất bản</option>
            <option value="closed">Đã đóng</option>
            <option value="archived">Lưu trữ</option>
          </select>
        </label>
        <label>
          <span className="field-label">Sắp xếp</span>
          <select name="sort" defaultValue={sort} className="field">
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
            <option value="updated">Cập nhật gần nhất</option>
            <option value="title">Tiêu đề (A–Z)</option>
            <option value="responses">Nhiều phản hồi nhất</option>
          </select>
        </label>
        <button type="submit" className="btn btn-outline btn-sm">
          Lọc
        </button>
        {(q || status) && (
          <Link href="/admin/surveys" className="btn btn-outline btn-sm">
            Xoá lọc
          </Link>
        )}
      </form>

      <DataTable
        columns={[
          { key: "title", label: "Khảo sát" },
          { key: "status", label: "Trạng thái" },
          { key: "responses", label: "Phản hồi" },
          { key: "published", label: "Xuất bản" },
          { key: "created", label: "Tạo / Cập nhật" },
          { key: "actions", label: "", className: "text-right" },
        ]}
        rows={items.map((survey) => ({
          id: survey.id,
          cells: {
            title: (
              <div className="min-w-0 max-w-[320px]">
                <Link href={`/admin/surveys/${survey.id}`} className="block truncate text-[12.5px] hover:underline">
                  {survey.titleVi || survey.titleEn || "(chưa có tiêu đề)"}
                </Link>
                <p className="truncate font-mono text-[10px] text-muted">/{survey.slug}</p>
                {survey.isBookingIntake && (
                  <p className="mt-0.5 text-[10px] text-accent">Dùng làm intake đặt lịch</p>
                )}
              </div>
            ),
            status: <StatusBadge status={survey.status} />,
            responses: (
              <div>
                <span className="text-[12.5px] font-medium tabular-nums">{survey.responseCount}</span>
                <p className="text-[10.5px] text-muted">
                  {survey.lastResponseAt ? `gần nhất ${formatShortDate(survey.lastResponseAt, "vi")}` : "chưa có phản hồi"}
                </p>
              </div>
            ),
            published: (
              <span className="text-[11px] text-muted">
                {survey.publishedAt ? formatShortDate(survey.publishedAt, "vi") : "—"}
              </span>
            ),
            created: (
              <div>
                <p className="text-[11px] text-muted">{formatShortDate(survey.createdAt, "vi")}</p>
                <p className="text-[10.5px] text-muted">sửa {formatShortDate(survey.updatedAt, "vi")}</p>
              </div>
            ),
            actions: (
              <div className="flex flex-col items-end gap-1.5">
                <div className="flex items-center justify-end gap-1.5">
                  <Link
                    href={`/admin/surveys/${survey.id}/responses`}
                    className="rounded-full border border-line px-2.5 py-1 text-[10.5px] text-muted transition-colors hover:border-ink hover:text-ink"
                  >
                    Xem kết quả
                  </Link>
                  <Link
                    href={`/admin/surveys/${survey.id}`}
                    className="rounded-full border border-line px-2.5 py-1 text-[10.5px] text-muted transition-colors hover:border-ink hover:text-ink"
                  >
                    Sửa
                  </Link>
                  <form action={duplicateSurveyAction}>
                    <input type="hidden" name="id" value={survey.id} />
                    <button
                      type="submit"
                      className="rounded-full border border-line px-2.5 py-1 text-[10.5px] text-muted transition-colors hover:border-ink hover:text-ink"
                    >
                      Nhân bản
                    </button>
                  </form>
                </div>
                <StatusButtons id={survey.id} status={survey.status} />
              </div>
            ),
          },
        }))}
        empty="Chưa có khảo sát nào."
      />

      <Pagination
        page={Math.min(page, pages)}
        pages={pages}
        basePath="/admin/surveys"
        params={{ q: q || undefined, status: status || undefined, sort }}
        labels={{ previous: "Trước", next: "Sau", page: "Trang", of: "/" }}
      />
    </>
  );
}
