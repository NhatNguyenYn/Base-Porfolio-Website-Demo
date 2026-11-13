import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

describe("locale routing", () => {
  it("redirects the bare root to the default locale", () => {
    const response = middleware(new NextRequest("http://localhost:3000/"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/vi");
  });

  it("does not redirect an existing localized URL or add a trailing slash", () => {
    const response = middleware(new NextRequest("http://localhost:3000/vi/blog"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers.get("Content-Security-Policy-Report-Only")).toContain("nonce-");
  });
});
