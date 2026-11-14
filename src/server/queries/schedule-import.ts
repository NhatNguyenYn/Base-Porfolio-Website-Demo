// Admin read queries for the Schedule JSON Import page (Phase 11, D8/D10).
//
// Server-only. These power /admin/schedule-import (connections panel,
// history list, month calendar) and the per-import detail page. They read
// the Phase 11 tables only and never return a token or token hash.

import "server-only";

import { prisma } from "../db";
import { utcToVnLocalParts, vnLocalToUtc } from "@/lib/booking-time";

export type AdminConnectionRow = {
  id: string;
  name: string;
  autoApply: boolean;
  isActive: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
  scheduleCount: number;
  importCount: number;
};

/** All integration connections, newest first, with usage counts. */
export async function listIntegrationConnections(): Promise<AdminConnectionRow[]> {
  const rows = await prisma.integrationConnection.findMany({
    select: {
      id: true,
      name: true,
      autoApply: true,
      isActive: true,
      lastUsedAt: true,
      createdAt: true,
      _count: { select: { schedules: true, imports: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    autoApply: row.autoApply,
    isActive: row.isActive,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
    scheduleCount: row._count.schedules,
    importCount: row._count.imports,
  }));
}

export type ScheduleImportFilters = {
  source?: string;
  status?: string;
  page?: number;
  perPage?: number;
};

export type AdminScheduleImportRow = {
  id: string;
  connectionId: string | null;
  connectionName: string | null;
  source: string;
  status: string;
  totalRecords: number;
  createdCount: number;
  updatedCount: number;
  unchangedCount: number;
  cancelledCount: number;
  failedCount: number;
  importKey: string | null;
  createdAt: Date;
};

/**
 * Paginated import history, newest first. Filters: exact `source`
 * substring match (case-insensitive) and exact `status`. `total` is the
 * filtered count, for the Pagination component.
 */
export async function listScheduleImports(
  filters: ScheduleImportFilters = {},
): Promise<{ items: AdminScheduleImportRow[]; total: number; page: number; perPage: number }> {
  const perPage = Math.min(Math.max(1, filters.perPage ?? 10), 50);
  const page = Math.max(1, filters.page ?? 1);
  const where: { source?: { contains: string; mode: "insensitive" }; status?: string } = {};
  if (filters.source) where.source = { contains: filters.source, mode: "insensitive" };
  if (filters.status) where.status = filters.status;

  const [total, rows] = await Promise.all([
    prisma.scheduleImport.count({ where }),
    prisma.scheduleImport.findMany({
      where,
      select: {
        id: true,
        connectionId: true,
        source: true,
        status: true,
        totalRecords: true,
        createdCount: true,
        updatedCount: true,
        unchangedCount: true,
        cancelledCount: true,
        failedCount: true,
        importKey: true,
        createdAt: true,
        connection: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      connectionId: row.connectionId,
      connectionName: row.connection?.name ?? null,
      source: row.source,
      status: row.status,
      totalRecords: row.totalRecords,
      createdCount: row.createdCount,
      updatedCount: row.updatedCount,
      unchangedCount: row.unchangedCount,
      cancelledCount: row.cancelledCount,
      failedCount: row.failedCount,
      importKey: row.importKey,
      createdAt: row.createdAt,
    })),
    total,
    page,
    perPage,
  };
}

export type ScheduleImportDetail = AdminScheduleImportRow & {
  payloadHash: string | null;
  errorSummary: string | null;
  createdByUserId: string | null;
  items: { id: string; externalId: string; action: string; error: string | null }[];
};

/** One import run with every per-record item, or null when unknown. */
export async function getScheduleImportDetail(id: string): Promise<ScheduleImportDetail | null> {
  const row = await prisma.scheduleImport.findUnique({
    where: { id },
    select: {
      id: true,
      connectionId: true,
      source: true,
      status: true,
      totalRecords: true,
      createdCount: true,
      updatedCount: true,
      unchangedCount: true,
      cancelledCount: true,
      failedCount: true,
      importKey: true,
      payloadHash: true,
      errorSummary: true,
      createdByUserId: true,
      createdAt: true,
      connection: { select: { name: true } },
      items: {
        select: { id: true, externalId: true, action: true, error: true },
        orderBy: { externalId: "asc" },
      },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    connectionId: row.connectionId,
    connectionName: row.connection?.name ?? null,
    source: row.source,
    status: row.status,
    totalRecords: row.totalRecords,
    createdCount: row.createdCount,
    updatedCount: row.updatedCount,
    unchangedCount: row.unchangedCount,
    cancelledCount: row.cancelledCount,
    failedCount: row.failedCount,
    importKey: row.importKey,
    payloadHash: row.payloadHash,
    errorSummary: row.errorSummary,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    items: row.items,
  };
}

export type CalendarScheduleRow = {
  id: string;
  externalId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  connectionName: string | null;
};

/** Current VN year-month ("YYYY-MM") for the calendar default. */
export function currentVnMonth(): string {
  const parts = utcToVnLocalParts(new Date());
  return parts.date.slice(0, 7);
}

/**
 * Imported schedules for one VN calendar month (`month` "YYYY-MM"), or
 * for a single VN date (`date` "YYYY-MM-DD", which wins over `month`).
 * Optional `status` filter. Ordered by start time ascending. A month is
 * converted to a UTC range via `vnLocalToUtc`, so DST-free VN wall-clock
 * boundaries are exact; overnight schedules are not supported in v1 (D3).
 */
export async function listImportedSchedulesForCalendar(input: {
  month?: string;
  date?: string;
  status?: string;
}): Promise<CalendarScheduleRow[]> {
  let from: Date | null = null;
  let to: Date | null = null;

  if (input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    from = vnLocalToUtc(input.date, "00:00");
    const [year, month, day] = input.date.split("-").map(Number);
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    to = vnLocalToUtc(
      `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`,
      "00:00",
    );
  } else {
    const month = /^\d{4}-\d{2}$/.test(input.month ?? "") ? (input.month as string) : currentVnMonth();
    const [year, monthNumber] = month.split("-").map(Number);
    from = vnLocalToUtc(`${month}-01`, "00:00");
    const nextMonth = monthNumber === 12 ? `${year + 1}-01` : `${year}-${String(monthNumber + 1).padStart(2, "0")}`;
    to = vnLocalToUtc(`${nextMonth}-01`, "00:00");
  }
  if (!from || !to) return [];

  const rows = await prisma.importedSchedule.findMany({
    where: {
      startsAt: { gte: from, lt: to },
      ...(input.status ? { status: input.status } : {}),
    },
    select: {
      id: true,
      externalId: true,
      title: true,
      startsAt: true,
      endsAt: true,
      status: true,
      connection: { select: { name: true } },
    },
    orderBy: { startsAt: "asc" },
    take: 500,
  });
  return rows.map((row) => ({
    id: row.id,
    externalId: row.externalId,
    title: row.title,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    status: row.status,
    connectionName: row.connection?.name ?? null,
  }));
}
