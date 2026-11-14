import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/server/db";
import { listProjects } from "@/server/queries/projects";
import { resetDatabase, seedFixtures } from "./helpers/db";

beforeAll(async () => {
  await resetDatabase();
  await seedFixtures();
});

afterAll(async () => {
  await prisma.$disconnect();
});

function readPage(relative: string): string {
  return fs.readFileSync(path.join(process.cwd(), "src", "app", "(public)", "[locale]", relative), "utf8");
}

describe("category filter — data layer (backs the prerendered category pages)", () => {
  it("listProjects filters by category slug and keeps the full facet list", async () => {
    const product = await listProjects("vi", { category: "product" });
    expect(product.total).toBe(1);
    expect(product.items.map((item) => item.slug)).toEqual(["project-public"]);
    // Facets are computed across all public projects, so the category page
    // can render the whole chip row even while showing one category.
    expect(product.categories).toEqual([{ slug: "product", count: 1 }]);

    const platform = await listProjects("vi", { category: "platform" });
    expect(platform.total).toBe(0);
    expect(platform.items).toEqual([]);
  });
});

/**
 * Static-export contract for the category chips (bug: `?category=slug` on a
 * prerendered list page only changes the URL — there is no server to
 * re-render the filtered list, so every project/article stayed visible).
 *
 * In a PAGES_EXPORT build the chips must link to the prerendered
 * /category/<slug>/ pages; the query-param form is kept for server mode
 * only, where it can combine with the q/tag/tech/sort search.
 */
describe("category filter — static-export chip contract (source guard)", () => {
  it("blog list chips point at the prerendered category pages in export mode", () => {
    const src = readPage("blog/page.tsx");
    const fn = src.slice(src.indexOf("const categoryHref"));
    const body = fn.slice(0, fn.indexOf("};") + 2);
    expect(body).toContain('if (process.env.PAGES_EXPORT === "1")');
    expect(body).toContain("`${blogHref}/category/${slug}`");
    // The export branch returns the category-page link before any query
    // string is built, so no `?category=` link can leak into the export.
    expect(body.indexOf("`${blogHref}/category/${slug}`")).toBeLessThan(body.indexOf("new URLSearchParams"));
  });

  it("projects list chips point at the prerendered category pages in export mode", () => {
    const src = readPage("projects/page.tsx");
    const fn = src.slice(src.indexOf("const categoryHref"));
    const body = fn.slice(0, fn.indexOf("};") + 2);
    expect(body).toContain('if (process.env.PAGES_EXPORT === "1")');
    expect(body).toContain("`${basePath}/category/${slug}`");
    expect(body.indexOf("`${basePath}/category/${slug}`")).toBeLessThan(body.indexOf("new URLSearchParams"));
  });

  it("a projects category page exists, prerenders every category, and filters by slug", () => {
    const src = readPage("projects/category/[slug]/page.tsx");
    expect(src).toContain("export async function generateStaticParams()");
    expect(src).toContain("prisma.project.groupBy");
    expect(src).toContain("listProjects(locale, {");
    expect(src).toContain("category: slug");
    // The page must not depend on searchParams for its content (that would
    // opt it out of static generation in the export build).
    expect(src).toContain('process.env.PAGES_EXPORT === "1" ? {} : await searchParams');
  });

  it("both category pages render the chip row with the current category active", () => {
    const blogCategory = readPage("blog/category/[slug]/page.tsx");
    expect(blogCategory).toContain("`${blogHref}/category/${item.slug}`");
    expect(blogCategory).toContain('item.slug === slug ? "chip-active" : ""');

    const projectsCategory = readPage("projects/category/[slug]/page.tsx");
    expect(projectsCategory).toContain("`${basePath}/category/${item.slug}`");
    expect(projectsCategory).toContain('item.slug === slug ? "chip-active" : ""');
  });
});
