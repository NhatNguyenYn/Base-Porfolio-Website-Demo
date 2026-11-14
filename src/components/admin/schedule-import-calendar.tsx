// Month calendar of imported schedules (Phase 11, D8).
//
// Server component. Renders one VN calendar month as a responsive 7-column
// grid; each day cell lists that day's imported schedules (VN time range +
// title + status chip). Filters are plain GET params so the month navigation
// and the date/status filters share one URL shape:
//   ?month=YYYY-MM&calStatus=scheduled&calDate=YYYY-MM-DD
// A single `calDate` narrows the calendar to that VN day.

import Link from "next/link";

import { StatusBadge } from "@/components/admin/status-badge";
import type { CalendarScheduleRow } from "@/server/queries/schedule-import";
import { utcToVnLocalParts } from "@/lib/booking-time";

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Đã lên lịch",
  confirmed: "Đã xác nhận",
  completed: "Hoàn thành",
  cancelled: "Đã huỷ",
};

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "scheduled", label: "Đã lên lịch" },
  { value: "confirmed", label: "Đã xác nhận" },
  { value: "completed", label: "Hoàn thành" },
  { value: "cancelled", label: "Đã huỷ" },
];

function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return `Tháng ${monthNumber}/${year}`;
}

/** Calendar cells for a month: null = blank cell before day 1. */
function monthCells(year: number, monthNumber: number): (number | null)[] {
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  // getUTCDay: 0 = Sunday; VN week starts Monday.
  const firstWeekday = (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7;
  const cells: (number | null)[] = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function ScheduleImportCalendar({
  month,
  schedules,
  statusFilter,
  dateFilter,
  basePath,
  params,
}: {
  month: string;
  schedules: CalendarScheduleRow[];
  statusFilter?: string;
  dateFilter?: string;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const [year, monthNumber] = month.split("-").map(Number);
  const byDate = new Map<string, CalendarScheduleRow[]>();
  for (const schedule of schedules) {
    const date = utcToVnLocalParts(schedule.startsAt).date;
    const list = byDate.get(date) ?? [];
    list.push(schedule);
    byDate.set(date, list);
  }

  const hrefWith = (overrides: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...params, ...overrides })) {
      if (value) search.set(key, value);
    }
    const query = search.toString();
    return `${basePath}${query ? `?${query}` : ""}`;
  };

  return (
    <section aria-labelledby="schedule-import-calendar" className="mb-8 border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="schedule-import-calendar" className="text-[16px] font-medium tracking-tight">
          Lịch đã nhập
        </h2>
        <nav className="flex items-center gap-2" aria-label="Đổi tháng">
          <Link href={hrefWith({ month: shiftMonth(month, -1), calDate: undefined })} className="btn btn-outline btn-sm">
            ← Tháng trước
          </Link>
          <span className="min-w-[110px] text-center text-[13px] font-medium tabular-nums">{monthLabel(month)}</span>
          <Link href={hrefWith({ month: shiftMonth(month, 1), calDate: undefined })} className="btn btn-outline btn-sm">
            Tháng sau →
          </Link>
        </nav>
      </div>

      <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="month" value={month} />
        <div>
          <label className="field-label" htmlFor="calendar-date">
            Ngày
          </label>
          <input id="calendar-date" type="date" name="calDate" defaultValue={dateFilter ?? ""} className="field w-auto" />
        </div>
        <div>
          <label className="field-label" htmlFor="calendar-status">
            Trạng thái
          </label>
          <select id="calendar-status" name="calStatus" defaultValue={statusFilter ?? ""} className="field w-auto">
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-outline btn-sm">
          Lọc
        </button>
        {(dateFilter || statusFilter) && (
          <Link href={hrefWith({ calDate: undefined, calStatus: undefined })} className="btn btn-outline btn-sm">
            Xoá lọc
          </Link>
        )}
      </form>

      {schedules.length === 0 ? (
        <p className="mt-5 py-8 text-center text-[13px] text-muted">Tháng này chưa có lịch nào được nhập.</p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <div className="grid min-w-[720px] grid-cols-7 gap-px border border-line bg-line">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="bg-surface-muted/60 px-2 py-2 text-center text-[10px] font-medium uppercase tracking-[0.14em] text-muted"
              >
                {day}
              </div>
            ))}
            {monthCells(year, monthNumber).map((day, index) => {
              if (day === null) return <div key={`blank-${index}`} className="min-h-[96px] bg-surface" />;
              const dateKey = `${month}-${String(day).padStart(2, "0")}`;
              const daySchedules = byDate.get(dateKey) ?? [];
              return (
                <div key={dateKey} className="min-h-[96px] bg-surface p-1.5 align-top">
                  <p className="text-[11px] font-medium tabular-nums text-muted">{day}</p>
                  <ul className="mt-1 space-y-1">
                    {daySchedules.slice(0, 3).map((schedule) => {
                      const start = utcToVnLocalParts(schedule.startsAt).time;
                      const end = utcToVnLocalParts(schedule.endsAt).time;
                      return (
                        <li
                          key={schedule.id}
                          className="rounded-sm border border-line bg-surface-muted/50 px-1.5 py-1"
                          title={`${schedule.title} — ${schedule.connectionName ?? "Nhập tay"}`}
                        >
                          <span className="block truncate text-[11px] font-medium leading-tight">
                            {start}–{end} {schedule.title}
                          </span>
                          <span className="mt-0.5 block">
                            <StatusBadge
                              status={schedule.status}
                              label={STATUS_LABELS[schedule.status] ?? schedule.status}
                            />
                          </span>
                        </li>
                      );
                    })}
                    {daySchedules.length > 3 && (
                      <li className="px-1 text-[10.5px] text-muted">+{daySchedules.length - 3} lịch nữa</li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
