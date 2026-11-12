import type { Locale } from "@/i18n/config";

export type MediaView = {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  alt: string;
  title: string;
};

export type LocalizedRow<T> = {
  row: T | null;
  /** True when the row for this locale is missing (content is hidden, never fallback-rendered). */
  missing: boolean;
};

export type PublicStatus = "ok" | "not_translated" | "not_found";

/** Picks the translation row for a locale; other languages are never substituted. */
export function pickTranslation<T extends { locale: string }>(rows: T[], locale: Locale): LocalizedRow<T> {
  const row = rows.find((item) => item.locale === locale) ?? null;
  return { row, missing: !row };
}

export function hasTranslation(rows: { locale: string }[], locale: Locale): boolean {
  return rows.some((item) => item.locale === locale);
}

export function nullIfEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
