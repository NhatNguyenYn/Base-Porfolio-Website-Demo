// Pure survey theme helpers (Phase 10, Agent C).
//
// Kept in a `.ts` module (not `.tsx`) so unit tests can import it: the repo
// tsconfig sets `"jsx": "preserve"`, and vitest cannot parse `.tsx` files
// imported from tests. The React wrapper lives in
// src/components/site/survey-theme.tsx and re-exports these helpers.
//
// Themes are expressed ONLY through CSS variables holding validated hex
// colours (or preset defaults) — never raw CSS from the database. The admin
// can only store hex colours (zod `hexColorField`) and enum presets, and the
// data layer re-validates every stored colour before it reaches a component.
import type { CSSProperties } from "react";

export type PublicSurveyThemePreset = "minimal" | "editorial" | "modern" | "premium" | "editorial-vn";
export type PublicSurveyLayout = "centered" | "split" | "editorial";
export type PublicSurveyProgressStyle = "bar" | "dots" | "steps";
export type PublicSurveyButtonStyle = "solid" | "outline";
export type PublicSurveyBorderRadius = "sm" | "md" | "lg" | "full";

export type PublicSurveyTheme = {
  preset: PublicSurveyThemePreset;
  layout: PublicSurveyLayout;
  progressStyle: PublicSurveyProgressStyle;
  buttonStyle: PublicSurveyButtonStyle;
  borderRadius: PublicSurveyBorderRadius;
  primaryColor: string | null;
  accentColor: string | null;
  backgroundColor: string | null;
  surfaceColor: string | null;
  textColor: string | null;
  /** Completion-badge gradient colours (validated hex; null = preset default). */
  badgeFromColor?: string | null;
  badgeToColor?: string | null;
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function isValidHexColor(value: string | null | undefined): value is string {
  return typeof value === "string" && HEX_COLOR.test(value.trim());
}

type ThemePalette = {
  primary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
};

/** Preset defaults, derived from the site design tokens (globals.css).
 * Colours are the PORTFOLIO's own palette — never the red/blue of the
 * reference organisation in the 15:14 photos. The preset only fixes the
 * STRUCTURE (header band, italic subtitle, editorial title, coloured-dot
 * bullets, pink status card, gradient badge); colours always come from the
 * configured theme. */
export const SURVEY_THEME_PRESETS: Record<PublicSurveyThemePreset, ThemePalette> = {
  minimal: {
    primary: "#17233a",
    accent: "#9b1c31",
    background: "#f8f8f6",
    surface: "#ffffff",
    text: "#20242c",
  },
  editorial: {
    primary: "#1c2b45",
    accent: "#9b1c31",
    background: "#f6f1e8",
    surface: "#fffefb",
    text: "#26221a",
  },
  modern: {
    primary: "#1e3a5f",
    accent: "#256b4d",
    background: "#f2f5f8",
    surface: "#ffffff",
    text: "#1d2733",
  },
  premium: {
    primary: "#e8e4d8",
    accent: "#c9a227",
    background: "#171a21",
    surface: "#21252f",
    text: "#f2f0ea",
  },
  // "Editorial VN" (15:14 photo reference): same portfolio palette as
  // minimal — the difference is structure, not colour.
  "editorial-vn": {
    primary: "#17233a",
    accent: "#9b1c31",
    background: "#f8f8f6",
    surface: "#ffffff",
    text: "#20242c",
  },
};

export type ResolvedSurveyTheme = ThemePalette & {
  preset: PublicSurveyThemePreset;
  layout: PublicSurveyLayout;
  progressStyle: PublicSurveyProgressStyle;
  buttonStyle: PublicSurveyButtonStyle;
  radius: string;
  /** Completion-badge gradient ends (validated hex, else accent → primary). */
  badgeFrom: string;
  badgeTo: string;
};

const RADIUS: Record<PublicSurveyBorderRadius, string> = {
  sm: "4px",
  md: "8px",
  lg: "16px",
  full: "9999px",
};

/** Resolve a stored theme to concrete values: validated overrides win, preset fills the rest. */
export function resolveSurveyTheme(theme: PublicSurveyTheme): ResolvedSurveyTheme {
  const preset = SURVEY_THEME_PRESETS[theme.preset];
  const primary = isValidHexColor(theme.primaryColor) ? theme.primaryColor.trim() : preset.primary;
  const accent = isValidHexColor(theme.accentColor) ? theme.accentColor.trim() : preset.accent;
  return {
    preset: theme.preset,
    layout: theme.layout,
    progressStyle: theme.progressStyle,
    buttonStyle: theme.buttonStyle,
    radius: RADIUS[theme.borderRadius],
    primary,
    accent,
    background: isValidHexColor(theme.backgroundColor)
      ? theme.backgroundColor.trim()
      : preset.background,
    surface: isValidHexColor(theme.surfaceColor) ? theme.surfaceColor.trim() : preset.surface,
    text: isValidHexColor(theme.textColor) ? theme.textColor.trim() : preset.text,
    badgeFrom: isValidHexColor(theme.badgeFromColor) ? theme.badgeFromColor.trim() : accent,
    badgeTo: isValidHexColor(theme.badgeToColor) ? theme.badgeToColor.trim() : primary,
  };
}

export function surveyThemeVariables(theme: PublicSurveyTheme): CSSProperties {
  const resolved = resolveSurveyTheme(theme);
  return {
    "--survey-primary": resolved.primary,
    "--survey-accent": resolved.accent,
    "--survey-background": resolved.background,
    "--survey-surface": resolved.surface,
    "--survey-text": resolved.text,
    "--survey-radius": resolved.radius,
  } as CSSProperties;
}

/** Container width per layout preset. */
export function surveyLayoutClass(layout: PublicSurveyLayout): string {
  switch (layout) {
    case "split":
      return "mx-auto w-full max-w-5xl";
    case "editorial":
      return "mx-auto w-full max-w-3xl";
    case "centered":
    default:
      return "mx-auto w-full max-w-2xl";
  }
}

/** "#rrggbb" → "rgba(r, g, b, alpha)". Returns null for an invalid colour. */
export function hexToRgba(hex: string, alpha: number): string | null {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Faint dot-network background for the intro panel (15:14 photo reference:
 * light background with a subtle dotted mesh). Two offset dot layers only —
 * pure CSS, no images, no animation, so `prefers-reduced-motion` is
 * respected by construction. Dots use the theme accent at very low alpha.
 */
export function surveyDotPatternStyle(theme: PublicSurveyTheme): CSSProperties {
  const resolved = resolveSurveyTheme(theme);
  const accentDot = hexToRgba(resolved.accent, 0.1) ?? "rgba(155, 28, 49, 0.1)";
  const primaryDot = hexToRgba(resolved.primary, 0.07) ?? "rgba(23, 35, 58, 0.07)";
  return {
    backgroundImage: [
      `radial-gradient(circle at 1px 1px, ${accentDot} 1.3px, transparent 0)`,
      `radial-gradient(circle at 1px 1px, ${primaryDot} 1.1px, transparent 0)`,
    ].join(", "),
    backgroundSize: "30px 30px, 30px 30px",
    backgroundPosition: "0 0, 15px 15px",
  };
}

export type AccentedTitleSegment = { text: string; accent: boolean };

/**
 * Split a title on `**...**` markers: the marked spans render in the accent
 * colour ("Thụ hưởng **AI**" → "AI" in accent). Unmatched markers are kept
 * as literal text, never dropped. No HTML is parsed — the title is plain
 * text from the translation table.
 */
export function parseAccentedTitle(title: string): AccentedTitleSegment[] {
  const segments: AccentedTitleSegment[] = [];
  const pattern = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(title)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: title.slice(lastIndex, match.index), accent: false });
    }
    segments.push({ text: match[1], accent: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < title.length) {
    segments.push({ text: title.slice(lastIndex), accent: false });
  }
  return segments.filter((segment) => segment.text.length > 0);
}
