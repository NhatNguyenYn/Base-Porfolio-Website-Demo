// Survey theme renderer (Phase 10, Agent C) — thin React wrapper over the
// pure helpers in src/lib/survey-theme.ts (kept `.ts` so unit tests can
// import them; the repo tsconfig sets `"jsx": "preserve"` and vitest cannot
// parse `.tsx` imports).
//
// Themes are expressed ONLY through CSS variables holding validated hex
// colours (or preset defaults) — never raw CSS from the database.
import type { ReactNode } from "react";
import {
  surveyLayoutClass,
  surveyThemeVariables,
  type PublicSurveyTheme,
} from "@/lib/survey-theme";

export {
  hexToRgba,
  isValidHexColor,
  parseAccentedTitle,
  resolveSurveyTheme,
  surveyDotPatternStyle,
  surveyLayoutClass,
  surveyThemeVariables,
  SURVEY_THEME_PRESETS,
} from "@/lib/survey-theme";
export type {
  AccentedTitleSegment,
  PublicSurveyBorderRadius,
  PublicSurveyButtonStyle,
  PublicSurveyLayout,
  PublicSurveyProgressStyle,
  PublicSurveyTheme,
  PublicSurveyThemePreset,
  ResolvedSurveyTheme,
} from "@/lib/survey-theme";

/**
 * Scoped theme wrapper for the whole public survey. All survey chrome inside
 * reads the `--survey-*` variables; the rest of the page keeps the site theme.
 */
export function SurveyTheme({
  theme,
  children,
}: {
  theme: PublicSurveyTheme;
  children: ReactNode;
}) {
  return (
    <div
      className={surveyLayoutClass(theme.layout)}
      style={surveyThemeVariables(theme)}
      data-survey-preset={theme.preset}
      data-survey-layout={theme.layout}
    >
      {children}
    </div>
  );
}
