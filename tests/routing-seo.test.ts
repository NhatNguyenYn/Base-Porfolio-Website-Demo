import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware, resolveBareLocaleRedirect } from "@/middleware";

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

  it("redirects bare known public paths to the default locale, preserving the query", () => {
    expect(resolveBareLocaleRedirect("/about")).toBe("/vi/about");
    expect(resolveBareLocaleRedirect("/blog/bai-viet")).toBe("/vi/blog/bai-viet");
    expect(resolveBareLocaleRedirect("/projects")).toBe("/vi/projects");
    expect(resolveBareLocaleRedirect("/art/collections/ink")).toBe("/vi/art/collections/ink");
    expect(resolveBareLocaleRedirect("/contact")).toBe("/vi/contact");

    const response = middleware(new NextRequest("http://localhost:3000/blog?page=2&q=design"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/vi/blog?page=2&q=design");
  });

  it("does not redirect localized, unknown, or non-public bare paths", () => {
    expect(resolveBareLocaleRedirect("/")).toBeNull();
    expect(resolveBareLocaleRedirect("/vi/blog")).toBeNull();
    expect(resolveBareLocaleRedirect("/en/about")).toBeNull();
    expect(resolveBareLocaleRedirect("/unknown-path")).toBeNull();
    expect(resolveBareLocaleRedirect("/admin")).toBeNull();
    expect(resolveBareLocaleRedirect("/api/settings")).toBeNull();
    expect(resolveBareLocaleRedirect("/preview/article/x")).toBeNull();

    const response = middleware(new NextRequest("http://localhost:3000/admin"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});
