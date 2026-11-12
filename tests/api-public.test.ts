import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { GET as getArticles } from "@/app/api/articles/route";
import { GET as getArticle } from "@/app/api/articles/[slug]/route";
import { GET as getProjects } from "@/app/api/projects/route";
import { GET as getProject } from "@/app/api/projects/[slug]/route";
import { GET as getArtworks } from "@/app/api/artworks/route";
import { GET as getCollections } from "@/app/api/collections/route";
import { GET as getSettings } from "@/app/api/settings/route";
import { GET as getTags } from "@/app/api/tags/route";
import { GET as getProfile } from "@/app/api/profile/route";
import { resetDatabase, seedFixtures } from "./helpers/db";

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

beforeAll(async () => {
  await resetDatabase();
  await seedFixtures();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("public API envelope", () => {
  it("returns success/data/meta for article lists", async () => {
    const response = await getArticles(new Request("http://localhost/api/articles?locale=vi&perPage=2"));
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toMatchObject({ locale: "vi", perPage: 2, total: 2, pages: 1 });
  });

  it("rejects an unsupported locale with a typed error", async () => {
    const response = await getArticles(new Request("http://localhost/api/articles?locale=fr"));
    expect(response.status).toBe(400);
    const body = await response.json();

    expect(body).toMatchObject({ success: false, error: { code: "INVALID_LOCALE" } });
  });

  it("returns 404 (not 403) for draft article slugs so drafts stay undiscoverable", async () => {
    const response = await getArticle(new Request("http://localhost/api/articles/article-draft?locale=vi"), params("article-draft"));
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("exposes published article content per locale", async () => {
    const response = await getArticle(new Request("http://localhost/api/articles/article-published?locale=en"), params("article-published"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.title).toBe("Public article");
    expect(body.meta.locale).toBe("en");
  });

  it("filters project lists by technology and hides private projects", async () => {
    const response = await getProjects(new Request("http://localhost/api/projects?locale=vi&tech=Prisma"));
    const body = await response.json();

    expect(body.data).toHaveLength(1);
    expect(body.data[0].slug).toBe("project-public");
    expect(body.meta.technologies).toContain("Next.js");
  });

  it("returns 404 for a private project detail", async () => {
    const response = await getProject(new Request("http://localhost/api/projects/project-private?locale=vi"), params("project-private"));
    expect(response.status).toBe(404);
  });

  it("paginates artworks", async () => {
    const response = await getArtworks(new Request("http://localhost/api/artworks?locale=vi&perPage=1&page=2"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.meta).toMatchObject({ page: 2, perPage: 1, total: 2 });
  });

  it("lists only public collections", async () => {
    const body = await (await getCollections(new Request("http://localhost/api/collections?locale=vi"))).json();
    expect(body.data.map((item: { slug: string }) => item.slug)).toEqual(["public-collection"]);
  });

  it("serves the public settings subset with locales", async () => {
    const response = await getSettings();
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.data.defaultLocale).toBe("vi");
    expect(body.data.locales).toEqual(["vi", "en"]);
    expect(body.data).not.toHaveProperty("logoMediaId");
  });

  it("serves tags with usage counts", async () => {
    const body = await (await getTags()).json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("serves the localized profile", async () => {
    const body = await (await getProfile(new Request("http://localhost/api/profile?locale=en"))).json();
    expect(body.success).toBe(true);
    expect(body.data.content.fullName).toBe("Test Person");
  });
});
