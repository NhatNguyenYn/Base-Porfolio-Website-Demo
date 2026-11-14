// Server actions for the Schedule JSON Import admin page (Phase 11, D8).
//
// Manual import + history viewing: any ADMIN (`requireUser()`). Connection
// create / rotate / revoke: SUPER_ADMIN only (`requireSuperAdmin()` —
// credential ops). The connection functions live in Worker B's
// `src/server/schedule-import/connections.ts` and are called here exactly
// per the audit §3 contract:
//   createIntegrationConnection(name, actorUserId) -> { connection, plainToken }
//   rotateIntegrationConnection(id, actorUserId)   -> { plainToken }
//   revokeIntegrationConnection(id, actorUserId)   -> void
//
// The plain token is returned to the caller exactly once (creation /
// rotation response) and is never logged or stored anywhere here.
// Error messages are friendly Vietnamese strings only — no stack traces.

"use server";

import { revalidatePath } from "next/cache";

import { requireSuperAdmin, requireUser } from "../auth";
import { logActivity } from "../audit";
import {
  applyScheduleImport,
  computeScheduleImportPayloadHash,
  ConcurrentImportError,
  ImportIdConflictError,
  previewScheduleImport,
  type ImportAction,
  type ImportSummary,
} from "../schedule-import/engine";
import {
  createIntegrationConnection,
  rotateIntegrationConnection,
  revokeIntegrationConnection,
} from "../schedule-import/connections";
import { parseManualImportJson } from "@/lib/schedule-import-manual";
import type { FieldErrors } from "@/lib/validation";
import type { ValidatedSchedule } from "@/lib/schedule-import-schema";

export type ImportPreviewItem = {
  externalId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
  action: ImportAction;
  error?: string;
};

export type ManualImportResult = {
  ok: boolean;
  message: string;
  fieldErrors?: FieldErrors;
  summary?: ImportSummary;
  importId?: string;
  /** Preview/apply rows enriched with the payload title + VN times. */
  previewItems?: ImportPreviewItem[];
};

export type ConnectionActionResult = {
  ok: boolean;
  message: string;
  connection?: {
    id: string;
    name: string;
    autoApply: boolean;
    isActive: boolean;
    lastUsedAt: string | null;
  };
  /** Shown exactly once, at creation / rotation. Never logged. */
  plainToken?: string;
};

function joinPreviewItems(summary: ImportSummary, schedules: ValidatedSchedule[]): ImportPreviewItem[] {
  const byId = new Map(schedules.map((schedule) => [schedule.externalId, schedule]));
  return summary.items.map((item) => {
    const schedule = byId.get(item.externalId);
    return {
      externalId: item.externalId,
      title: schedule?.title ?? item.externalId,
      startsAt: schedule?.startsAt.toISOString() ?? "",
      endsAt: schedule?.endsAt.toISOString() ?? "",
      status: schedule?.status ?? "",
      action: item.action,
      ...(item.error ? { error: item.error } : {}),
    };
  });
}

function importErrorMessage(error: unknown): string {
  if (error instanceof ImportIdConflictError) {
    return "Mã import (importId) này đã được dùng với nội dung khác. Hãy dùng mã import mới.";
  }
  if (error instanceof ConcurrentImportError) {
    return "Có một lần nhập khác đang chạy cùng lúc. Vui lòng thử lại.";
  }
  return "Không thể nhập lịch. Vui lòng thử lại.";
}

/**
 * Preview a pasted JSON payload: parse + validate + run the engine's
 * preview (no writes, no ScheduleImport row). Any ADMIN may preview.
 */
export async function previewManualImportAction(jsonText: string): Promise<ManualImportResult> {
  const user = await requireUser();
  void user;
  const parsed = parseManualImportJson(jsonText);
  if (!parsed.ok) {
    return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors };
  }
  try {
    const summary = await previewScheduleImport({
      connectionId: null,
      source: "admin-manual",
      schedules: parsed.schedules,
    });
    return {
      ok: true,
      message: "Xem trước xong. Kiểm tra rồi bấm “Xác nhận nhập”.",
      summary,
      previewItems: joinPreviewItems(summary, parsed.schedules),
    };
  } catch (error) {
    console.error("[schedule-import] preview failed", error);
    return { ok: false, message: importErrorMessage(error) };
  }
}

/**
 * Apply a pasted JSON payload: parse + validate + run the engine's apply
 * (connectionId null = manual-admin scope, source "admin-manual").
 * Manual imports always use importKey null (D6: no replay semantics for
 * manual imports — re-applying the same JSON yields `unchanged` anyway).
 * Any ADMIN may apply. A whole-request validation failure writes nothing.
 */
export async function applyManualImportAction(jsonText: string): Promise<ManualImportResult> {
  const user = await requireUser();
  const parsed = parseManualImportJson(jsonText);
  if (!parsed.ok) {
    return { ok: false, message: parsed.message, fieldErrors: parsed.fieldErrors };
  }
  try {
    const { importId, summary } = await applyScheduleImport({
      connectionId: null,
      source: "admin-manual",
      schedules: parsed.schedules,
      importKey: null,
      payloadHash: computeScheduleImportPayloadHash(parsed.schedules),
      userId: user.id,
    });
    await logActivity({
      userId: user.id,
      action: "schedule_import.apply",
      entityType: "ScheduleImport",
      entityId: importId,
      summary: `Manual import: ${summary.created} created, ${summary.updated} updated, ${summary.unchanged} unchanged, ${summary.cancelled} cancelled, ${summary.failed} failed (total ${summary.total})`,
    });
    revalidatePath("/admin/schedule-import");
    return {
      ok: true,
      message: `Đã nhập lịch: ${summary.created} mới, ${summary.updated} thay đổi, ${summary.unchanged} không đổi, ${summary.cancelled} đã huỷ, ${summary.failed} lỗi.`,
      summary,
      importId,
      previewItems: joinPreviewItems(summary, parsed.schedules),
    };
  } catch (error) {
    console.error("[schedule-import] apply failed", error);
    return { ok: false, message: importErrorMessage(error) };
  }
}

/**
 * Create an integration connection (SUPER_ADMIN only). Returns the plain
 * token exactly once — the admin UI must show it once and never refetch it.
 */
export async function createIntegrationConnectionAction(name: string): Promise<ConnectionActionResult> {
  const user = await requireSuperAdmin();
  const cleanName = name.trim();
  if (!cleanName) return { ok: false, message: "Nhập tên kết nối." };
  if (cleanName.length > 200) return { ok: false, message: "Tên kết nối tối đa 200 ký tự." };
  try {
    const { connection, plainToken } = await createIntegrationConnection(cleanName, user.id);
    revalidatePath("/admin/schedule-import");
    return {
      ok: true,
      message: "Đã tạo kết nối. Lưu token ngay — token chỉ hiện một lần.",
      connection: {
        id: connection.id,
        name: connection.name,
        autoApply: connection.autoApply,
        isActive: connection.isActive,
        lastUsedAt: connection.lastUsedAt ? connection.lastUsedAt.toISOString() : null,
      },
      plainToken,
    };
  } catch (error) {
    console.error("[schedule-import] create connection failed", error);
    return { ok: false, message: "Không thể tạo kết nối. Vui lòng thử lại." };
  }
}

/**
 * Rotate a connection's token (SUPER_ADMIN only). The old token stops
 * working immediately; the new plain token is returned exactly once.
 */
export async function rotateIntegrationConnectionAction(id: string): Promise<ConnectionActionResult> {
  const user = await requireSuperAdmin();
  if (!id) return { ok: false, message: "Thiếu kết nối." };
  try {
    const { plainToken } = await rotateIntegrationConnection(id, user.id);
    revalidatePath("/admin/schedule-import");
    return {
      ok: true,
      message: "Đã xoay token. Lưu token mới ngay — token chỉ hiện một lần.",
      plainToken,
    };
  } catch (error) {
    console.error("[schedule-import] rotate connection failed", error);
    return { ok: false, message: "Không thể xoay token. Vui lòng thử lại." };
  }
}

/**
 * Revoke a connection (SUPER_ADMIN only). Sets isActive = false; its token
 * stops working and its schedules/history are kept (onDelete Restrict, D1).
 */
export async function revokeIntegrationConnectionAction(id: string): Promise<ConnectionActionResult> {
  const user = await requireSuperAdmin();
  if (!id) return { ok: false, message: "Thiếu kết nối." };
  try {
    await revokeIntegrationConnection(id, user.id);
    revalidatePath("/admin/schedule-import");
    return { ok: true, message: "Đã thu hồi kết nối. Lịch đã nhập vẫn giữ nguyên." };
  } catch (error) {
    console.error("[schedule-import] revoke connection failed", error);
    return { ok: false, message: "Không thể thu hồi kết nối. Vui lòng thử lại." };
  }
}
