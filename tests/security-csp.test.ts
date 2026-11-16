import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { buildContentSecurityPolicy } from "@/lib/csp";
import { middleware } from "@/middleware";

function directive(csp: string, name: string): string {
  return csp.split("; ").find((entry) => entry.startsWith(`${name} `)) ?? "";
}

describe("Content Security Policy", () => {
  const csp = buildContentSecurityPolicy({ dev: false });

  it("allows the inline scripts the ISR pages ship with", () => {
    // Home, art, about and contact are ISR (revalidate = 60): their HTML is
    // prerendered once and can never carry a per-request nonce. A nonce or
    // 'strict-dynamic' policy blocks the site's own inline RSC/hydration
    // scripts and the page stays on its loading skeleton — exactly what
    // broke production on 16/11/2026 when PR #12 enforced the nonce policy.
    expect(directive(csp, "script-src")).toBe("script-src 'self' 'unsafe-inline'");
    expect(directive(csp, "script-src")).not.toContain("'nonce-");
    expect(directive(csp, "script-src")).not.toContain("'strict-dynamic'");
  });

  it("never allows eval scripts in production", () => {
    expect(directive(csp, "script-src")).not.toContain("'unsafe-eval'");
  });

  it("stays compatible with every ISR page (the 16/11 guard)", () => {
    // Regression guard for PR #12: the tests then only asserted the response
    // header, never that the policy fits the HTML the pages actually serve.
    // If a page is ISR, the policy MUST allow its nonce-less inline scripts.
    const isrPages = [
      "src/app/(public)/[locale]/page.tsx",
      "src/app/(public)/[locale]/art/page.tsx",
      "src/app/(public)/[locale]/about/page.tsx",
      "src/app/(public)/[locale]/contact/page.tsx",
    ];
    for (const rel of isrPages) {
      const source = readFileSync(join(process.cwd(), rel), "utf8");
      expect(source, `${rel} must stay ISR`).toContain("export const revalidate = 60;");
    }
    expect(directive(csp, "script-src")).toContain("'unsafe-inline'");
    expect(directive(csp, "script-src")).not.toContain("'nonce-");
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
    const dev = buildContentSecurityPolicy({ dev: true });
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(directive(dev, "connect-src")).toContain("ws:");
    expect(directive(csp, "connect-src")).not.toContain("ws:");
  });
});

describe("CSP enforcement in middleware", () => {
  it("sends the policy enforced, never report-only", async () => {
    const response = middleware(new NextRequest("http://localhost:3000/vi"));
    const enforced = response.headers.get("content-security-policy");
    expect(enforced).toContain("script-src 'self' 'unsafe-inline'");
    expect(enforced).not.toContain("'nonce-");
    expect(response.headers.get("content-security-policy-report-only")).toBeNull();
  });
});
