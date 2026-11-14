import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  project: { findMany: vi.fn() },
  artwork: { findMany: vi.fn() },
  article: { findMany: vi.fn() },
  artworkCollection: { findMany: vi.fn() },
  category: { findMany: vi.fn() },
  siteSetting: { aggregate: vi.fn() },
}));

vi.mock("@/server/db", () => ({ prisma: db }));

import sitemap from "@/app/sitemap";
import robots from "@/app/robots";

const settingsDate = new Date("2026-02-01T00:00:00.000Z");
const articleDate = new Date("2026-03-01T00:00:00.000Z");
const categoryArticleDate = new Date("2026-03-05T00:00:00.000Z");
const categoryDate = new Date("2026-01-20T00:00:00.000Z");
const projectDate = new Date("2026-02-15T00:00:00.000Z");
const artDate = new Date("2026-01-15T00:00:00.000Z");

describe("sitemap", () => {
  beforeEach(() => {
    vi.stubEnv("APP_URL", "https://portfolio.example");
    db.project.findMany.mockResolvedValue([
      {
        slug: "case-study",
        updatedAt: projectDate,
        category: "platform",
        translations: [{ locale: "vi" }],
        thumbnailMedia: { url: "/media/project.jpg" },
      },
    ]);
    db.artwork.findMany.mockResolvedValue([
      {
        slug: "ink-piece",
        updatedAt: artDate,
        translations: [{ locale: "vi" }, { locale: "en" }],
        imageMedia: { url: "https://cdn.example/art.jpg" },
      },
    ]);
    db.article.findMany.mockResolvedValue([
      {
        slug: "bai-viet",
        updatedAt: articleDate,
        translations: [{ locale: "vi" }],
        coverMedia: { url: "/media/article.jpg" },
      },
    ]);
    db.artworkCollection.findMany.mockResolvedValue([
      { slug: "collection", updatedAt: artDate, translations: [{ locale: "vi" }] },
    ]);
    db.category.findMany.mockResolvedValue([
      {
        slug: "design",
        updatedAt: categoryDate,
        translations: [{ locale: "vi" }, { locale: "en" }],
        articles: [{ updatedAt: categoryArticleDate }],
      },
    ]);
    db.siteSetting.aggregate.mockResolvedValue({ _max: { updatedAt: settingsDate } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("contains public pages in both locales and excludes private routes", async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain("https://portfolio.example/vi");
    expect(urls).toContain("https://portfolio.example/en/blog");
    expect(urls).toContain("https://portfolio.example/vi/projects");
    expect(urls.some((url) => /\/admin|\/preview|\/api/.test(url))).toBe(false);
  });

  it("keeps hidden Projects pages discoverable", async () => {
    const entries = await sitemap();
    const project = entries.find((entry) => entry.url === "https://portfolio.example/vi/projects/case-study");
    expect(project).toBeDefined();
    expect(project?.images).toEqual(["https://portfolio.example/media/project.jpg"]);
  });

  it("advertises only translations that exist", async () => {
    const entries = await sitemap();
    const article = entries.find((entry) => entry.url === "https://portfolio.example/vi/blog/bai-viet");
    expect(article?.alternates?.languages).toEqual({
      vi: "https://portfolio.example/vi/blog/bai-viet",
      "x-default": "https://portfolio.example/vi/blog/bai-viet",
    });
    expect(entries.some((entry) => entry.url === "https://portfolio.example/en/blog/bai-viet")).toBe(false);
  });

  it("uses content dates instead of a new date on every request", async () => {
    const entries = await sitemap();
    const byUrl = new Map(entries.map((entry) => [entry.url, entry]));

    expect(byUrl.get("https://portfolio.example/vi/blog")?.lastModified).toEqual(articleDate);
    expect(byUrl.get("https://portfolio.example/vi/projects")?.lastModified).toEqual(projectDate);
    expect(byUrl.get("https://portfolio.example/vi/about")?.lastModified).toEqual(settingsDate);
    expect(byUrl.get("https://portfolio.example/vi/blog/bai-viet")?.lastModified).toEqual(articleDate);
  });

  it("adds x-default to static entries, matching detail entries", async () => {
    const entries = await sitemap();
    const blog = entries.find((entry) => entry.url === "https://portfolio.example/vi/blog");
    expect(blog?.alternates?.languages).toEqual({
      vi: "https://portfolio.example/vi/blog",
      en: "https://portfolio.example/en/blog",
      "x-default": "https://portfolio.example/vi/blog",
    });
    const home = entries.find((entry) => entry.url === "https://portfolio.example/en");
    // Home alternates match the entry URL: no trailing slash in server mode
    // (the Pages export re-adds it via canonicalAbsoluteUrl).
    expect(home?.alternates?.languages?.["x-default"]).toBe("https://portfolio.example/vi");
  });

  it("excludes SVG images from sitemap images, like the OG fallback does", async () => {
    db.artwork.findMany.mockResolvedValue([
      {
        slug: "svg-piece",
        updatedAt: artDate,
        translations: [{ locale: "vi" }],
        imageMedia: { url: "/demo/art-01.svg" },
      },
    ]);
    const entries = await sitemap();
    const artwork = entries.find((entry) => entry.url === "https://portfolio.example/vi/art/svg-piece");
    expect(artwork).toBeDefined();
    expect(artwork).not.toHaveProperty("images");
    // Raster images are still advertised.
    const project = entries.find((entry) => entry.url === "https://portfolio.example/vi/projects/case-study");
    expect(project?.images).toEqual(["https://portfolio.example/media/project.jpg"]);
  });

  it("advertises blog category landing pages in both locales", async () => {
    const entries = await sitemap();
    const byUrl = new Map(entries.map((entry) => [entry.url, entry]));

    const vi = byUrl.get("https://portfolio.example/vi/blog/category/design");
    const en = byUrl.get("https://portfolio.example/en/blog/category/design");
    expect(vi).toBeDefined();
    expect(en).toBeDefined();
    // Freshness follows the newest article in the category, not the category
    // row itself (which rarely changes).
    expect(vi?.lastModified).toEqual(categoryArticleDate);
    expect(vi?.alternates?.languages).toEqual({
      vi: "https://portfolio.example/vi/blog/category/design",
      en: "https://portfolio.example/en/blog/category/design",
      "x-default": "https://portfolio.example/vi/blog/category/design",
    });
  });

  it("advertises project category landing pages in both locales", async () => {
    const entries = await sitemap();
    const byUrl = new Map(entries.map((entry) => [entry.url, entry]));

    const vi = byUrl.get("https://portfolio.example/vi/projects/category/platform");
    const en = byUrl.get("https://portfolio.example/en/projects/category/platform");
    expect(vi).toBeDefined();
    expect(en).toBeDefined();
    // Freshness follows the newest project in the category.
    expect(vi?.lastModified).toEqual(projectDate);
    expect(vi?.alternates?.languages).toEqual({
      vi: "https://portfolio.example/vi/projects/category/platform",
      en: "https://portfolio.example/en/projects/category/platform",
      "x-default": "https://portfolio.example/vi/projects/category/platform",
    });
  });

  it("emits trailing-slash page URLs on the Pages export", async () => {
    vi.stubEnv("PAGES_EXPORT", "1");
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);
    expect(urls).toContain("https://portfolio.example/vi/blog/");
    expect(urls).toContain("https://portfolio.example/vi/projects/case-study/");
    expect(urls.every((url) => url.endsWith("/"))).toBe(true);
  });
});

describe("robots", () => {
  beforeEach(() => {
    vi.stubEnv("APP_URL", "https://portfolio.example");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("points to the sitemap and blocks admin, preview and API", () => {
    const result = robots();
    expect(result.sitemap).toBe("https://portfolio.example/sitemap.xml");
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    const disallow = Array.isArray(rules.disallow) ? rules.disallow : [rules.disallow];
    expect(disallow).toContain("/admin");
    expect(disallow).toContain("/preview");
    expect(disallow).toContain("/api/");
  });

  it("emits a bare hostname for the Host directive, not a URL", () => {
    expect(robots().host).toBe("portfolio.example");
  });

  it("keeps /media/ disallowed: the route serves draft media too", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    const disallow = Array.isArray(rules.disallow) ? rules.disallow : [rules.disallow];
    expect(disallow).toContain("/media/");
  });
});
