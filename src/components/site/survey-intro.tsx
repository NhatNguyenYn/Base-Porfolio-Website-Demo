// Public survey intro (Phase 10, 15:14 photo reference — spirit only).
//
// Mobile-first, 390px-safe: brand band (logo + brand name, falling back to
// the site brand), italic subtitle (only when the preset is editorial-vn),
// large editorial title with `**...**` spans in the accent colour,
// description, coloured-dot bullets, privacy note, and a start button.
// Closed mode shows the same intro with a pink "survey ended" status card
// instead of the start button — a closed survey never renders as a bare 404.
//
// No logo / name / colour of the organisation in the reference photos is
// used here: brand and colours always come from the survey theme or the
// site settings. "Có thể quay lại sửa câu trả lời" means going back a step
// inside the wizard (answers are kept) — NOT editing a response after it
// has been submitted.
"use client";

import Image from "next/image";
import type { PublicSurvey } from "@/data/surveys";
import { assetUrl } from "@/lib/asset";
import { dedupeBullets, interpolate } from "@/lib/utils";
import type { SurveyMessages } from "@/i18n/messages/vi";
import { parseAccentedTitle, surveyDotPatternStyle } from "./survey-theme";

export function SurveyIntro({
  survey,
  messages,
  brandName,
  brandLogoUrl,
  onStart,
  mode = "open",
}: {
  survey: PublicSurvey;
  messages: SurveyMessages;
  /** Survey brand name, or the site name when the survey sets none. */
  brandName: string;
  /** Survey brand logo URL, or the site logo URL when the survey sets none. */
  brandLogoUrl: string | null;
  /** Start button handler. Omitted in closed mode (no start button). */
  onStart?: () => void;
  mode?: "open" | "closed";
}) {
  const isEditorialVn = survey.theme.preset === "editorial-vn";
  // Auto facts first, then the admin's highlights — deduped, because a
  // highlight that restates an auto fact showed the same line twice
  // (Phase 10 visual check, 2026-11-14).
  const facts = survey.estimatedMinutes
    ? interpolate(messages.introFacts, { count: survey.totalQuestions, minutes: survey.estimatedMinutes })
    : interpolate(messages.questionCount, { count: survey.totalQuestions });
  const bullets = dedupeBullets([
    facts,
    messages.noPersonalData,
    messages.canGoBackAndEdit,
    ...survey.highlights,
  ]);

  return (
    <div
      className="min-w-0 px-1 py-2 sm:px-4"
      style={surveyDotPatternStyle(survey.theme)}
    >
      {/* Brand band */}
      <div className="flex min-w-0 items-center gap-3">
        {brandLogoUrl && (
          <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-line bg-surface">
            <Image
              src={assetUrl(brandLogoUrl)}
              alt=""
              fill
              sizes="48px"
              className="object-cover"
            />
          </span>
        )}
        <p className="min-w-0 break-words text-[15px] font-bold uppercase leading-snug tracking-[0.08em] text-[var(--survey-accent)]">
          {brandName}
        </p>
      </div>

      {/* Italic subtitle — italic only for the editorial-vn preset */}
      {survey.subtitle && (
        <p
          className={`mt-8 text-[1.35rem] leading-snug text-[var(--survey-accent)] ${
            isEditorialVn ? "serif-accent italic" : ""
          }`}
        >
          {survey.subtitle}
        </p>
      )}

      {/* Editorial title; **...** spans render in the accent colour */}
      <h1
        className={`mt-4 font-extrabold leading-[1.12] tracking-tight text-[var(--survey-primary)] ${
          isEditorialVn ? "text-[clamp(2.1rem,8vw,3.4rem)]" : "text-[clamp(1.9rem,5.5vw,2.9rem)]"
        }`}
      >
        {parseAccentedTitle(survey.title).map((segment, index) =>
          segment.accent ? (
            <span key={index} className="text-[var(--survey-accent)]">
              {segment.text}
            </span>
          ) : (
            <span key={index}>{segment.text}</span>
          ),
        )}
      </h1>

      {survey.description && (
        <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted">{survey.description}</p>
      )}
      {survey.introduction && (
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--survey-text)]">
          {survey.introduction}
        </p>
      )}

      {/* Coloured-dot bullets */}
      <ul className="mt-7 grid gap-3">
        {bullets.map((bullet, index) => (
          <li key={index} className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden="true"
              className={`mt-[7px] h-2.5 w-2.5 shrink-0 rounded-full ${
                index % 2 === 0 ? "bg-[var(--survey-accent)]" : "bg-[var(--survey-primary)]"
              }`}
            />
            <span className="min-w-0 break-words text-[15px] leading-relaxed text-muted">{bullet}</span>
          </li>
        ))}
      </ul>

      {/* Privacy note: the survey's own notice wins; the generic anonymous
          note is only the fallback. Rendering both said the same thing twice
          (Phase 10 visual check, 2026-11-14). */}
      {(survey.privacyNotice || messages.anonymousNote) && (
        <div className="mt-7 border-t border-line pt-5">
          <p className="label">{messages.privacyHeading}</p>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
            {survey.privacyNotice || messages.anonymousNote}
          </p>
        </div>
      )}

      {mode === "closed" ? (
        <div
          role="status"
          className="mt-8 border border-danger/25 bg-danger-soft px-5 py-5 sm:px-6"
          style={{ borderRadius: "var(--survey-radius)" }}
        >
          <p className="text-lg font-bold leading-snug text-danger">{messages.surveyClosedTitle}</p>
          <p className="mt-2 text-[14px] leading-relaxed text-ink">{messages.surveyClosedText}</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={onStart}
          disabled={survey.totalQuestions === 0}
          className="btn btn-primary mt-8 w-full sm:w-auto"
        >
          {messages.start}
        </button>
      )}
    </div>
  );
}
