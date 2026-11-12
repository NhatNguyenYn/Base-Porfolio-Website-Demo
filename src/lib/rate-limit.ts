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

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}

// Opportunistic cleanup so the map cannot grow without bound.
if (buckets.size > 5000) {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}
