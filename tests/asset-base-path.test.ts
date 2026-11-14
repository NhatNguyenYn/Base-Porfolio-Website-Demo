import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assetUrl, getBasePath } from "@/lib/asset";
import { absoluteUrl } from "@/lib/utils";
import { buildPageMetadata, canonicalUrl } from "@/lib/seo";

const BASE_PATH = "/Base-Porfolio-Website-Demo";
const ORIGIN = "https://portfolio.example";
const PAGES_ORIGIN = `https://nhatnguyenyn.github.io${BASE_PATH}`;

describe("assetUrl (base-path-aware local assets)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is the identity in server mode (no base path)", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "");
    expect(getBasePath()).toBe("");
    expect(assetUrl("/demo/article-01.svg")).toBe("/demo/article-01.svg");
    expect(assetUrl("/media/abc.jpg")).toBe("/media/abc.jpg");
    expect(assetUrl("/icon.png")).toBe("/icon.png");
  });

  it("prefixes root-absolute local paths on the Pages export", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", BASE_PATH);
    expect(assetUrl("/demo/article-01.svg")).toBe(`${BASE_PATH}/demo/article-01.svg`);
    expect(assetUrl("/demo/avatar.svg")).toBe(`${BASE_PATH}/demo/avatar.svg`);
    expect(assetUrl("/media/abc.jpg")).toBe(`${BASE_PATH}/media/abc.jpg`);
    expect(assetUrl("/og-default.png")).toBe(`${BASE_PATH}/og-default.png`);
  });

  it("never double-prefixes and never touches external or relative URLs", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", BASE_PATH);
    expect(assetUrl(`${BASE_PATH}/demo/article-01.svg`)).toBe(`${BASE_PATH}/demo/article-01.svg`);
    expect(assetUrl("https://cdn.example/cover.jpg")).toBe("https://cdn.example/cover.jpg");
    expect(assetUrl("https://s3.example.com/bucket/a.png")).toBe("https://s3.example.com/bucket/a.png");
    expect(assetUrl("//cdn.example/a.png")).toBe("//cdn.example/a.png");
    expect(assetUrl("data:image/svg+xml,<svg/>")).toBe("data:image/svg+xml,<svg/>");
    expect(assetUrl("demo/article-01.svg")).toBe("demo/article-01.svg");
    expect(assetUrl("./vi/")).toBe("./vi/");
    expect(assetUrl("")).toBe("");
  });

  it("normalizes a base path with a trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", `${BASE_PATH}/`);
    expect(getBasePath()).toBe(BASE_PATH);
    expect(assetUrl("/demo/x.svg")).toBe(`${BASE_PATH}/demo/x.svg`);
  });
});

describe("absoluteUrl (canonical / OG / sitemap URLs)", () => {
  beforeEach(() => {
    vi.stubEnv("APP_URL", ORIGIN);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is unchanged in server mode", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "");
    expect(absoluteUrl("/vi/blog")).toBe(`${ORIGIN}/vi/blog`);
    expect(absoluteUrl("/sitemap.xml")).toBe(`${ORIGIN}/sitemap.xml`);
    expect(absoluteUrl("/demo/article-01.svg")).toBe(`${ORIGIN}/demo/article-01.svg`);
    expect(absoluteUrl("https://cdn.example/cover.jpg")).toBe("https://cdn.example/cover.jpg");
  });

  it("inserts the subpath on the Pages export when APP_URL has no subpath", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", BASE_PATH);
    expect(absoluteUrl("/vi/blog")).toBe(`${ORIGIN}${BASE_PATH}/vi/blog`);
    expect(absoluteUrl("/")).toBe(`${ORIGIN}${BASE_PATH}/`);
    expect(absoluteUrl("/sitemap.xml")).toBe(`${ORIGIN}${BASE_PATH}/sitemap.xml`);
    expect(absoluteUrl("/demo/article-01.svg")).toBe(`${ORIGIN}${BASE_PATH}/demo/article-01.svg`);
    expect(absoluteUrl("https://cdn.example/cover.jpg")).toBe("https://cdn.example/cover.jpg");
  });

  it("does not double-prefix when APP_URL already contains the subpath (CI)", () => {
    vi.stubEnv("APP_URL", PAGES_ORIGIN);
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", BASE_PATH);
    expect(absoluteUrl("/vi/blog")).toBe(`${PAGES_ORIGIN}/vi/blog`);
    expect(absoluteUrl("/sitemap.xml")).toBe(`${PAGES_ORIGIN}/sitemap.xml`);
    // A path already prefixed (e.g. `assetUrl` output) stays single too.
    expect(absoluteUrl(`${BASE_PATH}/vi/blog`)).toBe(`${PAGES_ORIGIN}/vi/blog`);
    expect(absoluteUrl(assetUrl("/demo/article-01.svg"))).toBe(`${PAGES_ORIGIN}/demo/article-01.svg`);
  });

  it("feeds canonical URLs with the subpath on the Pages export", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", BASE_PATH);
    vi.stubEnv("PAGES_EXPORT", "1");
    expect(canonicalUrl("vi", "/blog")).toBe(`${ORIGIN}${BASE_PATH}/vi/blog/`);
    expect(canonicalUrl("en", "/")).toBe(`${ORIGIN}${BASE_PATH}/en/`);
  });
});

describe("buildPageMetadata favicon", () => {
  const input = {
    locale: "vi" as const,
    path: "/blog/post",
    title: "Post",
    description: "Post",
    siteName: "Portfolio Studio",
  };

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps the bare /icon.png fallback in server mode", () => {
    vi.stubEnv("APP_URL", ORIGIN);
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "");
    expect(buildPageMetadata(input).icons).toEqual({ icon: "/icon.png" });
    expect(buildPageMetadata({ ...input, faviconUrl: "/media/favicon.png" }).icons).toEqual({
      icon: "/media/favicon.png",
    });
  });

  it("prefixes the favicon on the Pages export (icon href is emitted verbatim)", () => {
    vi.stubEnv("APP_URL", PAGES_ORIGIN);
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", BASE_PATH);
    expect(buildPageMetadata(input).icons).toEqual({ icon: `${BASE_PATH}/icon.png` });
    expect(buildPageMetadata({ ...input, faviconUrl: "/media/favicon.png" }).icons).toEqual({
      icon: `${BASE_PATH}/media/favicon.png`,
    });
    expect(
      buildPageMetadata({ ...input, faviconUrl: "https://cdn.example/favicon.png" }).icons,
    ).toEqual({ icon: "https://cdn.example/favicon.png" });
  });
});
