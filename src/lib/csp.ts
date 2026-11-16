/** Header used to hand the per-request nonce to server components. */
export const CSP_NONCE_HEADER = "x-nonce";

/**
 * Content-Security-Policy for this app.
 *
 * `script-src` is nonce based (Next reads the header and stamps its own
 * scripts); `style-src` still allows inline styles because the React tree and
 * Tailwind emit style attributes. No `unsafe-inline` is granted to scripts.
 * Shipped as `Content-Security-Policy-Report-Only` first so violations can be
 * observed before enforcement.
 */
export function buildContentSecurityPolicy(nonce: string, options: { dev: boolean }): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(options.dev ? ["'unsafe-eval'"] : []),
  ].join(" ");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self'${options.dev ? " ws: wss:" : ""}`,
    "media-src 'self'",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join("; ");
}
