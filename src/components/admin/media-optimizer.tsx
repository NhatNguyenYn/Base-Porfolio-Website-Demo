"use client";

import { useActionState } from "react";
import {
  optimizeLegacyMediaAction,
  type OptimizeLegacyState,
} from "@/server/actions/media";
import { fileSize } from "@/lib/utils";

/**
 * Legacy-image migration panel on /admin/media.
 *
 * Two buttons share one form: "Xem trước" runs a dry run (same scan and
 * optimization in memory, nothing written), "Tối ưu ảnh cũ" writes the
 * optimized files. The server action processes 10 files per run (largest
 * first), so the admin runs it again until the report says 0 remaining.
 * Original files are never deleted; their keys are kept on the media rows.
 */
export function MediaOptimizer() {
  const [state, action, pending] = useActionState<OptimizeLegacyState, FormData>(
    optimizeLegacyMediaAction,
    { ok: false, message: "" },
  );

  const report = state.report;

  return (
    <div className="border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-medium">Tối ưu ảnh cũ</h2>
          <p className="mt-0.5 max-w-2xl text-[11px] leading-relaxed text-muted">
            Ảnh tải lên trước khi có tính năng nén tự động (chủ yếu là 45 ảnh gốc đợt 1) sẽ được nén lại.
            File gốc luôn được giữ lại trên storage. Mỗi lần chạy xử lý tối đa 10 ảnh, lớn nhất trước — chạy lại
            cho tới khi không còn ảnh chờ tối ưu.
          </p>
        </div>
        <form action={action} className="flex gap-2">
          <button
            type="submit"
            name="dryRun"
            value="1"
            className="btn btn-outline btn-sm"
            disabled={pending}
          >
            {pending ? "Đang xử lý…" : "Xem trước"}
          </button>
          <button
            type="submit"
            name="dryRun"
            value="0"
            className="btn btn-primary btn-sm"
            disabled={pending}
          >
            {pending ? "Đang xử lý…" : "Tối ưu ảnh cũ"}
          </button>
        </form>
      </div>

      {state.message && (
        <p className="mt-4 text-[12px] leading-relaxed" role="status">
          {state.message}
        </p>
      )}

      {report && report.files.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-[11.5px]">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="py-1.5 pr-3 font-medium">Ảnh</th>
                <th className="py-1.5 pr-3 font-medium">Trước</th>
                <th className="py-1.5 pr-3 font-medium">Sau</th>
                <th className="py-1.5 pr-3 font-medium">Tiết kiệm</th>
                <th className="py-1.5 font-medium">Kết quả</th>
              </tr>
            </thead>
            <tbody>
              {report.files.map((file) => (
                <tr key={file.filename} className="border-b border-line/60 align-top">
                  <td className="py-1.5 pr-3">
                    <span className="block max-w-56 truncate" title={file.filename}>
                      {file.filename}
                    </span>
                    <span className="block text-[10px] text-muted">{file.note}</span>
                  </td>
                  <td className="py-1.5 pr-3 tabular-nums">{fileSize(file.beforeBytes)}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{fileSize(file.afterBytes)}</td>
                  <td className="py-1.5 pr-3 tabular-nums">
                    {file.beforeBytes > file.afterBytes
                      ? fileSize(file.beforeBytes - file.afterBytes)
                      : "—"}
                  </td>
                  <td className="py-1.5">
                    {file.status === "optimized"
                      ? "Đã tối ưu"
                      : file.status === "already-optimal"
                        ? "Đã tối ưu rồi"
                        : file.status === "skipped"
                          ? "Bỏ qua"
                          : "Lỗi"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-muted">
            Đã quét {report.scanned} · tối ưu {report.optimized} · đã tối ưu rồi {report.alreadyOptimal} · bỏ qua{" "}
            {report.skipped} · lỗi {report.failed} · tiết kiệm {fileSize(report.savedBytes)}
            {report.dryRun ? " (xem trước, chưa ghi gì)" : ""} · còn {report.remaining} ảnh chờ tối ưu.
          </p>
        </div>
      )}
    </div>
  );
}
