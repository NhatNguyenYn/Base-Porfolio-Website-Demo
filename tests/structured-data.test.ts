import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { serializeJsonLd } from "@/lib/json-ld";
import {
  buildArticleSchema,
  buildBlogSchema,
  buildBreadcrumbSchema,
  buildCollectionPageSchema,
  buildCreativeWorkSchema,
  buildItemListSchema,
  buildSiteGraph,
} from "@/lib/structured-data";

describe("structured data", () => {
  beforeEach(() => {
    vi.stubEnv("APP_URL", "https://portfolio.example");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds a WebSite with a root URL and no private email", () => {
    const graph = buildSiteGraph({
      locale: "vi",
      siteName: "Portfolio Studio",
      description: "Portfolio",
      person: {
        name: "Alex",
        jobTitle: "Designer",
        aboutUrl: "/vi/about",
        sameAs: ["https://github.com/alex"],
      },
    });

    const website = graph["@graph"][0] as Record<string, unknown>;
    const person = graph["@graph"][1] as Record<string, unknown>;
    expect(website).toMatchObject({
      "@type": "WebSite",
      url: "https://portfolio.example/",
      name: "Portfolio Studio",
      inLanguage: "vi-VN",
    });
    expect(person).toMatchObject({ "@type": "Person", url: "https://portfolio.example/vi/about" });
    expect(person).not.toHaveProperty("email");
  });

  it("builds a BlogPosting only from stored article fields", () => {
    const schema = buildArticleSchema({
      locale: "en",
      siteName: "Portfolio Studio",
      canonicalUrl: "https://portfolio.example/en/blog/post",
      headline: "A post",
      description: "Description",
      imageUrl: "/media/cover.jpg",
      datePublished: "2026-01-02T00:00:00.000Z",
      dateModified: "2026-01-03T00:00:00.000Z",
      authorName: "Alex",
      categoryName: "Design",
      keywords: ["design", "systems"],
      wordCount: 420,
      blogUrl: "/en/blog",
    });

    expect(schema).toMatchObject({
      "@type": "BlogPosting",
      headline: "A post",
      inLanguage: "en",
      mainEntityOfPage: { "@type": "WebPage", "@id": "https://portfolio.example/en/blog/post" },
      author: { "@type": "Person", name: "Alex" },
      publisher: { "@type": "Organization", name: "Portfolio Studio" },
      articleSection: "Design",
      keywords: "design, systems",
      wordCount: 420,
    });
    expect(schema.image).toEqual(["https://portfolio.example/media/cover.jpg"]);
    // Reading time is a UI hint, not schema.org data.
    expect(schema).not.toHaveProperty("timeRequired");
    expect(schema).not.toHaveProperty("readingTime");
  });

  it("omits optional fields instead of inventing them", () => {
    const schema = buildArticleSchema({
      locale: "vi",
      siteName: "Portfolio Studio",
      canonicalUrl: "https://portfolio.example/vi/blog/post",
      headline: "Bài viết",
      description: "Mô tả",
      dateModified: "2026-01-03T00:00:00.000Z",
      authorName: "Alex",
      blogUrl: "/vi/blog",
    });
    expect(schema).not.toHaveProperty("image");
    expect(schema).not.toHaveProperty("datePublished");
    expect(schema).not.toHaveProperty("keywords");
    expect(schema.publisher).not.toHaveProperty("logo");
  });

  it("numbers breadcrumbs in visible order", () => {
    const schema = buildBreadcrumbSchema([
      { name: "Home", href: "/vi" },
      { name: "Blog", href: "/vi/blog" },
      { name: "Post", href: "/vi/blog/post" },
    ]);
    expect(schema.itemListElement.map((item) => item.position)).toEqual([1, 2, 3]);
    expect(schema.itemListElement[1]).toMatchObject({
      name: "Blog",
      item: "https://portfolio.example/vi/blog",
    });
  });

  it("keeps CMS text escaped inside the JSON script", () => {
    const schema = buildArticleSchema({
      locale: "vi",
      siteName: "Portfolio Studio",
      canonicalUrl: "https://portfolio.example/vi/blog/post",
      headline: "</script><script>alert(1)</script>",
      description: "Tom & Jerry",
      dateModified: "2026-01-03T00:00:00.000Z",
      authorName: "Alex",
      blogUrl: "/vi/blog",
    });

    const json = serializeJsonLd(schema);
    expect(json).not.toContain("</script>");
    expect(json).toContain("\\u003c/script\\u003e");
    expect(JSON.parse(json).headline).toBe("</script><script>alert(1)</script>");
  });

  it("supports gallery work without a fake creator", () => {
    const schema = buildCreativeWorkSchema({
      canonicalUrl: "https://portfolio.example/vi/art/piece",
      name: "Piece",
      description: "Ink on paper",
      type: "VisualArtwork",
      medium: "Ink",
      datePublished: "2025-03-01T00:00:00.000Z",
    });
    expect(schema).toMatchObject({ "@type": "VisualArtwork", artMedium: "Ink" });
    expect(schema).not.toHaveProperty("creator");
  });

  it("adds a SearchAction and a fallback logo to the WebSite graph", () => {
    const graph = buildSiteGraph({
      locale: "vi",
      siteName: "Portfolio Studio",
      description: "Portfolio",
      logoUrl: "/icon.png",
      searchUrlTemplate: "https://portfolio.example/vi/blog?q={search_term_string}",
    });
    const website = graph["@graph"][0] as Record<string, unknown>;
    expect(website.logo).toEqual({ "@type": "ImageObject", url: "https://portfolio.example/icon.png" });
    expect(website.potentialAction).toEqual({
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: "https://portfolio.example/vi/blog?q={search_term_string}" },
      "query-input": "required name=search_term_string",
    });

    const bare = buildSiteGraph({ locale: "vi", siteName: "Portfolio Studio" });
    expect((bare["@graph"][0] as Record<string, unknown>)).not.toHaveProperty("logo");
    expect((bare["@graph"][0] as Record<string, unknown>)).not.toHaveProperty("potentialAction");
  });

  it("links the article author to the layout Person @id", () => {
    const schema = buildArticleSchema({
      locale: "en",
      siteName: "Portfolio Studio",
      canonicalUrl: "https://portfolio.example/en/blog/post",
      headline: "A post",
      description: "Description",
      dateModified: "2026-01-03T00:00:00.000Z",
      authorName: "Alex",
      authorAboutUrl: "/en/about",
      blogUrl: "/en/blog",
    });
    expect(schema.author).toEqual({
      "@type": "Person",
      "@id": "https://portfolio.example/en/about#person",
      name: "Alex",
      url: "https://portfolio.example/en/about",
    });

    const plain = buildArticleSchema({
      locale: "en",
      siteName: "Portfolio Studio",
      canonicalUrl: "https://portfolio.example/en/blog/post",
      headline: "A post",
      description: "Description",
      dateModified: "2026-01-03T00:00:00.000Z",
      authorName: "Alex",
      blogUrl: "/en/blog",
    });
    expect(plain.author).toEqual({ "@type": "Person", name: "Alex" });
  });

  it("uses the icon fallback as the publisher logo when settings has none", () => {
    const schema = buildArticleSchema({
      locale: "vi",
      siteName: "Portfolio Studio",
      siteLogoUrl: "/icon.png",
      canonicalUrl: "https://portfolio.example/vi/blog/post",
      headline: "Bài viết",
      description: "Mô tả",
      dateModified: "2026-01-03T00:00:00.000Z",
      authorName: "Alex",
      blogUrl: "/vi/blog",
    });
    expect(schema.publisher.logo).toEqual({ "@type": "ImageObject", url: "https://portfolio.example/icon.png" });
  });

  it("adds dateModified, technologies and keywords to project work", () => {
    const schema = buildCreativeWorkSchema({
      canonicalUrl: "https://portfolio.example/vi/projects/case-study",
      name: "Case Study",
      description: "A project",
      datePublished: "2025-01-01T00:00:00.000Z",
      dateModified: "2026-02-01T00:00:00.000Z",
      technologies: ["Next.js", "TypeScript"],
      keywords: ["design", "Next.js"],
    });
    expect(schema).toMatchObject({
      datePublished: "2025-01-01T00:00:00.000Z",
      dateModified: "2026-02-01T00:00:00.000Z",
      keywords: "Next.js, TypeScript, design",
    });
    // Artwork keywords come from tags; dateModified stays absent without an updatedAt.
    const art = buildCreativeWorkSchema({
      canonicalUrl: "https://portfolio.example/vi/art/piece",
      name: "Piece",
      description: "Ink",
      type: "VisualArtwork",
      medium: "Ink",
      datePublished: "2025-03-01T00:00:00.000Z",
      keywords: ["ink", "paper"],
    });
    expect(art).toMatchObject({ keywords: "ink, paper" });
    expect(art).not.toHaveProperty("dateModified");
    expect(art).not.toHaveProperty("creator");
  });

  it("builds ItemList, Blog and CollectionPage nodes for list pages", () => {
    const list = buildItemListSchema({
      id: "https://portfolio.example/vi/blog#articles",
      items: [
        { name: "First", url: "/vi/blog/first" },
        { name: "Second", url: "/vi/blog/second" },
      ],
    });
    expect(list).toMatchObject({
      "@type": "ItemList",
      "@id": "https://portfolio.example/vi/blog#articles",
      numberOfItems: 2,
    });
    expect(list.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "First", url: "https://portfolio.example/vi/blog/first" },
      { "@type": "ListItem", position: 2, name: "Second", url: "https://portfolio.example/vi/blog/second" },
    ]);

    expect(
      buildBlogSchema({ blogUrl: "/vi/blog", name: "Blog", description: "Writing" }),
    ).toMatchObject({ "@type": "Blog", "@id": "https://portfolio.example/vi/blog#blog", name: "Blog" });
    expect(
      buildCollectionPageSchema({ pageUrl: "/vi/projects", name: "Projects" }),
    ).toMatchObject({ "@type": "CollectionPage", "@id": "https://portfolio.example/vi/projects", name: "Projects" });
  });
});
