// Pure JSON-parse step for the manual admin import (Phase 11, D8).
//
// Kept free of server-only imports so it can be unit-tested in vitest
// without a session or a database. The server actions in
// src/server/actions/schedule-import.ts call this, then hand the validated
// schedules to the engine. Error strings are friendly Vietnamese messages
// only — never a stack trace, never a raw Zod dump.

import { z } from "zod";

import { parseScheduleImportPayload } from "./schedule-import-schema";
import type { ScheduleImportEnvelope, ValidatedSchedule } from "./schedule-import-schema";
import { MAX_IMPORT_JSON_BYTES } from "./schedule-import-limits";
import { zodFieldErrors } from "./validation";
import type { FieldErrors } from "./validation";

export type ManualImportParse =
  | {
      ok: true;
      envelope: ScheduleImportEnvelope;
      schedules: ValidatedSchedule[];
    }
  | {
      ok: false;
      message: string;
      fieldErrors?: FieldErrors;
    };

/**
 * Parses the pasted JSON text for a manual import. Returns a friendly
 * message on failure: malformed JSON -> INVALID_JSON wording, oversize ->
 * size wording, schema problems -> the first few field messages (which
 * name duplicated ids / bad dates / end <= start, per D4).
 */
export function parseManualImportJson(jsonText: string): ManualImportParse {
  if (new TextEncoder().encode(jsonText).length > MAX_IMPORT_JSON_BYTES) {
    return {
      ok: false,
      message: `JSON vượt quá giới hạn ${Math.floor(MAX_IMPORT_JSON_BYTES / 1024)} KB. Hãy chia nhỏ file rồi nhập từng phần.`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return {
      ok: false,
      message: "JSON không hợp lệ. Kiểm tra dấu ngoặc, dấu phẩy và dấu ngoặc kép.",
    };
  }

  try {
    const { envelope, schedules } = parseScheduleImportPayload(parsed);
    return { ok: true, envelope, schedules };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors = zodFieldErrors(error);
      const messages = Object.values(fieldErrors).flat().slice(0, 3);
      return {
        ok: false,
        message:
          messages.length > 0
            ? `Dữ liệu không hợp lệ: ${messages.join(" ")}`
            : "Dữ liệu không hợp lệ. Kiểm tra lại định dạng JSON theo mẫu.",
        fieldErrors,
      };
    }
    return {
      ok: false,
      message: "Dữ liệu không hợp lệ. Kiểm tra lại định dạng JSON theo mẫu.",
    };
  }
}
