// Integration connections panel (Phase 11, D7/D8).
//
// Client component. Lists connections (name, autoApply, status, last use)
// and, for SUPER_ADMIN only, create / rotate / revoke. The plain token is
// shown exactly once after creation or rotation, in an alert with a copy
// button and a "saved" dismiss — it is never fetched again and never
// stored. Rotate/revoke use an inline two-step confirm (no window.confirm).

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { DataTable } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  createIntegrationConnectionAction,
  rotateIntegrationConnectionAction,
  revokeIntegrationConnectionAction,
} from "@/server/actions/schedule-import";
import type { AdminConnectionRow } from "@/server/queries/schedule-import";
import { formatVnDateTime } from "@/lib/booking-time";

type TokenAlert = { connectionName: string; token: string; rotated: boolean };

export function ScheduleImportConnections({
  connections,
  isSuperAdmin,
}: {
  connections: AdminConnectionRow[];
  isSuperAdmin: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [tokenAlert, setTokenAlert] = useState<TokenAlert | null>(null);
  const [confirming, setConfirming] = useState<{ id: string; kind: "rotate" | "revoke" } | null>(null);

  async function handleCreate() {
    setBusy("create");
    setError(null);
    try {
      const result = await createIntegrationConnectionAction(name);
      if (!result.ok || !result.plainToken || !result.connection) {
        setError(result.message);
        return;
      }
      setTokenAlert({ connectionName: result.connection.name, token: result.plainToken, rotated: false });
      setName("");
      router.refresh();
    } catch {
      setError("Không thể tạo kết nối. Vui lòng thử lại.");
    } finally {
      setBusy(null);
    }
  }

  async function handleRotate(id: string, connectionName: string) {
    setBusy(`rotate:${id}`);
    setError(null);
    try {
      const result = await rotateIntegrationConnectionAction(id);
      if (!result.ok || !result.plainToken) {
        setError(result.message);
        return;
      }
      setTokenAlert({ connectionName, token: result.plainToken, rotated: true });
      setConfirming(null);
      router.refresh();
    } catch {
      setError("Không thể xoay token. Vui lòng thử lại.");
    } finally {
      setBusy(null);
    }
  }

  async function handleRevoke(id: string) {
    setBusy(`revoke:${id}`);
    setError(null);
    try {
      const result = await revokeIntegrationConnectionAction(id);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setConfirming(null);
      router.refresh();
    } catch {
      setError("Không thể thu hồi kết nối. Vui lòng thử lại.");
    } finally {
      setBusy(null);
    }
  }

  async function copyToken() {
    if (!tokenAlert) return;
    try {
      await navigator.clipboard.writeText(tokenAlert.token);
      setCopied(true);
    } catch {
      // Clipboard API unavailable (non-secure context): the token stays
      // visible in the alert so the admin can copy it manually.
      setCopied(false);
    }
  }

  return (
    <section aria-labelledby="schedule-import-connections" className="mb-8 border border-line bg-surface p-5">
      <h2 id="schedule-import-connections" className="text-[16px] font-medium tracking-tight">
        Kết nối tích hợp
      </h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
        Mỗi kết nối có một token riêng (imp_…) để gọi API nhập lịch. Token chỉ hiện một lần lúc tạo hoặc xoay.
        {!isSuperAdmin && " Chỉ Super admin mới tạo, xoay hoặc thu hồi kết nối."}
      </p>

      {error && (
        <div role="alert" className="mt-4 border-l-2 border-danger bg-danger-soft px-4 py-2.5 text-[12.5px] text-danger">
          {error}
        </div>
      )}

      {tokenAlert && (
        <div
          role="alert"
          data-testid="connection-token-alert"
          className="mt-4 border border-warning/40 bg-warning-soft px-4 py-3"
        >
          <p className="text-[13px] font-medium text-warning">
            Token của kết nối “{tokenAlert.connectionName}”{tokenAlert.rotated ? " (mới sau khi xoay)" : ""}
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
            Sao chép và lưu token ngay — token chỉ hiện một lần duy nhất và không thể xem lại. Mất token thì xoay
            để cấp token mới.
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-2">
            <code data-testid="connection-token" className="break-all rounded bg-surface px-2 py-1 font-mono text-[12px]">
              {tokenAlert.token}
            </code>
            <button type="button" onClick={copyToken} className="btn btn-outline btn-sm">
              {copied ? "Đã sao chép" : "Sao chép token"}
            </button>
            <button
              type="button"
              onClick={() => {
                setTokenAlert(null);
                setCopied(false);
              }}
              className="btn btn-outline btn-sm"
            >
              Đã lưu xong
            </button>
          </p>
        </div>
      )}

      {isSuperAdmin && (
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div className="min-w-[240px] flex-1">
            <label className="field-label" htmlFor="connection-name">
              Tên kết nối
            </label>
            <input
              id="connection-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ví dụ: Trợ lý Excel — Khách A"
              className="field"
            />
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={busy === "create" || !name.trim()}
            className="btn btn-primary btn-sm"
          >
            {busy === "create" ? "Đang tạo…" : "Tạo kết nối"}
          </button>
        </div>
      )}

      <div className="mt-5">
        <DataTable
          columns={[
            { key: "name", label: "Tên" },
            { key: "autoApply", label: "Tự áp dụng" },
            { key: "status", label: "Trạng thái" },
            { key: "lastUsed", label: "Dùng lần cuối" },
            { key: "counts", label: "Lịch / Lần nhập" },
            { key: "actions", label: "", className: "text-right" },
          ]}
          rows={connections.map((connection) => ({
            id: connection.id,
            cells: {
              name: <span className="text-[12.5px] font-medium">{connection.name}</span>,
              autoApply: <span className="text-[12.5px]">{connection.autoApply ? "Có" : "Không"}</span>,
              status: (
                <StatusBadge
                  status={connection.isActive ? "active" : "inactive"}
                  label={connection.isActive ? "Đang hoạt động" : "Đã thu hồi"}
                />
              ),
              lastUsed: (
                <span className="whitespace-nowrap text-[12px] tabular-nums">
                  {connection.lastUsedAt ? formatVnDateTime(connection.lastUsedAt, "vi") : "Chưa dùng"}
                </span>
              ),
              counts: (
                <span className="text-[12px] tabular-nums">
                  {connection.scheduleCount} / {connection.importCount}
                </span>
              ),
              actions: isSuperAdmin ? (
                <span className="inline-flex flex-wrap justify-end gap-1.5">
                  {confirming?.id === connection.id && confirming.kind === "rotate" ? (
                    <>
                      <span className="mr-1 text-[11px] text-muted">Xoay sẽ vô hiệu hoá token cũ ngay.</span>
                      <button
                        type="button"
                        onClick={() => handleRotate(connection.id, connection.name)}
                        disabled={busy === `rotate:${connection.id}`}
                        className="btn btn-primary btn-sm"
                      >
                        Xác nhận
                      </button>
                      <button type="button" onClick={() => setConfirming(null)} className="btn btn-outline btn-sm">
                        Huỷ
                      </button>
                    </>
                  ) : confirming?.id === connection.id && confirming.kind === "revoke" ? (
                    <>
                      <span className="mr-1 text-[11px] text-muted">Thu hồi sẽ vô hiệu hoá token này ngay.</span>
                      <button
                        type="button"
                        onClick={() => handleRevoke(connection.id)}
                        disabled={busy === `revoke:${connection.id}`}
                        className="btn btn-sm bg-danger text-white hover:bg-danger-hover"
                      >
                        Xác nhận
                      </button>
                      <button type="button" onClick={() => setConfirming(null)} className="btn btn-outline btn-sm">
                        Huỷ
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setConfirming({ id: connection.id, kind: "rotate" })}
                        disabled={!connection.isActive || busy !== null}
                        className="btn btn-outline btn-sm"
                      >
                        Xoay token
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming({ id: connection.id, kind: "revoke" })}
                        disabled={!connection.isActive || busy !== null}
                        className="btn btn-outline btn-sm"
                      >
                        Thu hồi
                      </button>
                    </>
                  )}
                </span>
              ) : (
                <span className="text-[11px] text-muted">—</span>
              ),
            },
          }))}
          empty="Chưa có kết nối nào."
        />
      </div>
    </section>
  );
}
