import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "@/lib/csp";

function directive(csp: string, name: string): string {
  return csp.split("; ").find((entry) => entry.startsWith(`${name} `)) ?? "";
}

describe("Content Security Policy", () => {
  const csp = buildContentSecurityPolicy("dGVzdC1ub25jZQ==", { dev: false });

  it("pins scripts to the per-request nonce", () => {
    expect(directive(csp, "script-src")).toContain("'nonce-dGVzdC1ub25jZQ=='");
    expect(directive(csp, "script-src")).toContain("'strict-dynamic'");
    expect(directive(csp, "script-src")).toContain("'self'");
  });

  it("never allows inline or eval scripts in production", () => {
    expect(directive(csp, "script-src")).not.toContain("'unsafe-inline'");
    expect(directive(csp, "script-src")).not.toContain("'unsafe-eval'");
  });

  it("locks down plugin, base and form targets", () => {
    expect(directive(csp, "object-src")).toBe("object-src 'none'");
    expect(directive(csp, "base-uri")).toBe("base-uri 'self'");
    expect(directive(csp, "form-action")).toBe("form-action 'self'");
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'self'");
  });

  it("allows the assets the site actually loads", () => {
    expect(directive(csp, "img-src")).toContain("'self'");
    expect(directive(csp, "img-src")).toContain("data:");
    expect(directive(csp, "style-src")).toContain("'unsafe-inline'");
  });

  it("adds eval and websockets only for the development runtime", () => {
    const dev = buildContentSecurityPolicy("dev-nonce", { dev: true });
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(directive(dev, "connect-src")).toContain("ws:");
    expect(directive(csp, "connect-src")).not.toContain("ws:");
  });
});
