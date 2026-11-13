import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale } from "@/i18n/config";
import { buildContentSecurityPolicy, CSP_NONCE_HEADER } from "@/lib/csp";

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

  const response =
    request.nextUrl.pathname === "/"
      ? NextResponse.redirect(new URL(`/${defaultLocale}`, request.url))
      : NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set("Content-Security-Policy-Report-Only", csp);
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  // Pages and route handlers; static assets and media are excluded.
  matcher: ["/((?!_next/static|_next/image|media/|.*\\..*).*)"],
};
