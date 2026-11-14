import { clsx, type ClassValue } from "clsx";
import { getBasePath } from "./asset";

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/** URL-safe slug that keeps Vietnamese readable (đ → d, diacritics stripped). */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

export function formatDate(
  value: Date | string | null | undefined,
  locale: string,
  options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "long", year: "numeric" },
): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", options).format(date);
}

export function formatMonthYear(value: Date | string | null | undefined, locale: string): string {
  return formatDate(value, locale, { month: "short", year: "numeric" });
}

export function formatShortDate(value: Date | string | null | undefined, locale: string): string {
  return formatDate(value, locale, { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function readingMinutes(markdown: string): number {
  const words = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~\-[\]()]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export function absoluteUrl(path = "/"): string {
  // CMS media may already be stored on an absolute CDN/S3 origin.
  if (/^https?:\/\//i.test(path)) return path;
  const basePath = getBasePath();
  const origin = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  // In the Pages-export workflow APP_URL already contains the subpath
  // (https://<user>.github.io/Base-Porfolio-Website-Demo); in server mode
  // the base path is empty. Append it only when it is not already there,
  // so the result is never double-prefixed.
  const base = basePath && !origin.endsWith(basePath) ? `${origin}${basePath}` : origin;
  const clean = path.startsWith("/") ? path : `/${path}`;
  // A caller that already prefixed the path (e.g. `assetUrl` output) must
  // not gain the segment a second time.
  const unprefixed =
    basePath && (clean === basePath || clean.startsWith(`${basePath}/`))
      ? clean.slice(basePath.length) || "/"
      : clean;
  return `${base}${unprefixed}`;
}

export function parseCommaList(value: FormDataEntryValue | null | undefined): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function truncate(text: string, max = 160): string {
  const clean = text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

/** Convert markdown-ish content to a short plain text excerpt. */
export function markdownExcerpt(markdown: string, max = 180): string {
  const clean = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return truncate(clean, max);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function parsePage(value: string | string[] | undefined, fallback = 1): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function safeInternalPath(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export function paginate<T>(items: T[], page: number, perPage: number): T[] {
  const start = (page - 1) * perPage;
  return items.slice(start, start + perPage);
}

export function totalPages(count: number, perPage: number): number {
  return Math.max(1, Math.ceil(count / perPage));
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function aspectRatio(width?: number | null, height?: number | null): number {
  if (!width || !height) return 4 / 5;
  return width / height;
}

/** Replace `{name}` placeholders in an i18n message template. */
export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) =>
    key in values ? String(values[key]) : _match,
  );
}

/**
 * Drop intro bullets that restate an earlier bullet.
 *
 * The survey/booking intro always lists a few auto-generated facts (question
 * count + time, anonymity, go-back note) and then appends the admin's
 * `highlights` lines. When a highlight restates an auto fact — exactly, as a
 * longer rewording of it, or with one word changed ("8 câu hỏi ngắn, khoảng
 * 5 phút" vs "8 câu hỏi, khoảng 5 phút") — the page shows the same line twice
 * (Phase 10 visual check, 2026-11-14). Keep the first occurrence and drop
 * later lines that are equal to, contain, are contained by, or share at
 * least 80% of their words with an earlier bullet. Word overlap only counts
 * for lines of at least 4 words, so short generic lines never collapse
 * distinct bullets.
 */
export function dedupeBullets(bullets: string[]): string[] {
  const kept: string[] = [];
  const norm = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
  const tokens = (value: string) =>
    new Set(norm(value).replace(/[.,;:!?()—–\-·]/g, " ").split(" ").filter(Boolean));
  const restates = (a: string, b: string) => {
    if (a === b) return true;
    if (a.length >= 12 && b.length >= 12 && (a.includes(b) || b.includes(a))) return true;
    const ta = tokens(a);
    const tb = tokens(b);
    if (ta.size < 4 || tb.size < 4) return false;
    let shared = 0;
    for (const token of ta) if (tb.has(token)) shared++;
    return shared / (ta.size + tb.size - shared) >= 0.8;
  };
  for (const bullet of bullets) {
    const n = norm(bullet);
    if (!n) continue;
    if (!kept.some((existing) => restates(n, norm(existing)))) kept.push(bullet);
  }
  return kept;
}
