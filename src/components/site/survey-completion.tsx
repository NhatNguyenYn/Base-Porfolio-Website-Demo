// Completion screen (Phase 10, 15:14 photo reference — spirit only).
//
// Small caps "RESPONSE RECEIVED" line, large thank-you title in the accent
// colour, the admin-configured completion message, and the gradient pill
// badge. For a standalone survey the badge shows the survey title (there is
// no flower for a standalone response — the flower badge belongs to
// bookings, which reuse this component with a flower name via `badgeText`).
// Shown only after the backend confirms the response was stored; never
// shows other respondents' data.
"use client";

import Link from "next/link";
import type { SurveyMessages } from "@/i18n/messages/vi";
import { GradientBadge } from "./gradient-badge";

export function SurveyCompletion({
  title,
  completionMessage,
  messages,
  homeHref,
  badgeText,
  badgeFromColor,
  badgeToColor,
}: {
  /** Survey title, for context on the thank-you screen. */
  title: string;
  /** Admin-configured completion message; empty falls back to the default. */
  completionMessage: string;
  messages: SurveyMessages;
  homeHref: string;
  /** Badge text. Defaults to the survey title (standalone survey). */
  badgeText?: string;
  /** Validated hex gradient colours; null falls back to the theme accent → primary. */
  badgeFromColor?: string | null;
  badgeToColor?: string | null;
}) {
  return (
    <div className="px-1 py-8 text-center sm:px-4 sm:py-12">
      <p className="text-[12px] font-bold uppercase leading-snug tracking-[0.22em] text-[var(--survey-accent)]">
        {messages.receivedLabel}
      </p>
      <h2 className="mx-auto mt-4 max-w-2xl text-[clamp(1.9rem,6.5vw,2.9rem)] font-extrabold leading-[1.15] tracking-tight text-[var(--survey-accent)]">
        {messages.completionTitle}
      </h2>
      <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-muted">
        {completionMessage.trim() || messages.completionDefaultMessage}
      </p>
      <p className="mx-auto mt-2 max-w-md text-[12px] leading-relaxed text-muted">{title}</p>
      <div className="mt-9 flex justify-center">
        <GradientBadge
          text={badgeText ?? title}
          fromColor={badgeFromColor}
          toColor={badgeToColor}
        />
      </div>
      <Link href={homeHref} className="btn btn-primary mt-10">
        {messages.backHome}
      </Link>
    </div>
  );
}
