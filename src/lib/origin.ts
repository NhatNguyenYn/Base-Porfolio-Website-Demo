export type OriginCheck =
  | { ok: true }
  | { ok: false; reason: "cross-site" | "null-origin" | "missing-origin" | "host-mismatch" | "malformed" };

function firstHost(value: string | null): string | null {
  if (!value) return null;
  const host = value.split(",")[0]?.trim().toLowerCase();
  return host || null;
}

/**
 * Verifies a state-changing request comes from this site.
 *
 * Browsers send `Origin` on cross-origin and same-origin POST/PATCH/DELETE, so
 * a present but foreign Origin is rejected. Requests without `Origin` (curl,
 * server-to-server) are allowed; `Sec-Fetch-Site` is checked when present so a
 * `same-site` sibling origin cannot ride the session cookie.
 */
export function checkRequestOrigin(headers: Headers, requestUrl?: string): OriginCheck {
  const fetchSite = headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "cross-site" || fetchSite === "same-site") {
    return { ok: false, reason: "cross-site" };
  }

  const origin = headers.get("origin");
  if (!origin) {
    // Real browsers send Origin on every mutating request and also send
    // Sec-Fetch-Mode; a browser-shaped request without Origin is not trusted,
    // while curl/server-to-server clients send neither header.
    if (headers.get("sec-fetch-mode")) return { ok: false, reason: "missing-origin" };
    return { ok: true };
  }
  if (origin === "null") return { ok: false, reason: "null-origin" };

  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (!originHost) return { ok: false, reason: "malformed" };

  const allowed = new Set<string>();
  const host = firstHost(headers.get("host"));
  if (host) allowed.add(host);
  const forwardedHost = firstHost(headers.get("x-forwarded-host"));
  if (forwardedHost) allowed.add(forwardedHost);
  if (requestUrl) {
    try {
      allowed.add(new URL(requestUrl).host.toLowerCase());
    } catch {
      // A malformed request URL simply contributes no allowed host.
    }
  }

  if (allowed.size === 0) return { ok: false, reason: "host-mismatch" };
  return allowed.has(originHost) ? { ok: true } : { ok: false, reason: "host-mismatch" };
}
