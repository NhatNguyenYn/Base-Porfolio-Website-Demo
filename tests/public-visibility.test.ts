import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { getArticleDetail, listArticles } from "@/server/queries/articles";
import { getProjectDetail, listProjects } from "@/server/queries/projects";
import { getArtworkDetail, listArtworks, listCollections } from "@/server/queries/artworks";
import { resetDatabase, seedFixtures } from "./helpers/db";

beforeAll(async () => {
  await resetDatabase();
  await seedFixtures();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("articles — public visibility", () => {
  it("lists only published, public, past-dated articles", async () => {
    const { items } = await listArticles("vi");
    const slugs = items.map((item) => item.slug);

    expect(slugs).toContain("article-published");
    expect(slugs).not.toContain("article-draft");
    expect(slugs).not.toContain("article-scheduled");
    expect(slugs).not.toContain("article-archived");
    expect(slugs).not.toContain("article-private");
  });

  it("hides content that has no translation for the requested locale", async () => {
    const { items } = await listArticles("en");
    const slugs = items.map((item) => item.slug);

    expect(slugs).toEqual(["article-published"]);
  });

  it("returns not_found for drafts and future-dated articles", async () => {
    expect((await getArticleDetail("article-draft", "vi")).status).toBe("not_found");
    expect((await getArticleDetail("article-scheduled", "vi")).status).toBe("not_found");
    expect((await getArticleDetail("article-private", "vi")).status).toBe("not_found");
  });

  it("returns not_translated instead of falling back to another language", async () => {
    const result = await getArticleDetail("article-vi-only", "en");
    expect(result.status).toBe("not_translated");
    expect(result.article).toBeNull();
  });

  it("serves the published article with localized content", async () => {
    const vi = await getArticleDetail("article-published", "vi");
    const en = await getArticleDetail("article-published", "en");

    expect(vi.status).toBe("ok");
    expect(vi.article?.title).toBe("Bài viết công khai");
    expect(en.article?.title).toBe("Public article");
  });
});

describe("projects — public visibility", () => {
  it("excludes private and unpublished projects from the list", async () => {
    const { items } = await listProjects("vi");
    const slugs = items.map((item) => item.slug);

    expect(slugs).toContain("project-public");
    expect(slugs).not.toContain("project-private");
    expect(slugs).not.toContain("project-unpublished");
  });

  it("returns not_found when a private project slug is requested", async () => {
    expect((await getProjectDetail("project-private", "vi")).status).toBe("not_found");
    expect((await getProjectDetail("project-unpublished", "vi")).status).toBe("not_found");
  });

  it("exposes technologies for filtering", async () => {
    const { technologies } = await listProjects("vi");
    expect(technologies).toContain("Prisma");
    expect(technologies).toContain("Next.js");
  });
});

describe("artworks — public visibility", () => {
  it("excludes private artworks", async () => {
    const slugs = (await listArtworks("vi")).map((item) => item.slug);
    expect(slugs).toContain("art-public");
    expect(slugs).not.toContain("art-private");
  });

  it("does not return a private artwork by slug", async () => {
    expect((await getArtworkDetail("art-private", "vi")).status).toBe("not_found");
  });

  it("returns not_translated for a missing English translation", async () => {
    expect((await getArtworkDetail("art-vi-only", "en")).status).toBe("not_translated");
  });

  it("only lists public collections with their public artwork count", async () => {
    const collections = await listCollections("vi");
    const slugs = collections.map((item) => item.slug);

    expect(slugs).toEqual(["public-collection"]);
    expect(collections[0]?.count).toBe(1);
  });
});
