import Link from "next/link";
import { notFound } from "next/navigation";
import { getSurveyForResponses, listResponsesForAdmin, surveyStats } from "@/server/queries/survey-responses";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { Pagination } from "@/components/site/pagination";
import { formatDate } from "@/lib/utils";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDateParam(value: string | undefined, endOfDay: boolean): Date | undefined {
  if (!value || !DATE_PATTERN.test(value)) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+07:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function exportHref(surveyId: string, from?: string, to?: string): string {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const query = params.toString();
  return `/api/admin/surveys/${surveyId}/responses/export${query ? `?${query}` : ""}`;
}

export default async function SurveyResponsesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; from?: string; to?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const survey = await getSurveyForResponses(id);
  if (!survey || survey.deletedAt) notFound();

  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const from = parseDateParam(query.from, false);
  const to = parseDateParam(query.to, true);
  const fromParam = from ? query.from : undefined;
  const toParam = to ? query.to : undefined;

  const [responses, stats] = await Promise.all([
    listResponsesForAdmin(id, { page, perPage: 20, from, to }),
    surveyStats(id, { from, to }),
  ]);

  const maxTimeline = Math.max(1, ...stats.timeline.map((item) => item.count));
  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : null;

  return (
    <>
      <PageHeader
        title={`Phản hồi — ${survey.title}`}
        description="Kết quả khảo sát được tính trực tiếp từ các câu trả lời đã lưu. Không có số liệu mẫu."
        back={{ href: "/admin/surveys", label: "Danh sách khảo sát" }}
        actions={
          <>
            <StatusBadge
              status={survey.status}
              label={survey.status === "closed" ? "Đã đóng" : undefined}
            />
            <a href={exportHref(id, fromParam, toParam)} className="btn btn-primary btn-sm">
              Xuất CSV
            </a>
          </>
        }
      />

      <div className="mb-7 grid gap-3 sm:grid-cols-3">
        <div className="border border-line bg-surface px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted">Tổng phản hồi</p>
          <p className="mt-1 text-[26px] leading-none tabular-nums">{stats.total}</p>
        </div>
        <div className="border border-line bg-surface px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted">Hoàn thành</p>
          <p className="mt-1 text-[26px] leading-none tabular-nums">
            {stats.completed}
            {completionRate !== null && (
              <span className="ml-2 text-[13px] text-muted">({completionRate}%)</span>
            )}
          </p>
          <p className="mt-1 text-[11px] text-muted">Đã trả lời đủ các câu bắt buộc.</p>
        </div>
        <div className="border border-line bg-surface px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted">Slug</p>
          <p className="mt-1 truncate font-mono text-[13px]">/{survey.slug}</p>
          <p className="mt-1 text-[11px] text-muted">Trạng thái: {survey.status}</p>
        </div>
      </div>

      <form method="get" className="mb-7 flex flex-wrap items-end gap-3">
        <label className="text-[11px] text-muted">
          Từ ngày
          <input
            type="date"
            name="from"
            defaultValue={fromParam ?? ""}
            className="mt-1 block border border-line bg-surface px-2 py-1.5 text-[12.5px] text-ink"
          />
        </label>
        <label className="text-[11px] text-muted">
          Đến ngày
          <input
            type="date"
            name="to"
            defaultValue={toParam ?? ""}
            className="mt-1 block border border-line bg-surface px-2 py-1.5 text-[12.5px] text-ink"
          />
        </label>
        <button type="submit" className="btn btn-outline btn-sm">
          Lọc theo thời gian
        </button>
        {(fromParam || toParam) && (
          <Link href={`/admin/surveys/${id}/responses`} className="btn btn-sm">
            Xoá lọc
          </Link>
        )}
      </form>

      <section aria-labelledby="timeline-heading" className="mb-7 border border-line bg-surface px-4 py-3">
        <h2 id="timeline-heading" className="text-[13px] font-medium">
          Dòng thời gian gửi bài
        </h2>
        {stats.timeline.length === 0 ? (
          <p className="mt-2 text-[12.5px] text-muted">Chưa có phản hồi nào trong khoảng đã chọn.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {stats.timeline.map((item) => (
              <li key={item.date} className="flex items-center gap-3 text-[12px]">
                <span className="w-24 shrink-0 tabular-nums text-muted">{item.date}</span>
                <span
                  className="h-3 min-w-1 bg-accent"
                  style={{ width: `${Math.max(2, (item.count / maxTimeline) * 100)}%` }}
                  aria-hidden="true"
                />
                <span className="tabular-nums">{item.count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {stats.rating.map((item) => (
        <section key={item.questionId} aria-label={`Đánh giá: ${item.title}`} className="mb-7 border border-line bg-surface px-4 py-3">
          <h2 className="text-[13px] font-medium">{item.title}</h2>
          <p className="mt-1 text-[12px] text-muted">
            {item.average === null
              ? "Chưa có câu trả lời."
              : `Trung bình ${item.average.toFixed(1)} / 10 — ${item.count} câu trả lời.`}
          </p>
          {item.count > 0 && (
            <ul className="mt-3 space-y-1.5">
              {item.distribution.map((row) => (
                <li key={row.value} className="flex items-center gap-3 text-[12px]">
                  <span className="w-6 shrink-0 tabular-nums text-muted">{row.value}</span>
                  <span
                    className="h-3 min-w-1 bg-accent"
                    style={{ width: `${Math.max(2, (row.count / Math.max(1, ...item.distribution.map((d) => d.count))) * 100)}%` }}
                    aria-hidden="true"
                  />
                  <span className="tabular-nums">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {stats.nps.map((item) => (
        <section key={item.questionId} aria-label={`NPS: ${item.title}`} className="mb-7 border border-line bg-surface px-4 py-3">
          <h2 className="text-[13px] font-medium">{item.title}</h2>
          {item.average === null ? (
            <p className="mt-1 text-[12px] text-muted">Chưa có câu trả lời.</p>
          ) : (
            <>
              <p className="mt-1 text-[12px] text-muted">
                Trung bình {item.average.toFixed(1)} / 10 — NPS {item.score} ({item.count} câu trả lời).
              </p>
              <ul className="mt-3 space-y-1.5 text-[12px]">
                <li className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-muted">Ủng hộ (9–10)</span>
                  <span className="h-3 min-w-1 bg-success" style={{ width: `${Math.max(2, (item.promoters / item.count) * 100)}%` }} aria-hidden="true" />
                  <span className="tabular-nums">{item.promoters}</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-muted">Trung lập (7–8)</span>
                  <span className="h-3 min-w-1 bg-warning" style={{ width: `${Math.max(2, (item.passives / item.count) * 100)}%` }} aria-hidden="true" />
                  <span className="tabular-nums">{item.passives}</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-muted">Phản đối (0–6)</span>
                  <span className="h-3 min-w-1 bg-danger" style={{ width: `${Math.max(2, (item.detractors / item.count) * 100)}%` }} aria-hidden="true" />
                  <span className="tabular-nums">{item.detractors}</span>
                </li>
              </ul>
            </>
          )}
        </section>
      ))}

      {stats.distributions.map((item) => {
        const max = Math.max(1, ...item.options.map((option) => option.count));
        return (
          <section key={item.questionId} aria-label={`Phân bố: ${item.title}`} className="mb-7 border border-line bg-surface px-4 py-3">
            <h2 className="text-[13px] font-medium">{item.title}</h2>
            <p className="mt-1 text-[12px] text-muted">
              {item.answered} đã trả lời · {item.unanswered} chưa trả lời.
            </p>
            <ul className="mt-3 space-y-1.5">
              {item.options.map((option) => (
                <li key={option.optionId} className="flex items-center gap-3 text-[12px]">
                  <span className="w-40 shrink-0 truncate" title={option.label}>
                    {option.label}
                  </span>
                  <span
                    className="h-3 min-w-1 bg-accent"
                    style={{ width: `${Math.max(2, (option.count / max) * 100)}%` }}
                    aria-hidden="true"
                  />
                  <span className="tabular-nums">{option.count}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {stats.textCounts.map((item) => (
        <p key={item.questionId} className="mb-7 text-[12.5px] text-muted">
          Câu hỏi “{item.title}”: {item.count} câu trả lời dạng văn bản — xem từng phản hồi bên dưới.
        </p>
      ))}

      <h2 className="mb-3 text-[13px] font-medium">Danh sách phản hồi</h2>
      <DataTable
        columns={[
          { key: "response", label: "Phản hồi" },
          { key: "locale", label: "Ngôn ngữ" },
          { key: "submitted", label: "Thời gian gửi" },
          { key: "answers", label: "Số câu trả lời" },
          { key: "valid", label: "Hợp lệ" },
        ]}
        rows={responses.items.map((row) => ({
          id: row.id,
          cells: {
            response: (
              <Link
                href={`/admin/surveys/${id}/responses/${row.id}`}
                className="font-mono text-[11.5px] hover:underline"
              >
                {row.id.slice(0, 8)}…
              </Link>
            ),
            locale: <span className="text-[11.5px] uppercase text-muted">{row.locale}</span>,
            submitted: (
              <span className="text-[11.5px] text-muted">
                {formatDate(row.submittedAt, "vi", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            ),
            answers: <span className="tabular-nums">{row.answerCount}</span>,
            valid: (
              <span className={row.complete ? "text-success" : "text-warning"}>
                {row.complete ? "Hợp lệ" : "Thiếu câu bắt buộc"}
              </span>
            ),
          },
        }))}
        empty="Chưa có phản hồi nào."
      />

      <Pagination
        page={responses.page}
        pages={responses.pages}
        basePath={`/admin/surveys/${id}/responses`}
        params={{ from: fromParam, to: toParam }}
        labels={{ previous: "Trước", next: "Sau", page: "Trang", of: "/" }}
      />
      <p className="mt-3 text-[11px] text-muted">
        Tổng {responses.total} phản hồi{fromParam || toParam ? " trong khoảng đã lọc" : ""}.
      </p>
    </>
  );
}
