import { timingSafeEqual } from "node:crypto";

/** Constant-time comparison; length differences are rejected up front. */
export function tokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type SetupAccess =
  | { allowed: true }
  | { allowed: false; reason: "token" | "local-only" | "disabled" };

/**
 * Decides whether the setup action may create the first administrator.
 *
 * - A configured `SETUP_TOKEN` is always required (in every environment).
 * - Production never allows setup without a token, not even from localhost:
 *   the `Host` header is client controlled and can be spoofed.
 * - Development keeps the convenient localhost-only path.
 */
export function evaluateSetupAccess(input: {
  isProduction: boolean;
  host: string | null;
  configuredToken: string;
  providedToken: string | null;
}): SetupAccess {
  const expected = input.configuredToken.trim();
  if (expected) {
    return tokensMatch(input.providedToken ?? "", expected)
      ? { allowed: true }
      : { allowed: false, reason: "token" };
  }
  if (input.isProduction) return { allowed: false, reason: "disabled" };
  return isLocalHost(input.host) ? { allowed: true } : { allowed: false, reason: "local-only" };
}

/** Whether the setup page should render its locked notice instead of the form. */
export function isSetupLocked(input: {
  isProduction: boolean;
  host: string | null;
  configuredToken: string;
}): boolean {
  if (input.configuredToken.trim()) return false;
  if (input.isProduction) return true;
  return !isLocalHost(input.host);
}

export function isLocalHost(host: string | null): boolean {
  if (!host) return false;
  let hostname = host.trim().toLowerCase();
  if (hostname.startsWith("[")) {
    // Bracketed IPv6, optionally followed by :port.
    const end = hostname.indexOf("]");
    if (end !== -1) hostname = hostname.slice(0, end + 1);
  } else if ((hostname.match(/:/g) ?? []).length === 1) {
    hostname = hostname.split(":")[0] ?? hostname;
  }
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
}
