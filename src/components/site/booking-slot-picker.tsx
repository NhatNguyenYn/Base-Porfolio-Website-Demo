"use client";

import { utcToVnLocalParts, formatVnDate } from "@/lib/booking-time";
import type { PublicSlotDto } from "@/server/queries/bookings";
import type { BookingMessages } from "@/i18n/messages/vi";
import type { Locale } from "@/i18n/config";

export function BookingSlotPicker({
  slots,
  selectedSlotId,
  onSelect,
  messages,
  locale,
}: {
  slots: PublicSlotDto[];
  selectedSlotId: string | null;
  onSelect: (slotId: string) => void;
  messages: BookingMessages;
  locale: Locale;
}) {
  if (slots.length === 0) {
    return <p className="text-sm text-muted">{messages.noSlots}</p>;
  }

  // Group by VN calendar day, in chronological order.
  const groups = new Map<string, PublicSlotDto[]>();
  for (const slot of slots) {
    const day = utcToVnLocalParts(slot.startsAt).date;
    const list = groups.get(day) ?? [];
    list.push(slot);
    groups.set(day, list);
  }

  return (
    <div className="space-y-6">
      {Array.from(groups.entries()).map(([day, daySlots]) => (
        <div key={day}>
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
            {formatVnDate(`${day}T00:00:00Z`, locale)}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {daySlots.map((slot) => {
              const parts = utcToVnLocalParts(slot.startsAt);
              const endParts = utcToVnLocalParts(slot.endsAt);
              const isBooked = slot.status === "booked";
              const isBlocked = slot.status === "blocked";
              const disabled = isBooked || isBlocked;
              const selected = selectedSlotId === slot.slotId;
              return (
                <button
                  key={slot.slotId}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(slot.slotId)}
                  aria-pressed={selected}
                  className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    selected
                      ? "border-accent bg-accent-soft text-accent"
                      : disabled
                        ? "cursor-not-allowed border-line bg-surface-muted/60 text-muted"
                        : "border-line bg-surface hover:border-ink"
                  }`}
                >
                  <span className="block text-sm font-medium tabular-nums">
                    {parts.time} – {endParts.time}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug">
                    {isBooked && slot.flower
                      ? messages.slotBookedByFlower.replace("{flower}", slot.flower.name)
                      : isBlocked
                        ? messages.slotBlocked
                        : messages.available}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
