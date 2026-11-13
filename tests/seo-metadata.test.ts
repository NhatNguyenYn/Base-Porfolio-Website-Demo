import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  buildPageMetadata,
  canonicalPath,
  defaultSocialImage,
  languageAlternates,
  safeSocialImage,
  socialImage,
} from "@/lib/seo";
import { absoluteUrl } from "@/lib/utils";

describe("SEO metadata", () => {
  beforeEach(() => {
    vi.stubEnv("APP_URL", "https://portfolio.example");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds a canonical URL inside the requested locale", () => {
    expect(canonicalPath("vi", "/blog/bai-viet")).toBe("/vi/blog/bai-viet");
    expect(canonicalPath("en", "/")).toBe("/en");
  });

  it("only advertises locales that really exist", () => {
    expect(languageAlternates("/blog/bai-viet", ["vi"])).toEqual({
      vi: "/vi/blog/bai-viet",
      "x-default": "/vi/blog/bai-viet",
    });
    expect(languageAlternates("/about", ["vi", "en"])).toEqual({
      vi: "/vi/about",
      en: "/en/about",
      "x-default": "/vi/about",
    });
  });

  it("produces absolute canonical, hreflang, OG and Twitter fields", () => {
    const metadata = buildPageMetadata({
      locale: "en",
      path: "/blog/design-systems",
      title: "Design systems",
      description: "How systems start before components.",
      siteName: "Portfolio Studio",
      availableLocales: ["vi", "en"],
      type: "article",
      publishedTime: "2026-01-02T00:00:00.000Z",
      modifiedTime: "2026-01-03T00:00:00.000Z",
      authors: ["Alex"],
    });

    expect(metadata.alternates?.canonical).toBe("https://portfolio.example/en/blog/design-systems");
    expect(metadata.alternates?.languages).toEqual({
      vi: "https://portfolio.example/vi/blog/design-systems",
      en: "https://portfolio.example/en/blog/design-systems",
      "x-default": "https://portfolio.example/vi/blog/design-systems",
    });
    expect(metadata.openGraph).toMatchObject({
      type: "article",
      url: "https://portfolio.example/en/blog/design-systems",
      siteName: "Portfolio Studio",
      locale: "en_US",
      alternateLocale: "vi_VN",
      publishedTime: "2026-01-02T00:00:00.000Z",
      modifiedTime: "2026-01-03T00:00:00.000Z",
    });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("uses a real 1200x630 fallback image instead of a broken URL", () => {
    const image = defaultSocialImage("Portfolio Studio");
    expect(image.url).toBe("https://portfolio.example/og-default.png");
    expect(image.width).toBe(OG_IMAGE_WIDTH);
    expect(image.height).toBe(OG_IMAGE_HEIGHT);
    expect(image.alt).toContain("Portfolio Studio");

    const metadata = buildPageMetadata({
      locale: "vi",
      path: "/about",
      title: "Giới thiệu",
      description: "Giới thiệu",
      siteName: "Portfolio Studio",
    });
    const images = metadata.openGraph?.images;
    expect(Array.isArray(images) ? images[0] : images).toMatchObject({
      url: "https://portfolio.example/og-default.png",
      width: 1200,
      height: 630,
    });
  });

  it("keeps an uploaded cover absolute and carries its dimensions", () => {
    expect(socialImage("/media/cover.jpg", "Cover", 1600, 900)).toEqual({
      url: "https://portfolio.example/media/cover.jpg",
      alt: "Cover",
      width: 1600,
      height: 900,
    });
    expect(socialImage("https://cdn.example/cover.jpg", "Cover")).toEqual({
      url: "https://cdn.example/cover.jpg",
      alt: "Cover",
    });
    expect(absoluteUrl("https://cdn.example/cover.jpg")).toBe("https://cdn.example/cover.jpg");
  });

  it("falls back to the PNG for SVG demo covers that social crawlers cannot use", () => {
    const social = safeSocialImage(socialImage("/demo/article-01.svg", "Demo cover"), "Portfolio Studio");
    expect(social.url).toBe("https://portfolio.example/og-default.png");
    expect(social.width).toBe(1200);
    expect(safeSocialImage(socialImage("/media/cover.jpg", "Cover"), "Portfolio Studio").url).toBe(
      "https://portfolio.example/media/cover.jpg",
    );
  });

  it("marks unavailable translations noindex while keeping a canonical", () => {
    const metadata = buildPageMetadata({
      locale: "en",
      path: "/blog/only-vietnamese",
      title: "Not available",
      description: "Not available",
      siteName: "Portfolio Studio",
      noindex: true,
    });
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.alternates?.canonical).toBe("https://portfolio.example/en/blog/only-vietnamese");
  });
});
