import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth";
import { clientIp, hashedKey, rateLimit, trustedProxyHops } from "@/lib/rate-limit";

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

  it("only trusts the address appended by the configured proxy", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" });
    // One proxy: the right-most entry is the peer address it appended.
    expect(clientIp(headers, 1)).toBe("10.0.0.1");
    // Two proxies: the entry appended by the outermost trusted proxy.
    expect(clientIp(headers, 2)).toBe("203.0.113.9");
    // No trusted proxy: forwarding headers are ignored, so they cannot be rotated.
    expect(clientIp(headers, 0)).toBe("unknown");
    expect(clientIp(new Headers())).toBe("unknown");
  });

  it("uses x-real-ip only while a proxy is trusted", () => {
    const headers = new Headers({ "x-real-ip": "198.51.100.7" });
    expect(clientIp(headers, 1)).toBe("198.51.100.7");
    expect(clientIp(headers, 0)).toBe("unknown");
  });

  it("never returns undefined when the chain is shorter than configured", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.9" }), 3)).toBe("203.0.113.9");
  });

  it("reads and clamps TRUSTED_PROXY_HOPS", () => {
    const previous = process.env.TRUSTED_PROXY_HOPS;
    try {
      process.env.TRUSTED_PROXY_HOPS = "2";
      expect(trustedProxyHops()).toBe(2);
      process.env.TRUSTED_PROXY_HOPS = "-1";
      expect(trustedProxyHops()).toBe(1);
      process.env.TRUSTED_PROXY_HOPS = "abc";
      expect(trustedProxyHops()).toBe(1);
      process.env.TRUSTED_PROXY_HOPS = "99";
      expect(trustedProxyHops()).toBe(10);
      delete process.env.TRUSTED_PROXY_HOPS;
      expect(trustedProxyHops()).toBe(1);
    } finally {
      if (previous === undefined) delete process.env.TRUSTED_PROXY_HOPS;
      else process.env.TRUSTED_PROXY_HOPS = previous;
    }
  });
});
