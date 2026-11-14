import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale } from "@/i18n/config";
import { buildContentSecurityPolicy, CSP_NONCE_HEADER } from "@/lib/csp";

/** First path segment of a known public section (bare, without a locale). */
const BARE_PUBLIC_SEGMENTS = new Set(["about", "blog", "projects", "art", "contact", "survey", "booking"]);

/**
 * Bare known public path (e.g. `/about`, `/blog/my-post`) → its localized
 * form (`/vi/about`). Returns null for `/` (already redirected), localized
 * URLs, and anything outside the known public sections (admin, api, unknown
 * paths keep their existing behaviour). Pure, so it is unit-testable.
 */
export function resolveBareLocaleRedirect(pathname: string): string | null {
  if (!pathname.startsWith("/") || pathname === "/") return null;
  const [first, ...rest] = pathname.slice(1).split("/");
  if (!first || isLocale(first) || !BARE_PUBLIC_SEGMENTS.has(first)) return null;
  return `/${defaultLocale}/${[first, ...rest].join("/")}`;
}

export function middleware(request: NextRequest) {
  // Web Crypto is available in the middleware runtime.
  const nonce = crypto.randomUUID();
  const requestId = crypto.randomUUID();
  const csp = buildContentSecurityPolicy(nonce, { dev: process.env.NODE_ENV !== "production" });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CSP_NONCE_HEADER, nonce);
  requestHeaders.set("x-request-id", requestId);
  // Next reads the CSP request header to stamp the nonce onto its own scripts.
  requestHeaders.set("Content-Security-Policy-Report-Only", csp);

  const bareTarget = resolveBareLocaleRedirect(request.nextUrl.pathname);
  const response =
    request.nextUrl.pathname === "/"
      ? NextResponse.redirect(new URL(`/${defaultLocale}`, request.url))
      : bareTarget
        ? NextResponse.redirect(new URL(`${bareTarget}${request.nextUrl.search}`, request.url))
        : NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set("Content-Security-Policy-Report-Only", csp);
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  // Pages and route handlers; static assets and media are excluded.
  matcher: ["/((?!_next/static|_next/image|media/|.*\\..*).*)"],
};
