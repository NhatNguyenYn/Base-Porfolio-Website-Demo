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
