import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  buildPageMetadata,
  canonicalAbsoluteUrl,
  canonicalPath,
  canonicalUrl,
  defaultSocialImage,
  languageAlternates,
  listCanonicalQuery,
  paginationLinks,
  safeSocialImage,
  socialImage,
  withPagesTrailingSlash,
  xHandleFromSocials,
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
    // Home: alternates match the canonical — no trailing slash in server
    // mode (the Pages export re-adds it via canonicalAbsoluteUrl).
    expect(languageAlternates("/", ["vi", "en"])).toEqual({
      vi: "/vi",
      en: "/en",
      "x-default": "/vi",
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

  it("emits noindex,follow for search views when an explicit robots directive is given", () => {
    const metadata = buildPageMetadata({
      locale: "vi",
      path: "/blog",
      title: "Blog",
      description: "Blog",
      siteName: "Portfolio Studio",
      robots: { index: false, follow: true },
    });
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });

  it("appends a self-canonical query for filtered/paginated views", () => {
    const metadata = buildPageMetadata({
      locale: "vi",
      path: "/blog",
      title: "Blog",
      description: "Blog",
      siteName: "Portfolio Studio",
      canonicalQuery: "page=2",
    });
    expect(metadata.alternates?.canonical).toBe("https://portfolio.example/vi/blog?page=2");
    expect(metadata.openGraph?.url).toBe("https://portfolio.example/vi/blog?page=2");
  });

  it("builds a deterministic list canonical query, omitting page=1", () => {
    expect(listCanonicalQuery({ q: "design", page: "1" })).toBe("q=design");
    expect(listCanonicalQuery({ page: "3", category: "ui", q: "a" })).toBe("category=ui&page=3&q=a");
    expect(listCanonicalQuery({})).toBeUndefined();
    expect(listCanonicalQuery({ q: "", page: undefined })).toBeUndefined();
  });

  it("builds prev/next pagination links with stable parameters", () => {
    const links = paginationLinks({
      locale: "vi",
      path: "/blog",
      params: { q: "design", category: undefined },
      page: 2,
      pages: 3,
    });
    expect(links.prev).toBe("https://portfolio.example/vi/blog?q=design");
    expect(links.next).toBe("https://portfolio.example/vi/blog?page=3&q=design");
    expect(
      paginationLinks({ locale: "vi", path: "/blog", params: {}, page: 1, pages: 1 }),
    ).toEqual({});
  });

  it("adds a trailing slash to page URLs only on the Pages export", () => {
    expect(canonicalUrl("vi", "/blog")).toBe("https://portfolio.example/vi/blog");
    expect(withPagesTrailingSlash("https://portfolio.example/vi/blog")).toBe(
      "https://portfolio.example/vi/blog",
    );
    vi.stubEnv("PAGES_EXPORT", "1");
    expect(canonicalUrl("vi", "/blog")).toBe("https://portfolio.example/vi/blog/");
    expect(canonicalUrl("vi", "/")).toBe("https://portfolio.example/vi/");
    expect(canonicalAbsoluteUrl("https://portfolio.example/en/about")).toBe(
      "https://portfolio.example/en/about/",
    );
    expect(canonicalAbsoluteUrl("https://portfolio.example/vi/blog/")).toBe(
      "https://portfolio.example/vi/blog/",
    );
    // Media/API URLs never gain a slash: absoluteUrl is untouched.
    expect(absoluteUrl("/media/cover.jpg")).toBe("https://portfolio.example/media/cover.jpg");
  });

  it("falls back to the PNG for SVG covers in page metadata too", () => {
    const metadata = buildPageMetadata({
      locale: "vi",
      path: "/blog/post",
      title: "Post",
      description: "Post",
      siteName: "Portfolio Studio",
      image: socialImage("/demo/article-01.svg", "Demo cover"),
    });
    const images = metadata.openGraph?.images;
    expect(Array.isArray(images) ? images[0] : images).toMatchObject({
      url: "https://portfolio.example/og-default.png",
      width: 1200,
      height: 630,
    });
    expect(metadata.twitter?.images).toEqual([
      { url: "https://portfolio.example/og-default.png", alt: expect.stringContaining("Portfolio Studio"), width: 1200, height: 630 },
    ]);
  });

  it("carries known image dimensions into Twitter images", () => {
    const metadata = buildPageMetadata({
      locale: "vi",
      path: "/blog/post",
      title: "Post",
      description: "Post",
      siteName: "Portfolio Studio",
      image: socialImage("/media/cover.jpg", "Cover", 1600, 900),
    });
    expect(metadata.twitter?.images).toEqual([{ url: "https://portfolio.example/media/cover.jpg", alt: "Cover", width: 1600, height: 900 }]);
    expect(metadata.openGraph?.images).toEqual([
      { url: "https://portfolio.example/media/cover.jpg", alt: "Cover", width: 1600, height: 900 },
    ]);
  });

  it("emits twitter site/creator only when a handle is present", () => {
    const withHandle = buildPageMetadata({
      locale: "vi",
      path: "/about",
      title: "About",
      description: "About",
      siteName: "Portfolio Studio",
      twitterSite: "@alex",
      twitterCreator: "@alex",
    });
    expect(withHandle.twitter).toMatchObject({ site: "@alex", creator: "@alex" });

    const withoutHandle = buildPageMetadata({
      locale: "vi",
      path: "/about",
      title: "About",
      description: "About",
      siteName: "Portfolio Studio",
    });
    expect(withoutHandle.twitter).not.toHaveProperty("site");
    expect(withoutHandle.twitter).not.toHaveProperty("creator");
  });

  it("derives an X handle from social links and never invents one", () => {
    expect(xHandleFromSocials([{ platform: "x", url: "https://x.com/alex_design" }])).toBe("@alex_design");
    expect(xHandleFromSocials([{ platform: "twitter", url: "https://twitter.com/alex?x=1" }])).toBe("@alex");
    expect(xHandleFromSocials([{ platform: "github", url: "https://github.com/alex" }])).toBeNull();
    expect(xHandleFromSocials([{ platform: "x", url: "https://example.com/alex" }])).toBeNull();
    expect(xHandleFromSocials([])).toBeNull();
    expect(xHandleFromSocials(undefined)).toBeNull();
  });

  it("falls back to /icon.png for the favicon when settings has none", () => {
    const fallback = buildPageMetadata({
      locale: "vi",
      path: "/about",
      title: "About",
      description: "About",
      siteName: "Portfolio Studio",
    });
    expect(fallback.icons).toEqual({ icon: "/icon.png" });

    const custom = buildPageMetadata({
      locale: "vi",
      path: "/about",
      title: "About",
      description: "About",
      siteName: "Portfolio Studio",
      faviconUrl: "/media/favicon.png",
    });
    expect(custom.icons).toEqual({ icon: "/media/favicon.png" });
  });
});
