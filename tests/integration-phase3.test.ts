import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { publicCache } from "@/lib/api";
import { languageAlternates } from "@/lib/seo";
import { getArticleLocales, listArticles } from "@/server/queries/articles";
import { getProjectLocales } from "@/server/queries/projects";
import { getArtworkLocales } from "@/server/queries/artworks";
import sitemap from "@/app/sitemap";
import { resetDatabase, seedFixtures } from "./helpers/db";

beforeAll(async () => {
  await resetDatabase();
  await seedFixtures();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("hreflang alternates", () => {
  it("lists both locales and a default x-default when both translations exist", () => {
    expect(languageAlternates("/projects/alpha", ["vi", "en"])).toEqual({
      vi: "/vi/projects/alpha",
      en: "/en/projects/alpha",
      "x-default": "/vi/projects/alpha",
    });
  });

  it("never advertises a locale that has no translation", () => {
    const onlyVi = languageAlternates("/blog/vi-only", ["vi"]);
    expect(onlyVi).toEqual({ vi: "/vi/blog/vi-only", "x-default": "/vi/blog/vi-only" });
    expect(onlyVi.en).toBeUndefined();

    const onlyEn = languageAlternates("/blog/en-only", ["en"]);
    expect(onlyEn).toEqual({ en: "/en/blog/en-only", "x-default": "/en/blog/en-only" });
    expect(onlyEn.vi).toBeUndefined();
  });

  it("normalizes paths without a leading slash", () => {
    expect(languageAlternates("art/piece", ["vi"])).toEqual({
      vi: "/vi/art/piece",
      "x-default": "/vi/art/piece",
    });
  });

  it("returns no alternates for unpublished content", () => {
    expect(languageAlternates("/blog/draft", [])).toEqual({});
  });
});

describe("translation-aware locale lookups", () => {
  it("returns only locales with a published translation", async () => {
    expect((await getArticleLocales("article-published")).sort()).toEqual(["en", "vi"]);
    expect(await getArticleLocales("article-vi-only")).toEqual(["vi"]);
  });

  it("returns nothing for drafts, scheduled, archived and private articles", async () => {
    expect(await getArticleLocales("article-draft")).toEqual([]);
    expect(await getArticleLocales("article-scheduled")).toEqual([]);
    expect(await getArticleLocales("article-archived")).toEqual([]);
    expect(await getArticleLocales("article-private")).toEqual([]);
    expect(await getArticleLocales("does-not-exist")).toEqual([]);
  });

  it("returns nothing for unpublished projects and artworks", async () => {
    expect(await getProjectLocales("project-unpublished")).toEqual([]);
    expect(await getProjectLocales("project-private")).toEqual([]);
    expect(await getArtworkLocales("art-private")).toEqual([]);
    expect((await getProjectLocales("project-public")).sort()).toEqual(["en", "vi"]);
    expect(await getArtworkLocales("art-vi-only")).toEqual(["vi"]);
  });
});

describe("publish freshness", () => {
  it("lists an article published after the module was loaded (no restart needed)", async () => {
    const author = await prisma.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN" } });
    await prisma.article.create({
      data: {
        authorId: author.id,
        slug: "article-published-just-now",
        status: "published",
        visibility: "public",
        publishedAt: new Date(),
        readingMinutes: 1,
        translations: { create: [{ locale: "vi", title: "Vừa xuất bản", excerpt: "", content: "Nội dung" }] },
      },
    });

    const { items } = await listArticles("vi", { perPage: 50 });
    expect(items.map((item) => item.slug)).toContain("article-published-just-now");
  });
});

describe("sitemap", () => {
  it("contains only published, indexed content", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    const joined = urls.join("\n");

    expect(joined).toContain("/vi/blog/article-published");
    expect(joined).not.toContain("article-draft");
    expect(joined).not.toContain("article-scheduled");
    expect(joined).not.toContain("article-archived");
    expect(joined).not.toContain("article-private");
    expect(joined).not.toContain("project-unpublished");
    expect(joined).not.toContain("project-private");
    expect(joined).not.toContain("/admin");
  });

  it("emits one URL per available locale and matching alternates", async () => {
    const entries = await sitemap();
    const viOnly = entries.filter((entry) => entry.url.endsWith("/blog/article-vi-only"));
    expect(viOnly).toHaveLength(1);
    expect(viOnly[0].url).toContain("/vi/");
    expect(viOnly[0].alternates?.languages).toEqual({
      vi: expect.stringContaining("/vi/blog/article-vi-only"),
      "x-default": expect.stringContaining("/vi/blog/article-vi-only"),
    });

    const bilingual = entries.filter((entry) => entry.url.endsWith("/projects/project-public"));
    expect(bilingual).toHaveLength(2);
    const languages = bilingual[0].alternates?.languages ?? {};
    expect(Object.keys(languages).sort()).toEqual(["en", "vi", "x-default"]);
  });
});

describe("public API cache policy", () => {
  it("does not serve a stale edge copy after a CMS edit", () => {
    const headers = publicCache.headers as Record<string, string>;
    expect(headers["Cache-Control"]).toContain("s-maxage=0");
    expect(headers["Cache-Control"]).toContain("must-revalidate");
    expect(headers["Cache-Control"]).not.toMatch(/s-maxage=[1-9]/);
  });
});
