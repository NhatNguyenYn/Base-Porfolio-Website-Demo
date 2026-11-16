/** Header used to hand the per-request nonce to server components. */
export const CSP_NONCE_HEADER = "x-nonce";

/**
 * Content-Security-Policy for this app.
 *
 * `script-src` allows `'self'` plus `'unsafe-inline'` — deliberately, not by
 * accident. The public pages (home, art, about, contact) are ISR
 * (`revalidate = 60`): their HTML is prerendered once and served from the
 * edge, so it can never carry a per-request nonce. A nonce-based policy
 * (`'nonce-…'` + `'strict-dynamic'`) blocks the site's own inline scripts —
 * the RSC stream and hydration scripts — and the page stays on its loading
 * skeleton forever. That is exactly what happened on 16/11/2026 when PR #12
 * enforced the nonce policy: production broke until it was rolled back.
 * Dynamic pages (art/blog detail, admin) still read the per-request nonce
 * from `x-nonce` for their own inline theme/JSON-LD scripts, but the
 * enforced policy itself must stay nonce-free so the ISR pages keep working.
 *
 * The XSS defence therefore stays where it already was: input sanitization
 * (`sanitize-html` on rendered markdown/rich text) plus React escaping —
 * never user-controlled scripts. What this policy still enforces: no
 * external scripts, no plugins (`object-src 'none'`), no framing
 * (`frame-ancestors 'self'`), no base/form hijacking.
 *
 * Enforced since the 16/11 security review (it used to ship as
 * `Content-Security-Policy-Report-Only`, which browsers never block on).
 */
export function buildContentSecurityPolicy(options: { dev: boolean }): string {
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
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
