// Admin schedule import page (Phase 11, D8): manual JSON paste -> preview
// -> confirm, integration connections panel, month calendar of imported
// schedules, and paginated import history (filter by source/status).
//
// Any ADMIN may import and view history; connection create/rotate/revoke
// is SUPER_ADMIN only (enforced in the actions and hidden in the panel
// for other admins). The (protected) layout already gates sign-in.

import Link from "next/link";

import { PageHeader } from "@/components/admin/page-header";
import { DataTable } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { Pagination } from "@/components/site/pagination";
import { ScheduleImportForm } from "@/components/admin/schedule-import-form";
import { ScheduleImportConnections } from "@/components/admin/schedule-import-connections";
import { ScheduleImportCalendar } from "@/components/admin/schedule-import-calendar";
import { requireUser } from "@/server/auth";
import {
  currentVnMonth,
  listImportedSchedulesForCalendar,
  listIntegrationConnections,
  listScheduleImports,
} from "@/server/queries/schedule-import";
import { formatVnDateTime } from "@/lib/booking-time";
import { totalPages } from "@/lib/utils";

const IMPORT_STATUS_LABELS: Record<string, string> = {
  completed: "Hoàn thành",
  completed_with_errors: "Hoàn thành (có lỗi)",
  failed: "Thất bại",
};

const IMPORT_STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "completed", label: "Hoàn thành" },
  { value: "completed_with_errors", label: "Hoàn thành (có lỗi)" },
  { value: "failed", label: "Thất bại" },
];

function importBadgeStatus(status: string): string {
  if (status === "completed" || status === "completed_with_errors") return "completed";
  if (status === "failed") return "cancelled";
  return status;
}

export default async function AdminScheduleImportPage({
  searchParams,
}: {
  searchParams: Promise<{
    source?: string;
    status?: string;
    page?: string;
    month?: string;
    calStatus?: string;
    calDate?: string;
  }>;
}) {
  const query = await searchParams;
  const user = await requireUser();
  const month = /^\d{4}-\d{2}$/.test(query.month ?? "") ? (query.month as string) : currentVnMonth();
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);

  const [connections, history, calendarSchedules] = await Promise.all([
    listIntegrationConnections(),
    listScheduleImports({
      source: query.source || undefined,
      status: query.status || undefined,
      page,
    }),
    listImportedSchedulesForCalendar({
      month,
      date: query.calDate || undefined,
      status: query.calStatus || undefined,
    }),
  ]);

  const pages = totalPages(history.total, history.perPage);

  return (
    <>
      <PageHeader
        title="Nhập lịch"
        description="Dán JSON lịch để xem trước rồi xác nhận nhập, quản lý kết nối tích hợp cho API và xem lịch sử nhập. Lịch đã nhập hiển thị theo giờ Việt Nam."
      />

      <ScheduleImportForm />

      <ScheduleImportConnections connections={connections} isSuperAdmin={user.role === "SUPER_ADMIN"} />

      <ScheduleImportCalendar
        month={month}
        schedules={calendarSchedules}
        statusFilter={query.calStatus}
        dateFilter={query.calDate}
        basePath="/admin/schedule-import"
        params={{
          ...(query.source ? { source: query.source } : {}),
          ...(query.status ? { status: query.status } : {}),
          ...(query.page ? { page: query.page } : {}),
        }}
      />

      <section aria-labelledby="schedule-import-history">
        <h2 id="schedule-import-history" className="mb-4 text-[16px] font-medium tracking-tight">
          Lịch sử nhập
        </h2>

        <form method="get" className="mb-5 flex flex-wrap items-end gap-3">
          <div>
            <label className="field-label" htmlFor="filter-source">
              Nguồn
            </label>
            <input
              id="filter-source"
              type="text"
              name="source"
              defaultValue={query.source ?? ""}
              placeholder="vd: admin-manual"
              className="field w-auto"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="filter-status">
              Trạng thái
            </label>
            <select id="filter-status" name="status" defaultValue={query.status ?? ""} className="field w-auto">
              {IMPORT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-outline btn-sm">
            Lọc
          </button>
        </form>

        <DataTable
          columns={[
            { key: "when", label: "Thời gian nhập" },
            { key: "source", label: "Nguồn" },
            { key: "status", label: "Trạng thái" },
            { key: "total", label: "Tổng" },
            { key: "created", label: "Mới" },
            { key: "updated", label: "Thay đổi" },
            { key: "unchanged", label: "Không đổi" },
            { key: "cancelled", label: "Đã huỷ" },
            { key: "failed", label: "Lỗi" },
            { key: "actions", label: "", className: "text-right" },
          ]}
          rows={history.items.map((item) => ({
            id: item.id,
            cells: {
              when: (
                <span className="whitespace-nowrap text-[12px] tabular-nums">
                  {formatVnDateTime(item.createdAt, "vi")}
                </span>
              ),
              source: (
                <span className="block max-w-[180px] truncate text-[12.5px]" title={item.source}>
                  {item.connectionName ? `${item.source} · ${item.connectionName}` : item.source}
                </span>
              ),
              status: (
                <StatusBadge
                  status={importBadgeStatus(item.status)}
                  label={IMPORT_STATUS_LABELS[item.status] ?? item.status}
                />
              ),
              total: <span className="tabular-nums">{item.totalRecords}</span>,
              created: <span className="tabular-nums">{item.createdCount}</span>,
              updated: <span className="tabular-nums">{item.updatedCount}</span>,
              unchanged: <span className="tabular-nums">{item.unchangedCount}</span>,
              cancelled: <span className="tabular-nums">{item.cancelledCount}</span>,
              failed: <span className="tabular-nums">{item.failedCount}</span>,
              actions: (
                <Link
                  href={`/admin/schedule-import/history/${item.id}`}
                  className="rounded-full border border-line px-2.5 py-1 text-[10.5px] text-muted transition-colors hover:border-ink hover:text-ink"
                >
                  Xem
                </Link>
              ),
            },
          }))}
          empty="Chưa có lần nhập nào."
        />

        <Pagination
          page={Math.min(page, pages)}
          pages={pages}
          basePath="/admin/schedule-import"
          params={{
            ...(query.source ? { source: query.source } : {}),
            ...(query.status ? { status: query.status } : {}),
            ...(query.month ? { month: query.month } : {}),
            ...(query.calStatus ? { calStatus: query.calStatus } : {}),
            ...(query.calDate ? { calDate: query.calDate } : {}),
          }}
          labels={{ previous: "Trước", next: "Sau", page: "Trang", of: "/" }}
        />
      </section>
    </>
  );
}
