import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  project: { findMany: vi.fn() },
  artwork: { findMany: vi.fn() },
  article: { findMany: vi.fn() },
  artworkCollection: { findMany: vi.fn() },
  siteSetting: { aggregate: vi.fn() },
}));

vi.mock("@/server/db", () => ({ prisma: db }));

import sitemap from "@/app/sitemap";
import robots from "@/app/robots";

const settingsDate = new Date("2026-02-01T00:00:00.000Z");
const articleDate = new Date("2026-03-01T00:00:00.000Z");
const projectDate = new Date("2026-02-15T00:00:00.000Z");
const artDate = new Date("2026-01-15T00:00:00.000Z");

describe("sitemap", () => {
  beforeEach(() => {
    vi.stubEnv("APP_URL", "https://portfolio.example");
    db.project.findMany.mockResolvedValue([
      {
        slug: "case-study",
        updatedAt: projectDate,
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
});
