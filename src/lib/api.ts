import "server-only";
import { NextResponse } from "next/server";
import { getSessionUser, type Role, type SessionUser } from "@/server/auth";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";

/** Uniform response envelope used by every /api route. */

export type ApiMeta = {
  locale?: Locale;
  page?: number;
  perPage?: number;
  total?: number;
  pages?: number;
  [key: string]: unknown;
};

export function ok<T>(data: T, meta?: ApiMeta, init?: ResponseInit) {
  return NextResponse.json(
    { success: true, data, ...(meta ? { meta } : {}) },
    { status: 200, ...init },
  );
}

export function fail(code: string, message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    {
      success: false,
      error: { code, message, ...(details === undefined ? {} : { details }) },
    },
    { status },
  );
}

/**
 * Public responses revalidate on every request: CMS edits must be visible
 * immediately, and a stale 60s edge copy is not acceptable for a portfolio that
 * is edited from the dashboard. Add a CDN later with explicit tag purging.
 */
export const publicCache = {
  headers: { "Cache-Control": "public, max-age=0, s-maxage=0, must-revalidate" },
} satisfies ResponseInit;

export function resolveLocale(value: string | null): Locale | null {
  if (!value) return defaultLocale;
  return isLocale(value) ? value : null;
}

export function readPagination(searchParams: URLSearchParams, defaultPerPage = 12, maxPerPage = 100) {
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const requested = Number.parseInt(searchParams.get("perPage") ?? String(defaultPerPage), 10) || defaultPerPage;
  return { page, perPage: Math.min(Math.max(1, requested), maxPerPage) };
}

export function paginate<T>(items: T[], page: number, perPage: number) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, pages);
  return {
    items: items.slice((safePage - 1) * perPage, safePage * perPage),
    meta: { page: safePage, perPage, total, pages },
  };
}

/**
 * Guards an admin API route. Returns the session user or a ready 401/403
 * response — authorization is always decided on the server.
 */
export async function authorize(
  roles: Role[] = ["SUPER_ADMIN", "ADMIN"],
): Promise<{ user: SessionUser } | { error: NextResponse }> {
  const user = await getSessionUser();
  if (!user) return { error: fail("UNAUTHORIZED", "Sign in to continue.", 401) };
  if (!roles.includes(user.role)) return { error: fail("FORBIDDEN", "You do not have access to this resource.", 403) };
  return { user };
}

/** Reads a JSON body defensively; malformed payloads become a 400, never a crash. */
export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
