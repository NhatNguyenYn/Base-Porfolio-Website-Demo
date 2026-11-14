// Schedule JSON Import envelope + schedule schemas (Phase 11, D4).
//
// Zod v4, following the conventions in src/lib/validation.ts. Date/time
// values are VN wall-clock (Asia/Ho_Chi_Minh) and are converted to UTC with
// the shared `vnLocalToUtc` helper from src/lib/booking-time.ts — no second
// converter lives here. Overnight schedules are NOT supported in v1:
// `end` must be strictly after `start` on the same `date`.
//
// `parseScheduleImportPayload` is the single entry point for both the API
// route (Worker B) and the admin manual import (Worker C): it validates the
// envelope, rejects duplicate ids / invalid dates / end <= start with a
// ZodError (routes map it to 400 VALIDATION_FAILED via `zodFieldErrors`),
// and returns UTC `ValidatedSchedule` rows ready for the engine.

import { z } from "zod";

import { vnLocalToUtc } from "@/lib/booking-time";
import {
  MAX_IMPORT_DESCRIPTION_LENGTH,
  MAX_IMPORT_EXTERNAL_ID_LENGTH,
  MAX_IMPORT_ID_LENGTH,
  MAX_IMPORT_LOCATION_LENGTH,
  MAX_IMPORT_NOTE_LENGTH,
  MAX_IMPORT_SCHEDULES,
  MAX_IMPORT_SOURCE_LENGTH,
  MAX_IMPORT_TITLE_LENGTH,
} from "@/lib/schedule-import-limits";

export const importedScheduleStatusSchema = z.enum(["scheduled", "confirmed", "completed", "cancelled"]);

export type ImportedScheduleStatus = z.infer<typeof importedScheduleStatusSchema>;

/**
 * One validated schedule, ready for the engine: VN wall-clock already
 * converted to UTC Dates. `externalId` is the stable `id` from the payload.
 */
export type ValidatedSchedule = {
  externalId: string;
  title: string;
  description: string;
  location: string;
  note: string;
  startsAt: Date;
  endsAt: Date;
  status: ImportedScheduleStatus;
};

const dateField = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

const timeField = (label: string) =>
  z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, `${label} must be HH:mm`);

export const scheduleImportScheduleSchema = z
  .object({
    id: z.string().trim().min(1, "Schedule id is required").max(MAX_IMPORT_EXTERNAL_ID_LENGTH),
    title: z.string().trim().min(1, "Title is required").max(MAX_IMPORT_TITLE_LENGTH),
    date: dateField,
    start: timeField("Start time"),
    end: timeField("End time"),
    description: z.string().max(MAX_IMPORT_DESCRIPTION_LENGTH).optional().default(""),
    status: importedScheduleStatusSchema.optional().default("scheduled"),
    location: z.string().max(MAX_IMPORT_LOCATION_LENGTH).optional().default(""),
    note: z.string().max(MAX_IMPORT_NOTE_LENGTH).optional().default(""),
  })
  .superRefine((data, ctx) => {
    // `vnLocalToUtc` returns null for non-existent local times (e.g.
    // 2026-02-30); its round-trip guard is the calendar-validity check.
    const startsAt = vnLocalToUtc(data.date, data.start);
    if (!startsAt) {
      ctx.addIssue({ code: "custom", message: "Invalid date or start time", path: ["date"] });
    }
    const endsAt = vnLocalToUtc(data.date, data.end);
    if (!endsAt) {
      ctx.addIssue({ code: "custom", message: "Invalid date or end time", path: ["end"] });
    }
    if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
      ctx.addIssue({
        code: "custom",
        message: "End time must be after start time (overnight schedules are not supported)",
        path: ["end"],
      });
    }
  });

export type ScheduleImportScheduleInput = z.infer<typeof scheduleImportScheduleSchema>;

export const scheduleImportEnvelopeSchema = z
  .object({
    type: z.literal("schedule_import"),
    version: z.literal("1.0"),
    source: z.string().trim().min(1, "Source is required").max(MAX_IMPORT_SOURCE_LENGTH),
    // `offset: true`: the spec example uses "+07:00" (e.g.
    // "2026-11-14T10:30:00+07:00"); the default only accepts a "Z" suffix.
    generatedAt: z.iso.datetime({ offset: true, message: "generatedAt must be an ISO date-time" }),
    // Optional idempotency key (D6). Empty/absent = no replay semantics.
    importId: z.string().trim().min(1, "importId must not be empty").max(MAX_IMPORT_ID_LENGTH).optional(),
    // API-only: preview=true runs the preview path and writes nothing.
    // Accepted here so the route can parse one envelope for both paths;
    // the manual admin flow simply never sends it.
    preview: z.boolean().optional(),
    schedules: z.array(scheduleImportScheduleSchema).max(MAX_IMPORT_SCHEDULES),
  })
  .superRefine((data, ctx) => {
    const seen = new Map<string, number>();
    const duplicates: string[] = [];
    for (const schedule of data.schedules) {
      const count = (seen.get(schedule.id) ?? 0) + 1;
      seen.set(schedule.id, count);
      if (count === 2) duplicates.push(schedule.id);
    }
    if (duplicates.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: `Duplicate schedule ids: ${duplicates.join(", ")}`,
        path: ["schedules"],
      });
    }
  });

export type ScheduleImportEnvelope = z.infer<typeof scheduleImportEnvelopeSchema>;

/**
 * Validates an unknown payload against the envelope schema and converts
 * every schedule to a UTC `ValidatedSchedule`. Throws `z.ZodError` on any
 * shape, duplicate-id, invalid date/time, or end <= start problem; the
 * caller maps that to 400 VALIDATION_FAILED.
 */
export function parseScheduleImportPayload(input: unknown): {
  envelope: ScheduleImportEnvelope;
  schedules: ValidatedSchedule[];
} {
  const envelope = scheduleImportEnvelopeSchema.parse(input);
  const schedules: ValidatedSchedule[] = envelope.schedules.map((schedule) => {
    const startsAt = vnLocalToUtc(schedule.date, schedule.start);
    const endsAt = vnLocalToUtc(schedule.date, schedule.end);
    // Unreachable after schema validation (superRefine above rejects nulls),
    // but guard anyway so a future schema change cannot silently produce an
    // invalid ValidatedSchedule.
    if (!startsAt || !endsAt) {
      throw new Error("Invalid schedule date or time");
    }
    return {
      externalId: schedule.id,
      title: schedule.title,
      description: schedule.description,
      location: schedule.location,
      note: schedule.note,
      startsAt,
      endsAt,
      status: schedule.status,
    };
  });
  return { envelope, schedules };
}
