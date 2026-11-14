"use client";

import Link from "next/link";
import { localeHref, type Locale } from "@/i18n/config";
import type { BookingMessages } from "@/i18n/messages/vi";
import { GradientBadge } from "./gradient-badge";

export type BookingConfirmation = {
  referenceCode: string;
  flowerCode: string;
  flowerName: string;
  service: string;
  startsAt: string;
  endsAt: string;
};

/**
 * Completion screen (15:14 photo reference — spirit only): "ĐÃ GHI NHẬN" caps
 * label, large thank-you title in the accent colour, description, and the
 * gradient pill badge showing the visitor's FLOWER name (replacing the
 * person's name in the reference photo). The badge is Agent C's shared
 * GradientBadge component (props: text / fromColor / toColor); the colours
 * come from the intake survey theme.
 */
export function BookingCompletion({
  confirmation,
  serviceName,
  startsAtLabel,
  badgeFromColor,
  badgeToColor,
  messages,
  locale,
}: {
  confirmation: BookingConfirmation;
  serviceName: string;
  startsAtLabel: string;
  badgeFromColor: string;
  badgeToColor: string;
  messages: BookingMessages;
  locale: Locale;
}) {
  return (
    <div
      className="border border-line bg-[var(--survey-surface)] p-6 text-center sm:p-10"
      style={{ borderRadius: "var(--survey-radius)" }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--survey-accent)]">
        {messages.recordedLabel}
      </p>
      <h2 className="mx-auto mt-4 max-w-md text-[clamp(1.8rem,5vw,2.6rem)] font-bold leading-tight tracking-tight text-[var(--survey-accent)]">
        {messages.thankYouTitle}
      </h2>
      <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted">{messages.thankYouText}</p>

      <div className="mt-8 flex justify-center">
        <GradientBadge text={confirmation.flowerName} fromColor={badgeFromColor} toColor={badgeToColor} />
      </div>
      <p className="mt-3 text-[12px] text-muted">{messages.flowerBadgeLabel}</p>

      <dl className="mx-auto mt-8 max-w-md space-y-3 border-t border-line pt-5 text-left text-[14px]">
        <div className="flex flex-wrap justify-between gap-2">
          <dt className="text-muted">{messages.serviceLabel}</dt>
          <dd className="font-medium">{serviceName}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <dt className="text-muted">{messages.timeLabel}</dt>
          <dd className="font-medium tabular-nums">{startsAtLabel}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <dt className="text-muted">{messages.referenceCodeLabel}</dt>
          <dd className="font-mono text-[15px] font-semibold tracking-[0.12em]">{confirmation.referenceCode}</dd>
        </div>
      </dl>

      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <Link href={localeHref(locale, "/booking/cancel")} className="btn btn-outline btn-sm">
          {messages.viewCancel}
        </Link>
        <Link href={localeHref(locale, "/booking")} className="btn btn-primary btn-sm">
          {messages.bookAgain}
        </Link>
      </div>
    </div>
  );
}
