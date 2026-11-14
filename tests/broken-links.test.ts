import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { renderMarkdown } from "@/lib/markdown";
import { listArticles, getRelatedArticles, listCategories } from "@/server/queries/articles";
import { listProjects, getNextProject, getRelatedProjects } from "@/server/queries/projects";
import { listArtworks, listCollections } from "@/server/queries/artworks";
import { resetDatabase, seedFixtures } from "./helpers/db";

/**
 * Broken internal links (8G-12/8C-10).
 *
 * The site emits links from database rows (cards, related sections, author
 * bylines, category chips). This test rebuilds exactly those hrefs from the
 * public queries and asserts each one resolves against the route table
 * derived from the same database — so a link to a draft, private or deleted
 * slug, or to a route that does not exist, fails here instead of in front
 * of a reader. It also asserts the reverse: private/draft content never
 * appears in any emitted href.
 */
const LOCALES = ["vi", "en"] as const;

type RouteTable = {
  articles: Set<string>;
  projects: Set<string>;
  artworks: Set<string>;
  collections: Set<string>;
  categories: Set<string>;
};

const STATIC_SEGMENTS = new Set(["", "about", "blog", "projects", "art", "contact"]);

function resolveHref(href: string, table: RouteTable): boolean {
  let path = href.split("#")[0].split("?")[0];
  if (!path.startsWith("/")) return false;
  const parts = path.split("/").filter(Boolean);
  const locale = parts[0];
  if (locale !== "vi" && locale !== "en") return false;
  const rest = parts.slice(1);
  if (rest.length === 0) return true;
  if (rest.length === 1) return STATIC_SEGMENTS.has(rest[0]);
  if (rest[0] === "blog" && rest.length === 2) return table.articles.has(rest[1]);
  if (rest[0] === "blog" && rest[1] === "category" && rest.length === 3) {
    return table.categories.has(rest[2]);
  }
  if (rest[0] === "projects" && rest.length === 2) return table.projects.has(rest[1]);
  if (rest[0] === "art" && rest.length === 2) return table.artworks.has(rest[1]);
  if (rest[0] === "art" && rest[1] === "collections" && rest.length === 3) {
    return table.collections.has(rest[2]);
  }
  return false;
}

describe("internal links resolve", () => {
  let table: RouteTable;
  let extraProjectIds: { sameCategory: string; otherCategory: string; self: string };

  beforeAll(async () => {
    await resetDatabase();
    await seedFixtures();

    // A category the fixture article belongs to, so the category landing
    // page (8G-5) has a real href to resolve.
    const category = await prisma.category.create({
      data: {
        slug: "test-category",
        kind: "article",
        translations: {
          create: [
            { locale: "vi", name: "Danh mục kiểm thử" },
            { locale: "en", name: "Test category" },
          ],
        },
      },
    });
    await prisma.article.update({
      where: { slug: "article-published" },
      data: { categoryId: category.id },
    });

    // Extra public projects so getRelatedProjects has something to order:
    // one in the same category as project-public, one in another category.
    const self = await prisma.project.findUniqueOrThrow({ where: { slug: "project-public" } });
    const sameCategory = await prisma.project.create({
      data: {
        slug: "project-same-category",
        visibility: "public",
        publishedAt: new Date(Date.now() - 86_400_000),
        category: "product",
        translations: {
          create: [
            { locale: "vi", name: "Dự án cùng loại", shortDescription: "Mô tả" },
            { locale: "en", name: "Same-category project", shortDescription: "Description" },
          ],
        },
      },
    });
    const otherCategory = await prisma.project.create({
      data: {
        slug: "project-other-category",
        visibility: "public",
        publishedAt: new Date(Date.now() - 86_400_000),
        category: "platform",
        translations: {
          create: [
            { locale: "vi", name: "Dự án khác loại", shortDescription: "Mô tả" },
            { locale: "en", name: "Other-category project", shortDescription: "Description" },
          ],
        },
      },
    });
    extraProjectIds = { sameCategory: sameCategory.id, otherCategory: otherCategory.id, self: self.id };

    const now = new Date();
    const [articles, projects, artworks, collections, categories] = await Promise.all([
      prisma.article.findMany({
        where: { status: "published", visibility: "public", deletedAt: null, publishedAt: { lte: now } },
        select: { slug: true },
      }),
      prisma.project.findMany({
        where: { visibility: "public", deletedAt: null, publishedAt: { not: null } },
        select: { slug: true },
      }),
      prisma.artwork.findMany({
        where: { visibility: "public", deletedAt: null },
        select: { slug: true },
      }),
      prisma.artworkCollection.findMany({
        where: { visibility: "public", deletedAt: null },
        select: { slug: true },
      }),
      prisma.category.findMany({ where: { kind: "article" }, select: { slug: true } }),
    ]);
    table = {
      articles: new Set(articles.map((row) => row.slug)),
      projects: new Set(projects.map((row) => row.slug)),
      artworks: new Set(artworks.map((row) => row.slug)),
      collections: new Set(collections.map((row) => row.slug)),
      categories: new Set(categories.map((row) => row.slug)),
    };
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("every href the public pages emit resolves to a known route/slug", async () => {
    const hrefs = new Set<string>();

    for (const locale of LOCALES) {
      const blogHref = `/${locale}/blog`;
      const projectsHref = `/${locale}/projects`;
      const artHref = `/${locale}/art`;
      hrefs.add(`/${locale}`);
      hrefs.add(`/${locale}/about`);
      hrefs.add(`/${locale}/contact`);
      hrefs.add(blogHref);
      hrefs.add(projectsHref);
      hrefs.add(artHref);

      // Blog list: article cards + category chips.
      const articles = await listArticles(locale, { perPage: 50 });
      for (const article of articles.items) hrefs.add(`${blogHref}/${article.slug}`);
      for (const category of articles.categories) hrefs.add(`${blogHref}/category/${category.slug}`);

      // Article detail: author byline + related articles.
      for (const article of articles.items) {
        hrefs.add(`/${locale}/about`);
        const related = await getRelatedArticles(locale, article.id, article.categorySlug, 3);
        for (const item of related) hrefs.add(`${blogHref}/${item.slug}`);
      }

      // Project list + detail: cards, next project, related projects.
      const projects = await listProjects(locale, { perPage: 50 });
      for (const project of projects.items) hrefs.add(`${projectsHref}/${project.slug}`);
      const next = await getNextProject("project-public", locale);
      if (next) hrefs.add(`${projectsHref}/${next.slug}`);
      const relatedProjects = await getRelatedProjects(locale, extraProjectIds.self, "product", 3);
      for (const item of relatedProjects) hrefs.add(`${projectsHref}/${item.slug}`);

      // Gallery: artworks + collections.
      const artworks = await listArtworks(locale);
      for (const artwork of artworks) hrefs.add(`${artHref}/${artwork.slug}`);
      const collections = await listCollections(locale);
      for (const collection of collections) hrefs.add(`${artHref}/collections/${collection.slug}`);

      // Category landing page data path.
      const categories = await listCategories(locale);
      for (const category of categories) hrefs.add(`${blogHref}/category/${category.slug}`);
    }

    expect(hrefs.size).toBeGreaterThan(0);
    const broken = [...hrefs].filter((href) => !resolveHref(href, table));
    expect(broken).toEqual([]);
    // No placeholder host ever leaks into an internal href (8D-10).
    expect([...hrefs].some((href) => href.includes("example.com"))).toBe(false);
  });

  it("never links to private, draft, unpublished or scheduled content", async () => {
    const hidden = ["article-draft", "article-scheduled", "article-archived", "article-private", "project-private", "project-unpublished", "art-private"];
    for (const slug of hidden) {
      expect(table.articles.has(slug)).toBe(false);
      expect(table.projects.has(slug)).toBe(false);
      expect(table.artworks.has(slug)).toBe(false);
    }
    const hrefs = new Set<string>();
    for (const locale of LOCALES) {
      const articles = await listArticles(locale, { perPage: 50 });
      for (const article of articles.items) hrefs.add(`/${locale}/blog/${article.slug}`);
      const projects = await listProjects(locale, { perPage: 50 });
      for (const project of projects.items) hrefs.add(`/${locale}/projects/${project.slug}`);
      const artworks = await listArtworks(locale);
      for (const artwork of artworks) hrefs.add(`/${locale}/art/${artwork.slug}`);
    }
    for (const slug of hidden) {
      expect([...hrefs].some((href) => href.endsWith(`/${slug}`))).toBe(false);
    }
  });

  it("related projects prefer the same category, never include the current project, and cap at 3", async () => {
    const related = await getRelatedProjects("vi", extraProjectIds.self, "product", 3);
    expect(related.length).toBeLessThanOrEqual(3);
    expect(related.some((item) => item.id === extraProjectIds.self)).toBe(false);
    expect(related[0]?.id).toBe(extraProjectIds.sameCategory);
    expect(related.some((item) => item.id === extraProjectIds.otherCategory)).toBe(true);
    const otherIndex = related.findIndex((item) => item.id === extraProjectIds.otherCategory);
    const sameIndex = related.findIndex((item) => item.id === extraProjectIds.sameCategory);
    expect(sameIndex).toBeLessThan(otherIndex);
  });

  it("the category landing page lists its article under a resolvable href", async () => {
    const categories = await listCategories("vi");
    const category = categories.find((item) => item.slug === "test-category");
    expect(category).toBeDefined();
    expect(resolveHref("/vi/blog/category/test-category", table)).toBe(true);
    const listed = await listArticles("vi", { category: "test-category" });
    expect(listed.items.map((item) => item.slug)).toContain("article-published");
  });

  it("links inside rendered Markdown resolve — and the resolver catches a draft link", async () => {
    const { html } = await renderMarkdown(
      "[Published](/vi/blog/article-published) and [Draft](/vi/blog/article-draft)",
    );
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
    expect(hrefs).toEqual(["/vi/blog/article-published", "/vi/blog/article-draft"]);
    expect(resolveHref(hrefs[0], table)).toBe(true);
    // The draft exists in the DB but is not a public route: linking to it
    // must be flagged, not silently accepted.
    expect(resolveHref(hrefs[1], table)).toBe(false);
  });

  it("rejects hrefs outside the known route shapes", () => {
    expect(resolveHref("/vi/blog", table)).toBe(true);
    expect(resolveHref("/en/projects/project-public", table)).toBe(true);
    expect(resolveHref("/vi/blog/no-such-article", table)).toBe(false);
    expect(resolveHref("/vi/blog/category/no-such-category", table)).toBe(false);
    expect(resolveHref("/fr/blog/article-published", table)).toBe(false);
    expect(resolveHref("/vi/admin", table)).toBe(false);
    expect(resolveHref("https://example.com/your-username", table)).toBe(false);
  });
});
