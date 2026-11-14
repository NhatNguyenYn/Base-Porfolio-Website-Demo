import type { Locale } from "@/i18n/config";
import { formatVnDateTime, utcToVnLocalParts } from "@/lib/booking-time";
import type { ImportedScheduleDto } from "@/server/queries/schedules";

/**
 * Server-side list of upcoming imported schedules for the public booking
 * page (D9). Read-only: title, VN date + time range, location when set,
 * and a status chip. Uses the same card/border classes as the service
 * cards on the booking page.
 *
 * Labels come from the page (dict.booking.* — owned by Worker C) so this
 * component carries no i18n keys of its own.
 */
export function ImportedScheduleList({
  schedules,
  locale,
  emptyLabel,
  statusScheduledLabel,
  statusConfirmedLabel,
}: {
  schedules: ImportedScheduleDto[];
  locale: Locale;
  emptyLabel: string;
  statusScheduledLabel: string;
  statusConfirmedLabel: string;
}) {
  if (schedules.length === 0) {
    return <p className="mt-4 text-sm text-muted">{emptyLabel}</p>;
  }

  return (
    <ul className="mt-6 grid gap-5 md:grid-cols-2">
      {schedules.map((schedule) => (
        <li key={schedule.id} className="border border-line bg-surface p-6 sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-[17px] tracking-tight">{schedule.title}</h3>
            <span className="chip shrink-0">
              {schedule.status === "confirmed" ? statusConfirmedLabel : statusScheduledLabel}
            </span>
          </div>
          <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
            {formatVnDateTime(schedule.startsAt, locale)} – {utcToVnLocalParts(schedule.endsAt).time}
          </p>
          {schedule.location && (
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{schedule.location}</p>
          )}
          {schedule.description && (
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{schedule.description}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
