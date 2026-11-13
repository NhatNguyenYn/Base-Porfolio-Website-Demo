import { afterEach, describe, expect, it, vi } from "vitest";
import { logEvent } from "@/lib/logger";

const spies: Array<{ mockRestore: () => void }> = [];

function capture() {
  const lines: string[] = [];
  spies.push(
    vi.spyOn(console, "log").mockImplementation((line: string) => lines.push(line)),
    vi.spyOn(console, "warn").mockImplementation((line: string) => lines.push(line)),
    vi.spyOn(console, "error").mockImplementation((line: string) => lines.push(line)),
  );
  return lines;
}

afterEach(() => {
  while (spies.length) spies.pop()?.mockRestore();
});

describe("structured logging", () => {
  it("emits one JSON line with timestamp, level and event", () => {
    const lines = capture();
    logEvent("warn", "auth.failure", { route: "/api/admin/me", status: 401 });

    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]!);
    expect(entry.level).toBe("warn");
    expect(entry.event).toBe("auth.failure");
    expect(entry.route).toBe("/api/admin/me");
    expect(entry.status).toBe(401);
    expect(typeof entry.ts).toBe("string");
    expect(Number.isNaN(Date.parse(entry.ts))).toBe(false);
  });

  it("redacts secrets, cookies and tokens", () => {
    const lines = capture();
    logEvent("info", "request", {
      requestId: "abc",
      password: "hunter2",
      sessionToken: "tok",
      cookie: "ps_session=secret",
      authorization: "Bearer abc",
      apiKey: "key",
      route: "/vi",
    });

    const entry = JSON.parse(lines[0]!);
    expect(entry.password).toBe("[redacted]");
    expect(entry.sessionToken).toBe("[redacted]");
    expect(entry.cookie).toBe("[redacted]");
    expect(entry.authorization).toBe("[redacted]");
    expect(entry.apiKey).toBe("[redacted]");
    expect(entry.requestId).toBe("abc");
    expect(lines[0]).not.toContain("hunter2");
    expect(lines[0]).not.toContain("ps_session=secret");
  });

  it("routes error level to stderr", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    spies.push(error);
    logEvent("error", "api.error", { code: "P1001" });
    expect(error).toHaveBeenCalledOnce();
  });
});
