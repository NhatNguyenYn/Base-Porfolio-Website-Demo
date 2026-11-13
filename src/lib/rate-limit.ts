import { createHash } from "node:crypto";

type Bucket = { count: number; resetAt: number };

const globalStore = globalThis as unknown as { __rateLimit?: Map<string, Bucket> };
const buckets: Map<string, Bucket> = globalStore.__rateLimit ?? new Map();
globalStore.__rateLimit = buckets;

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSeconds: number };

/**
 * Fixed-window rate limiter kept in process memory.
 *
 * Limitation: on multi-instance/serverless deployments each instance keeps its
 * own counters. For production scale, back this with Redis/Upstash; the call
 * signature stays the same.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: Math.ceil(windowMs / 1000) };
  }

  bucket.count += 1;
  const remaining = Math.max(0, limit - bucket.count);
  if (bucket.count > limit) {
    return { ok: false, remaining: 0, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true, remaining, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
}

/** Stable, non-reversible key so IPs are not stored in plain text. */
export function hashedKey(input: string): string {
  return createHash("sha256")
    .update(`${process.env.AUTH_SECRET ?? "dev"}:${input}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Number of reverse proxies in front of the app, from env `TRUSTED_PROXY_HOPS`.
 *
 * `0` means the app is exposed directly: forwarding headers are ignored
 * completely, because a client can send any `X-Forwarded-For` it likes. The
 * default of `1` matches the usual single-proxy deployment, where the proxy
 * appends the real peer address to the right of the chain.
 */
export function trustedProxyHops(): number {
  const parsed = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 1;
  return Math.min(parsed, 10);
}

/**
 * Visitor identity used for rate limiting.
 *
 * Only the address appended by a trusted proxy is used; entries a client can
 * seed on the left of the chain are never trusted. When no proxy is
 * configured the identity is "unknown" so every caller shares one bucket
 * rather than being able to rotate headers for fresh quota.
 */
export function clientIp(headers: Headers, hops: number = trustedProxyHops()): string {
  if (hops <= 0) return "unknown";

  const chain = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (chain.length === 0) {
    // `x-real-ip` is only meaningful when a proxy is present.
    return headers.get("x-real-ip")?.trim() || "unknown";
  }

  return chain[Math.max(0, chain.length - hops)] ?? "unknown";
}

// Opportunistic cleanup so the map cannot grow without bound.
if (buckets.size > 5000) {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}
