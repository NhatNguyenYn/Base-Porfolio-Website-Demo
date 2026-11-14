/**
 * Base-path-aware asset URLs.
 *
 * The GitHub Pages demo serves the public site from a subpath
 * (`/Base-Porfolio-Website-Demo`, see `basePath` in next.config.ts), while
 * the full-stack build serves it from the domain root. Media URLs stored in
 * the database are root-absolute (`/demo/article-01.svg`, `/media/...`), and
 * `next/image` with `images.unoptimized` (static export) does NOT add the
 * basePath to `src` — so every local image rendered with its stored URL
 * 404s on the demo. Every local `<Image src>` / `<img src>` / raw `<a
 * href>` to a local file must go through `assetUrl`.
 *
 * The base path reaches the client bundle through `env:
 * { NEXT_PUBLIC_BASE_PATH }` in next.config.ts (same value as `basePath`,
 * `""` when the export is off), so this helper returns the right prefix in
 * both modes without any runtime config.
 */

/** The deploy subpath (`"/Base-Porfolio-Website-Demo"` on the Pages export, `""` otherwise). */
export function getBasePath(): string {
  const raw = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").trim();
  if (!raw || raw === "/") return "";
  const withLeading = raw.startsWith("/") ? raw : `/${raw}`;
  return withLeading.endsWith("/") ? withLeading.slice(0, -1) : withLeading;
}

/** True for URLs that must never gain a base-path prefix. */
export function isExternalUrl(url: string): boolean {
  return /^(?:https?:)?\/\//i.test(url) || /^(?:data|blob):/i.test(url);
}

/**
 * Prefix a root-absolute internal path with the deploy base path.
 * External (http(s), protocol-relative, data:, blob:) URLs, already-prefixed
 * paths and relative paths are returned unchanged.
 */
export function assetUrl(path: string): string {
  if (!path) return path;
  if (isExternalUrl(path)) return path;
  const basePath = getBasePath();
  if (!basePath) return path;
  if (path === basePath || path.startsWith(`${basePath}/`)) return path;
  if (path.startsWith("/")) return `${basePath}${path}`;
  return path;
}
