// Unit tests for VN local <-> UTC conversion (Phase 10 booking).
// Pure functions only — no database. Asia/Ho_Chi_Minh is UTC+7 year-round.
import { describe, expect, it } from "vitest";
import {
  deriveEndsAt,
  formatVnDateTime,
  timeZoneOffsetMinutes,
  toLocalDateTimeInput,
  utcToVnLocalParts,
  vnLocalToUtc,
  VN_TIME_ZONE,
} from "@/lib/booking-time";

describe("vnLocalToUtc", () => {
  it("converts a VN wall-clock time to UTC (UTC+7)", () => {
    // 09:00 in Vietnam = 02:00 UTC.
    expect(vnLocalToUtc("2026-11-16", "09:00")?.toISOString()).toBe("2026-11-16T02:00:00.000Z");
  });

  it("converts a late-evening VN time across the UTC date boundary", () => {
    // 01:30 VN on the 17th = 18:30 UTC on the 16th.
    expect(vnLocalToUtc("2026-11-17", "01:30")?.toISOString()).toBe("2026-11-16T18:30:00.000Z");
  });

  it("handles midnight and end of day", () => {
    expect(vnLocalToUtc("2026-11-16", "00:00")?.toISOString()).toBe("2026-11-15T17:00:00.000Z");
    expect(vnLocalToUtc("2026-11-16", "23:59")?.toISOString()).toBe("2026-11-16T16:59:00.000Z");
  });

  it("rejects malformed input", () => {
    expect(vnLocalToUtc("2026-13-01", "09:00")).toBeNull();
    expect(vnLocalToUtc("2026-11-16", "24:00")).toBeNull();
    expect(vnLocalToUtc("16/11/2026", "09:00")).toBeNull();
    expect(vnLocalToUtc("2026-11-16", "9:00")).toBeNull();
    expect(vnLocalToUtc("", "")).toBeNull();
  });
});

describe("utcToVnLocalParts", () => {
  it("round-trips vnLocalToUtc", () => {
    const utc = vnLocalToUtc("2026-11-16", "09:00");
    expect(utc).not.toBeNull();
    expect(utcToVnLocalParts(utc as Date)).toEqual({ date: "2026-11-16", time: "09:00" });
  });

  it("converts a UTC instant to VN wall-clock parts", () => {
    expect(utcToVnLocalParts(new Date("2026-11-16T02:00:00.000Z"))).toEqual({
      date: "2026-11-16",
      time: "09:00",
    });
    expect(utcToVnLocalParts("2026-11-16T18:30:00.000Z")).toEqual({
      date: "2026-11-17",
      time: "01:30",
    });
  });
});

describe("timeZoneOffsetMinutes", () => {
  it("reports +420 minutes for Asia/Ho_Chi_Minh", () => {
    expect(timeZoneOffsetMinutes(VN_TIME_ZONE, new Date("2026-11-16T00:00:00.000Z"))).toBe(420);
  });
});

describe("deriveEndsAt", () => {
  it("adds the duration server-side", () => {
    const start = new Date("2026-11-16T02:00:00.000Z");
    expect(deriveEndsAt(start, 30).toISOString()).toBe("2026-11-16T02:30:00.000Z");
    expect(deriveEndsAt(start, 60).toISOString()).toBe("2026-11-16T03:00:00.000Z");
  });
});

describe("toLocalDateTimeInput", () => {
  it("formats a UTC instant as VN datetime-local value", () => {
    expect(toLocalDateTimeInput(new Date("2026-11-16T02:00:00.000Z"))).toBe("2026-11-16T09:00");
    expect(toLocalDateTimeInput(null)).toBe("");
    expect(toLocalDateTimeInput(undefined)).toBe("");
  });
});

describe("formatVnDateTime", () => {
  it("formats in VN time for both locales", () => {
    const value = new Date("2026-11-16T02:00:00.000Z");
    expect(formatVnDateTime(value, "vi")).toContain("09:00");
    expect(formatVnDateTime(value, "vi")).toContain("16/11/2026");
    expect(formatVnDateTime(value, "en")).toContain("09:00");
  });

  it("returns an em dash for missing/invalid input", () => {
    expect(formatVnDateTime(null, "vi")).toBe("—");
    expect(formatVnDateTime("not-a-date", "vi")).toBe("—");
  });
});
