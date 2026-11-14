// Phase 11 — envelope + schedule schema tests (Worker A).
// Pure validation, no DB. Covers D4: shape, required fields, invalid
// dates/times, end <= start, duplicate ids, and the size/count limits.
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  parseScheduleImportPayload,
  scheduleImportEnvelopeSchema,
  scheduleImportScheduleSchema,
} from "@/lib/schedule-import-schema";
import { MAX_IMPORT_SCHEDULES } from "@/lib/schedule-import-limits";

function validEnvelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: "schedule_import",
    version: "1.0",
    source: "external_agent",
    generatedAt: "2026-11-14T10:30:00+07:00",
    schedules: [
      {
        id: "EXCEL-001",
        title: "Customer Consultation",
        date: "2026-11-15",
        start: "09:00",
        end: "10:00",
        description: "Customer consultation",
        status: "confirmed",
        location: "Room A",
        note: "Bring documents",
      },
    ],
    ...overrides,
  };
}

function validSchedule(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "EXCEL-001",
    title: "Customer Consultation",
    date: "2026-11-15",
    start: "09:00",
    end: "10:00",
    ...overrides,
  };
}

function issueMessages(error: unknown): string[] {
  expect(error).toBeInstanceOf(z.ZodError);
  return (error as z.ZodError).issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
}

describe("scheduleImportScheduleSchema", () => {
  it("accepts a minimal schedule and defaults description/location/note/status", () => {
    const parsed = scheduleImportScheduleSchema.parse(validSchedule());
    expect(parsed.description).toBe("");
    expect(parsed.location).toBe("");
    expect(parsed.note).toBe("");
    expect(parsed.status).toBe("scheduled");
  });

  it("rejects a missing title and a missing id", () => {
    const noTitle = scheduleImportScheduleSchema.safeParse(validSchedule({ title: undefined }));
    expect(noTitle.success).toBe(false);
    const noId = scheduleImportScheduleSchema.safeParse(validSchedule({ id: undefined }));
    expect(noId.success).toBe(false);
  });

  it("rejects an invalid calendar date (2026-02-30 does not exist)", () => {
    const result = scheduleImportScheduleSchema.safeParse(validSchedule({ date: "2026-02-30" }));
    expect(result.success).toBe(false);
    expect(issueMessages(result.error)).toEqual(
      expect.arrayContaining([expect.stringContaining("Invalid date or start time")]),
    );
  });

  it("rejects a malformed date and malformed times", () => {
    expect(scheduleImportScheduleSchema.safeParse(validSchedule({ date: "15/11/2026" })).success).toBe(false);
    expect(scheduleImportScheduleSchema.safeParse(validSchedule({ start: "9:00" })).success).toBe(false);
    expect(scheduleImportScheduleSchema.safeParse(validSchedule({ start: "25:00" })).success).toBe(false);
    expect(scheduleImportScheduleSchema.safeParse(validSchedule({ end: "10:60" })).success).toBe(false);
  });

  it("rejects end <= start (overnight is not supported in v1)", () => {
    expect(scheduleImportScheduleSchema.safeParse(validSchedule({ start: "10:00", end: "09:00" })).success).toBe(false);
    const equal = scheduleImportScheduleSchema.safeParse(validSchedule({ start: "09:00", end: "09:00" }));
    expect(equal.success).toBe(false);
    expect(issueMessages(equal.error)).toEqual(
      expect.arrayContaining([expect.stringContaining("End time must be after start time")]),
    );
  });

  it("rejects an unknown status", () => {
    expect(scheduleImportScheduleSchema.safeParse(validSchedule({ status: "tentative" })).success).toBe(false);
  });

  it("rejects over-long fields", () => {
    expect(scheduleImportScheduleSchema.safeParse(validSchedule({ id: "x".repeat(129) })).success).toBe(false);
    expect(scheduleImportScheduleSchema.safeParse(validSchedule({ title: "x".repeat(201) })).success).toBe(false);
    expect(scheduleImportScheduleSchema.safeParse(validSchedule({ description: "x".repeat(2001) })).success).toBe(false);
    expect(scheduleImportScheduleSchema.safeParse(validSchedule({ location: "x".repeat(201) })).success).toBe(false);
    expect(scheduleImportScheduleSchema.safeParse(validSchedule({ note: "x".repeat(2001) })).success).toBe(false);
  });
});

describe("scheduleImportEnvelopeSchema", () => {
  it("accepts a valid envelope", () => {
    expect(scheduleImportEnvelopeSchema.parse(validEnvelope()).schedules).toHaveLength(1);
  });

  it("rejects a wrong type or version", () => {
    expect(scheduleImportEnvelopeSchema.safeParse(validEnvelope({ type: "other" })).success).toBe(false);
    expect(scheduleImportEnvelopeSchema.safeParse(validEnvelope({ version: "2.0" })).success).toBe(false);
  });

  it("rejects a missing source and a non-ISO generatedAt", () => {
    expect(scheduleImportEnvelopeSchema.safeParse(validEnvelope({ source: undefined })).success).toBe(false);
    expect(scheduleImportEnvelopeSchema.safeParse(validEnvelope({ generatedAt: "14/11/2026" })).success).toBe(false);
  });

  it("accepts the optional importId (<=128) and preview flag", () => {
    const parsed = scheduleImportEnvelopeSchema.parse(validEnvelope({ importId: "imp-1", preview: true }));
    expect(parsed.importId).toBe("imp-1");
    expect(parsed.preview).toBe(true);
  });

  it("rejects an over-long importId", () => {
    expect(scheduleImportEnvelopeSchema.safeParse(validEnvelope({ importId: "x".repeat(129) })).success).toBe(false);
  });

  it("rejects duplicate ids and names the duplicated ids in the error", () => {
    const payload = validEnvelope({
      schedules: [validSchedule({ id: "DUP-1" }), validSchedule({ id: "DUP-2" }), validSchedule({ id: "DUP-1" }), validSchedule({ id: "DUP-2" })],
    });
    const result = scheduleImportEnvelopeSchema.safeParse(payload);
    expect(result.success).toBe(false);
    const messages = issueMessages(result.error);
    expect(messages).toEqual(expect.arrayContaining([expect.stringContaining("Duplicate schedule ids: DUP-1, DUP-2")]));
  });

  it("rejects more than MAX_IMPORT_SCHEDULES schedules", () => {
    const schedules = Array.from({ length: MAX_IMPORT_SCHEDULES + 1 }, (_, i) => validSchedule({ id: `S-${i}` }));
    expect(scheduleImportEnvelopeSchema.safeParse(validEnvelope({ schedules })).success).toBe(false);
  });

  it("accepts exactly MAX_IMPORT_SCHEDULES schedules", () => {
    const schedules = Array.from({ length: MAX_IMPORT_SCHEDULES }, (_, i) => validSchedule({ id: `S-${i}` }));
    expect(scheduleImportEnvelopeSchema.parse(validEnvelope({ schedules })).schedules).toHaveLength(MAX_IMPORT_SCHEDULES);
  });

  it("accepts an empty schedules array", () => {
    expect(scheduleImportEnvelopeSchema.parse(validEnvelope({ schedules: [] })).schedules).toHaveLength(0);
  });
});

describe("parseScheduleImportPayload", () => {
  it("converts VN wall-clock to UTC (09:00 VN = 02:00 UTC)", () => {
    const { envelope, schedules } = parseScheduleImportPayload(validEnvelope());
    expect(envelope.type).toBe("schedule_import");
    expect(schedules).toHaveLength(1);
    expect(schedules[0].externalId).toBe("EXCEL-001");
    expect(schedules[0].startsAt.toISOString()).toBe("2026-11-15T02:00:00.000Z");
    expect(schedules[0].endsAt.toISOString()).toBe("2026-11-15T03:00:00.000Z");
    expect(schedules[0].status).toBe("confirmed");
  });

  it("throws ZodError for a non-object / malformed payload", () => {
    expect(() => parseScheduleImportPayload(null)).toThrow(z.ZodError);
    expect(() => parseScheduleImportPayload("not json")).toThrow(z.ZodError);
    expect(() => parseScheduleImportPayload({})).toThrow(z.ZodError);
  });

  it("throws ZodError naming duplicate ids", () => {
    const payload = validEnvelope({
      schedules: [validSchedule({ id: "DUP-9" }), validSchedule({ id: "DUP-9" })],
    });
    let messages: string[] = [];
    try {
      parseScheduleImportPayload(payload);
    } catch (error) {
      messages = issueMessages(error);
    }
    expect(messages).toEqual(expect.arrayContaining([expect.stringContaining("DUP-9")]));
  });
});
