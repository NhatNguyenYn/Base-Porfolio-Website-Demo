// VN local time <-> UTC conversion helpers (Phase 10 booking).
//
// Storage rule (audit §11.5): slots are stored in UTC in the DB and displayed
// in Asia/Ho_Chi_Minh. Admins type VN wall-clock time; this module converts it
// to UTC before insert, and converts UTC back to VN wall-clock for display.
// Asia/Ho_Chi_Minh has no DST, but the offset is still derived from Intl so
// the conversion stays correct if the zone rules ever change. Pure functions,
// unit-tested in tests/booking-time.test.ts (no DB).

export const VN_TIME_ZONE = "Asia/Ho_Chi_Minh";

/** Offset of a time zone from UTC, in minutes, at a given instant. */
export function timeZoneOffsetMinutes(timeZone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(date).map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUtc - date.getTime()) / 60000);
}

/**
 * Parses VN wall-clock input ("YYYY-MM-DD" + "HH:MM") into a UTC Date.
 * Returns null for malformed input or a non-existent local time.
 */
export function vnLocalToUtc(date: string, time: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) return null;
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;

  // Treat the wall-clock fields as UTC, then subtract the zone offset.
  // A second pass re-derives the offset at the corrected instant (DST edge).
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const offset = timeZoneOffsetMinutes(VN_TIME_ZONE, guess);
  let utc = new Date(guess.getTime() - offset * 60000);
  const offset2 = timeZoneOffsetMinutes(VN_TIME_ZONE, utc);
  if (offset2 !== offset) utc = new Date(guess.getTime() - offset2 * 60000);

  // Round-trip guard: the UTC instant must display back as the input.
  const parts = utcToVnLocalParts(utc);
  if (parts.date !== date || parts.time !== time) return null;
  return utc;
}

/** VN wall-clock parts (date "YYYY-MM-DD", time "HH:MM") for a UTC instant. */
export function utcToVnLocalParts(date: Date | string): { date: string; time: string } {
  const instant = typeof date === "string" ? new Date(date) : date;
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone: VN_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(instant).map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

/** Value for `<input type="datetime-local">` showing a UTC instant in VN time. */
export function toLocalDateTimeInput(value: Date | null | undefined): string {
  if (!value) return "";
  const parts = utcToVnLocalParts(value);
  return `${parts.date}T${parts.time}`;
}

/** Slot end = start + duration. Always derived server-side, never from the client. */
export function deriveEndsAt(startsAt: Date, durationMinutes: number): Date {
  return new Date(startsAt.getTime() + durationMinutes * 60000);
}

/** Human-readable VN-time string, e.g. "16/11/2026, 09:00" (vi) / "16/11/2026, 09:00" (en). */
export function formatVnDateTime(value: Date | string | null | undefined, locale: "vi" | "en"): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", {
    timeZone: VN_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/** VN date only, e.g. "16/11/2026". */
export function formatVnDate(value: Date | string | null | undefined, locale: "vi" | "en"): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", {
    timeZone: VN_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
