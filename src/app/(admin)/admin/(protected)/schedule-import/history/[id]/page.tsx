// Per-import detail page (Phase 11, D10): counts + one row per imported
// schedule (externalId, action, error when present). No credentials or
// stack traces appear here — only the short per-item error strings.

import { notFound } from "next/navigation";

import { PageHeader } from "@/components/admin/page-header";
import { DataTable } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { getScheduleImportDetail } from "@/server/queries/schedule-import";
import { formatVnDateTime } from "@/lib/booking-time";

const IMPORT_STATUS_LABELS: Record<string, string> = {
  completed: "Hoàn thành",
  completed_with_errors: "Hoàn thành (có lỗi)",
  failed: "Thất bại",
};

const ACTION_LABELS: Record<string, string> = {
  created: "Mới",
  updated: "Đã cập nhật",
  unchanged: "Không đổi",
  cancelled: "Đã huỷ",
  failed: "Lỗi",
};

export default async function AdminScheduleImportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getScheduleImportDetail(id);
  if (!detail) notFound();

  return (
    <>
      <PageHeader
        title="Chi tiết lần nhập"
        description={`Nhập lúc ${formatVnDateTime(detail.createdAt, "vi")} · Nguồn: ${detail.source}${detail.connectionName ? ` · Kết nối: ${detail.connectionName}` : " · Nhập tay (admin)"}.`}
        back={{ href: "/admin/schedule-import", label: "Về trang nhập lịch" }}
      />

      <div className="mb-6 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {(
          [
            ["total", "Tổng", detail.totalRecords],
            ["created", "Mới", detail.createdCount],
            ["updated", "Thay đổi", detail.updatedCount],
            ["unchanged", "Không đổi", detail.unchangedCount],
            ["cancelled", "Đã huỷ", detail.cancelledCount],
            ["failed", "Lỗi", detail.failedCount],
          ] as const
        ).map(([key, label, value]) => (
          <div key={key} className="border border-line bg-surface px-3 py-2.5 text-center">
            <dt className="text-[10.5px] uppercase tracking-[0.12em] text-muted">{label}</dt>
            <dd className="mt-1 text-[18px] font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </div>

      <dl className="mb-6 grid gap-2 border border-line bg-surface p-5 text-[12.5px] sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="shrink-0 text-muted">Trạng thái:</dt>
          <dd>
            <StatusBadge
              status={
                detail.status === "completed" || detail.status === "completed_with_errors"
                  ? "completed"
                  : detail.status === "failed"
                    ? "cancelled"
                    : detail.status
              }
              label={IMPORT_STATUS_LABELS[detail.status] ?? detail.status}
            />
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-muted">Mã import (importId):</dt>
          <dd className="break-all font-mono text-[12px]">{detail.importKey ?? "—"}</dd>
        </div>
        {detail.errorSummary && (
          <div className="flex gap-2 sm:col-span-2">
            <dt className="shrink-0 text-muted">Ghi chú lỗi:</dt>
            <dd className="text-danger">{detail.errorSummary}</dd>
          </div>
        )}
      </dl>

      <DataTable
        columns={[
          { key: "externalId", label: "Mã lịch" },
          { key: "action", label: "Kết quả" },
          { key: "error", label: "Lỗi" },
        ]}
        rows={detail.items.map((item) => ({
          id: item.id,
          cells: {
            externalId: <span className="font-mono text-[12px]">{item.externalId}</span>,
            action: <StatusBadge status={item.action} label={ACTION_LABELS[item.action] ?? item.action} />,
            error: <span className="text-[12px] text-danger">{item.error ?? "—"}</span>,
          },
        }))}
        empty="Lần nhập này không có lịch nào."
      />
    </>
  );
}
