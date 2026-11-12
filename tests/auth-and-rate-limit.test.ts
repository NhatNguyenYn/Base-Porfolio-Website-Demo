import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth";
import { clientIp, hashedKey, rateLimit } from "@/lib/rate-limit";

describe("password hashing", () => {
  it("never stores the plaintext password", async () => {
    const hash = await hashPassword("CorrectHorse123");
    expect(hash).not.toContain("CorrectHorse123");
    expect(hash.startsWith("$2")).toBe(true);
  });

  it("verifies the right password and rejects a wrong one", async () => {
    const hash = await hashPassword("CorrectHorse123");
    await expect(verifyPassword("CorrectHorse123", hash)).resolves.toBe(true);
    await expect(verifyPassword("correcthorse123", hash)).resolves.toBe(false);
    await expect(verifyPassword("", hash)).resolves.toBe(false);
  });
});

describe("rate limiting", () => {
  it("allows requests up to the limit, then blocks", () => {
    const key = `test:${Math.random()}`;
    expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    expect(rateLimit(key, 3, 60_000).ok).toBe(true);

    const blocked = rateLimit(key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    const key = `test-window:${Math.random()}`;
    rateLimit(key, 1, 20);
    const start = Date.now();
    while (Date.now() - start < 30) {
      // busy wait a few milliseconds so the window expires deterministically
    }
    expect(rateLimit(key, 1, 20).ok).toBe(true);
  });

  it("hashes the rate-limit identity instead of storing IPs", () => {
    const key = hashedKey("203.0.113.9");
    expect(key).not.toContain("203.0.113.9");
    expect(hashedKey("203.0.113.9")).toBe(key);
  });

  it("reads the first forwarded address", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" });
    expect(clientIp(headers)).toBe("203.0.113.9");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
