// Manual JSON import form (Phase 11, D8): paste JSON -> preview -> confirm.
//
// Client component. Calls the server actions in
// src/server/actions/schedule-import.ts directly; validation errors render
// inline (friendly message + field list), never a stack trace. The preview
// table shows the engine's counts plus the payload title / VN time per row,
// so the admin can review before confirming.

"use client";

import Link from "next/link";
import { useState } from "react";

import { DataTable } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  applyManualImportAction,
  previewManualImportAction,
  type ImportPreviewItem,
  type ManualImportResult,
} from "@/server/actions/schedule-import";
import { formatVnDateTime, utcToVnLocalParts } from "@/lib/booking-time";

const ACTION_LABELS: Record<string, string> = {
  created: "Mới",
  updated: "Đã cập nhật",
  unchanged: "Không đổi",
  cancelled: "Đã huỷ",
  failed: "Lỗi",
};

function vnDatePlusDays(days: number): string {
  return utcToVnLocalParts(new Date(Date.now() + days * 24 * 60 * 60 * 1000)).date;
}

function sampleJson(): string {
  const date = vnDatePlusDays(7);
  const nextDate = vnDatePlusDays(8);
  return JSON.stringify(
    {
      type: "schedule_import",
      version: "1.0",
      source: "admin-manual",
      generatedAt: new Date().toISOString(),
      schedules: [
        {
          id: "MAU-001",
          title: "Tư vấn khách hàng (mẫu)",
          date,
          start: "09:00",
          end: "10:00",
          description: "Buổi tư vấn mẫu",
          status: "confirmed",
          location: "Phòng A",
          note: "",
        },
        {
          id: "MAU-002",
          title: "Gọi lại khách hàng (mẫu)",
          date: nextDate,
          start: "14:00",
          end: "14:30",
          status: "scheduled",
        },
      ],
    },
    null,
    2,
  );
}

function timeRange(item: ImportPreviewItem): string {
  if (!item.startsAt || !item.endsAt) return "—";
  return `${formatVnDateTime(item.startsAt, "vi")} – ${utcToVnLocalParts(item.endsAt).time}`;
}

export function ScheduleImportForm() {
  const [jsonText, setJsonText] = useState("");
  const [busy, setBusy] = useState<"preview" | "apply" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | undefined>(undefined);
  const [preview, setPreview] = useState<ManualImportResult | null>(null);
  const [appliedImportId, setAppliedImportId] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handlePreview() {
    setBusy("preview");
    setError(null);
    setFieldErrors(undefined);
    setSuccess(null);
    setAppliedImportId(null);
    try {
      const result = await previewManualImportAction(jsonText);
      if (!result.ok) {
        setError(result.message);
        setFieldErrors(result.fieldErrors);
        setPreview(null);
        return;
      }
      setPreview(result);
    } catch {
      setError("Không thể xem trước. Vui lòng thử lại.");
      setPreview(null);
    } finally {
      setBusy(null);
    }
  }

  async function handleApply() {
    setBusy("apply");
    setError(null);
    setFieldErrors(undefined);
    setSuccess(null);
    try {
      const result = await applyManualImportAction(jsonText);
      if (!result.ok) {
        setError(result.message);
        setFieldErrors(result.fieldErrors);
        return;
      }
      setPreview(result);
      setAppliedImportId(result.importId ?? null);
      setSuccess(result.message);
    } catch {
      setError("Không thể nhập lịch. Vui lòng thử lại.");
    } finally {
      setBusy(null);
    }
  }

  const summary = preview?.summary;

  return (
    <section aria-labelledby="schedule-import-manual" className="mb-8 border border-line bg-surface p-5">
      <h2 id="schedule-import-manual" className="text-[16px] font-medium tracking-tight">
        Nhập lịch thủ công
      </h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
        Dán JSON theo định dạng schedule_import v1.0 (tối đa 500 lịch, 256 KB). Ngày/giờ là giờ Việt Nam.
        Xem trước rồi mới xác nhận nhập.
      </p>

      <div className="mt-4">
        <label className="field-label" htmlFor="schedule-import-json">
          JSON lịch
        </label>
        <textarea
          id="schedule-import-json"
          value={jsonText}
          onChange={(event) => setJsonText(event.target.value)}
          rows={12}
          spellCheck={false}
          placeholder={'{ "type": "schedule_import", "version": "1.0", ... }'}
          className="field font-mono text-[12px] leading-relaxed"
        />
      </div>

      {error && (
        <div
          role="alert"
          data-testid="schedule-import-error"
          className="mt-4 border-l-2 border-danger bg-danger-soft px-4 py-2.5 text-danger"
        >
          <p className="text-[12.5px] leading-relaxed">{error}</p>
          {fieldErrors && (
            <ul className="mt-1.5 list-disc pl-5 text-[12px] leading-relaxed">
              {Object.entries(fieldErrors).map(([field, messages]) =>
                messages.map((message) => (
                  <li key={`${field}:${message}`}>
                    <span className="font-mono">{field}</span>: {message}
                  </li>
                )),
              )}
            </ul>
          )}
        </div>
      )}

      {success && (
        <div role="status" className="mt-4 border-l-2 border-success bg-success-soft px-4 py-2.5 text-success">
          <p className="text-[12.5px] leading-relaxed">{success}</p>
          {appliedImportId && (
            <p className="mt-1 text-[12.5px]">
              <Link href={`/admin/schedule-import/history/${appliedImportId}`} className="underline">
                Xem chi tiết lần nhập
              </Link>
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setJsonText(sampleJson())}
          className="btn btn-outline btn-sm"
        >
          Dán JSON mẫu
        </button>
        <button
          type="button"
          onClick={handlePreview}
          disabled={busy !== null || !jsonText.trim()}
          className="btn btn-outline btn-sm"
        >
          {busy === "preview" ? "Đang xem trước…" : "Xem trước"}
        </button>
        <button
          type="button"
          onClick={handleApply}
          disabled={busy !== null || !preview?.summary}
          className="btn btn-primary btn-sm"
        >
          {busy === "apply" ? "Đang nhập…" : "Xác nhận nhập"}
        </button>
      </div>

      {summary && (
        <div className="mt-6">
          <h3 className="text-[14px] font-medium tracking-tight">Xem trước</h3>
          <dl className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {(
              [
                ["total", "Tổng", summary.total],
                ["created", "Mới", summary.created],
                ["updated", "Thay đổi", summary.updated],
                ["unchanged", "Không đổi", summary.unchanged],
                ["cancelled", "Đã huỷ", summary.cancelled],
                ["failed", "Lỗi", summary.failed],
              ] as const
            ).map(([key, label, value]) => (
              <div key={key} className="border border-line bg-surface-muted/40 px-3 py-2.5 text-center">
                <dt className="text-[10.5px] uppercase tracking-[0.12em] text-muted">{label}</dt>
                <dd data-testid={`preview-count-${key}`} className="mt-1 text-[18px] font-semibold tabular-nums">
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-4">
            <DataTable
              columns={[
                { key: "externalId", label: "Mã lịch" },
                { key: "title", label: "Tiêu đề" },
                { key: "time", label: "Thời gian" },
                { key: "action", label: "Kết quả" },
                { key: "error", label: "Lỗi" },
              ]}
              rows={(preview?.previewItems ?? []).map((item) => ({
                id: item.externalId,
                cells: {
                  externalId: <span className="font-mono text-[12px]">{item.externalId}</span>,
                  title: <span className="text-[12.5px]">{item.title}</span>,
                  time: (
                    <span className="whitespace-nowrap text-[12px] tabular-nums">{timeRange(item)}</span>
                  ),
                  action: <StatusBadge status={item.action} label={ACTION_LABELS[item.action] ?? item.action} />,
                  error: <span className="text-[12px] text-danger">{item.error ?? "—"}</span>,
                },
              }))}
              empty="Không có lịch nào trong JSON."
            />
          </div>
        </div>
      )}
    </section>
  );
}
