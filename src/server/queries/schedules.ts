import "server-only";

import { prisma } from "../db";

/** Statuses shown on the public upcoming-schedule list (D9). */
export const UPCOMING_IMPORTED_SCHEDULE_STATUSES = ["scheduled", "confirmed"] as const;

export type ImportedScheduleStatus = "scheduled" | "confirmed" | "completed" | "cancelled";

/** Public DTO for one imported schedule. No connection/token/contact data. */
export type ImportedScheduleDto = {
  id: string;
  externalId: string;
  title: string;
  description: string;
  location: string;
  startsAt: Date;
  endsAt: Date;
  status: ImportedScheduleStatus;
};

export type ListUpcomingImportedSchedulesOptions = {
  /** Lower bound for startsAt. Defaults to now; a past value is clamped to now so the list stays upcoming-only. */
  from?: Date;
  /** Upper bound for startsAt (inclusive). */
  to?: Date;
  /** Max rows, default 20. */
  limit?: number;
};

/**
 * Public upcoming imported schedules (D9): startsAt >= now AND status in
 * (scheduled, confirmed), ordered by startsAt ascending.
 *
 * Scope note: this is a PUBLIC list — schedules from every connection
 * (and the manual-admin scope, connectionId null) appear together, with
 * no connection attribution. cancelled/completed schedules never appear
 * here, and past schedules never appear even when `from` is in the past.
 */
export async function listUpcomingImportedSchedules(
  options: ListUpcomingImportedSchedulesOptions = {},
): Promise<ImportedScheduleDto[]> {
  const now = new Date();
  const from = options.from && options.from.getTime() > now.getTime() ? options.from : now;
  const limit = options.limit ?? 20;

  const rows = await prisma.importedSchedule.findMany({
    where: {
      status: { in: [...UPCOMING_IMPORTED_SCHEDULE_STATUSES] },
      startsAt: {
        gte: from,
        ...(options.to ? { lte: options.to } : {}),
      },
    },
    select: {
      id: true,
      externalId: true,
      title: true,
      description: true,
      location: true,
      startsAt: true,
      endsAt: true,
      status: true,
    },
    orderBy: { startsAt: "asc" },
    take: limit,
  });

  return rows.map((row) => ({
    id: row.id,
    externalId: row.externalId,
    title: row.title,
    description: row.description,
    location: row.location,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    // Status is a plain String column; the query filters it to the two
    // upcoming statuses, so the cast is safe.
    status: row.status as ImportedScheduleStatus,
  }));
}
