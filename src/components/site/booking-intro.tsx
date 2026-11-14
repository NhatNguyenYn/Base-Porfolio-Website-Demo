// Booking intro page (Phase 10, 15:14 photo reference — spirit only).
//
// Layout follows the two reference screenshots WITHOUT copying their brand:
// a top brand strip (logo + brand name), a large editorial title with the
// final word in the accent colour, an italic serif subtitle, a description,
// coloured-dot bullets (question count, estimated time, go-back note, contact
// purpose + flower anonymity, service info), a light background with a faint
// dotted pattern, and a pale-pink card when booking is unavailable.
// All colours come from the intake survey theme (validated hex only, via C's
// surveyThemeVariables); "editorial-vn" maps onto C's editorial palette
// because C's SURVEY_THEME_PRESETS has no editorial-vn entry yet.
import type { CSSProperties, ReactNode } from "react";
import { assetUrl } from "@/lib/asset";
import { isValidHexColor, surveyLayoutClass, surveyThemeVariables } from "./survey-theme";
import type { PublicSurveyTheme } from "@/data/surveys";
import type { BookingThemeData } from "@/server/queries/bookings";

function asPreset(value: string): PublicSurveyTheme["preset"] {
  if (value === "editorial" || value === "modern" || value === "premium" || value === "editorial-vn") {
    return value;
  }
  return "minimal";
}

function asLayout(value: string): PublicSurveyTheme["layout"] {
  return value === "split" || value === "editorial" ? value : "centered";
}

function asProgressStyle(value: string): PublicSurveyTheme["progressStyle"] {
  return value === "dots" || value === "steps" ? value : "bar";
}

function asButtonStyle(value: string): PublicSurveyTheme["buttonStyle"] {
  return value === "outline" ? "outline" : "solid";
}

function asBorderRadius(value: string): PublicSurveyTheme["borderRadius"] {
  return value === "sm" || value === "lg" || value === "full" ? value : "md";
}

/** Map the booking theme onto C's PublicSurveyTheme (editorial-vn -> editorial palette). */
export function toPublicSurveyTheme(theme: BookingThemeData): PublicSurveyTheme {
  return {
    preset: asPreset(theme.preset) === "editorial-vn" ? "editorial" : asPreset(theme.preset),
    layout: asLayout(theme.layout),
    progressStyle: asProgressStyle(theme.progressStyle),
    buttonStyle: asButtonStyle(theme.buttonStyle),
    borderRadius: asBorderRadius(theme.borderRadius),
    primaryColor: theme.primaryColor,
    accentColor: theme.accentColor,
    backgroundColor: theme.backgroundColor,
    surfaceColor: theme.surfaceColor,
    textColor: theme.textColor,
  };
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Gradient-badge colours for the completion screen: stored overrides win, else accent -> primary. */
export function resolveBookingBadge(theme: BookingThemeData): { fromColor: string; toColor: string } {
  const vars = surveyThemeVariables(toPublicSurveyTheme(theme)) as Record<string, string>;
  const accent = vars["--survey-accent"] ?? "#9b1c31";
  const primary = vars["--survey-primary"] ?? "#17233a";
  return {
    fromColor: isValidHexColor(theme.badgeFromColor) ? theme.badgeFromColor.trim() : accent,
    toColor: isValidHexColor(theme.badgeToColor) ? theme.badgeToColor.trim() : primary,
  };
}

/** Editorial title with the final word in the accent colour (like the reference). */
function AccentTitle({ title }: { title: string }) {
  const words = title.trim().split(/\s+/);
  if (words.length <= 1) {
    return <span style={{ color: "var(--survey-accent)" }}>{title}</span>;
  }
  const last = words[words.length - 1];
  const rest = words.slice(0, -1).join(" ");
  return (
    <>
      {rest} <span style={{ color: "var(--survey-accent)" }}>{last}</span>
    </>
  );
}

export function BookingIntro({
  theme,
  brandName,
  brandLogoUrl,
  title,
  subtitle,
  description,
  bullets,
  unavailable,
  unavailableTitle,
  unavailableText,
  children,
}: {
  theme: BookingThemeData;
  brandName: string;
  brandLogoUrl: string | null;
  title: string;
  subtitle: string;
  description: string;
  bullets: string[];
  unavailable: boolean;
  unavailableTitle: string;
  unavailableText: string;
  children: ReactNode;
}) {
  const vars = surveyThemeVariables(toPublicSurveyTheme(theme)) as Record<string, string>;
  const accent = vars["--survey-accent"] ?? "#9b1c31";
  const primary = vars["--survey-primary"] ?? "#17233a";
  const background = vars["--survey-background"] ?? "#f8f8f6";

  const dottedStyle: CSSProperties = {
    ...vars,
    backgroundColor: background,
    backgroundImage: `radial-gradient(circle, ${hexToRgba(accent, 0.12)} 1.2px, transparent 1.6px), radial-gradient(circle, ${hexToRgba(primary, 0.1)} 1px, transparent 1.4px)`,
    backgroundSize: "34px 34px, 52px 52px",
    backgroundPosition: "0 0, 17px 26px",
  };

  return (
    <div className="pb-24" style={dottedStyle}>
      {/* Brand strip */}
      <div
        className="border-b"
        style={{ borderColor: hexToRgba(accent, 0.35), backgroundColor: hexToRgba(accent, 0.04) }}
      >
        <div className="container-page flex items-center gap-3 py-4">
          {brandLogoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={assetUrl(brandLogoUrl)} alt="" className="h-10 w-10 rounded-full object-cover" />
          )}
          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--survey-primary)]">
            {brandName}
          </p>
        </div>
      </div>

      <div className={surveyLayoutClass(toPublicSurveyTheme(theme).layout)}>
        <div className="container-page pt-10 lg:pt-14">
          {subtitle && (
            <p className="serif-accent text-[clamp(1.4rem,3vw,1.9rem)] italic leading-tight text-[var(--survey-accent)]">
              {subtitle}
            </p>
          )}
          <h1 className="display mt-4 text-[clamp(2.4rem,6vw,4.4rem)] leading-[1.05] text-[var(--survey-text)]">
            <AccentTitle title={title} />
          </h1>
          {description && (
            <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-muted">{description}</p>
          )}

          {bullets.length > 0 && (
            <ul className="mt-8 space-y-3">
              {bullets.map((bullet, index) => (
                <li key={index} className="flex items-start gap-3 text-[14.5px] leading-relaxed text-[var(--survey-text)]">
                  <span
                    aria-hidden="true"
                    className="mt-[7px] h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: index % 2 === 0 ? accent : primary }}
                  />
                  {bullet}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-10">
            {unavailable ? (
              <div
                className="rounded-2xl border p-6 sm:p-8"
                style={{
                  backgroundColor: hexToRgba(accent, 0.07),
                  borderColor: hexToRgba(accent, 0.25),
                }}
              >
                <h2 className="text-[19px] font-semibold tracking-tight text-[var(--survey-accent)]">
                  {unavailableTitle}
                </h2>
                <p className="mt-3 text-[14px] leading-relaxed text-[var(--survey-text)]">{unavailableText}</p>
              </div>
            ) : (
              children
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
