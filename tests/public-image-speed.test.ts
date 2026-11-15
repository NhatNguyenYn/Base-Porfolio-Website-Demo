import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/server/db";
import { countArtworks, listArtworks, listArtworkSlugs } from "@/server/queries/artworks";
import { GET as getArtworks } from "@/app/api/artworks/route";
import { resetDatabase, seedFixtures } from "./helpers/db";

/**
 * Public-site image speed (Stage 3): DB-level pagination, slim card
 * payloads (no blurDataUrl), and ISR for the content pages.
 *
 * The gallery used to ship all 117 artworks in one RSC payload; the
 * homepage fetched all rows to show 6. These tests pin the new behaviour:
 * pagination happens at the database, card images carry no blur data URI,
 * and the content pages are ISR (`revalidate = 60`) instead of
 * force-dynamic.
 */

const EXTRA = 30;

beforeAll(async () => {
  await resetDatabase();
  const fixtures = await seedFixtures();
  // 30 more public artworks (both locales) so pagination has pages.
  for (let i = 1; i <= EXTRA; i++) {
    const n = String(i).padStart(2, "0");
    await prisma.artwork.create({
      data: {
        slug: `speed-artwork-${n}`,
        imageMediaId: fixtures.media.id,
        collectionId: fixtures.publicCollection.id,
        visibility: "public",
        featured: false,
        order: 10 + i,
        translations: {
          create: [
            { locale: "vi", title: `Tác phẩm tốc độ ${n}`, description: `Mô tả ${n}` },
            { locale: "en", title: `Speed artwork ${n}`, description: `Description ${n}` },
          ],
        },
      },
    });
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("artwork pagination at the database", () => {
  it("counts visible cards per locale (untranslated rows excluded)", async () => {
    // Fixtures: art-public (vi+en), art-vi-only (vi only, public), plus 30 new.
    expect(await countArtworks("vi")).toBe(32);
    expect(await countArtworks("en")).toBe(31);
  });

  it("pages are disjoint, stable, and cover the full list", async () => {
    const full = await listArtworks("vi");
    expect(full).toHaveLength(32);
    const page1 = await listArtworks("vi", { limit: 10 });
    const page2 = await listArtworks("vi", { limit: 10, offset: 10 });
    const page3 = await listArtworks("vi", { limit: 10, offset: 20 });
    const page4 = await listArtworks("vi", { limit: 10, offset: 30 });
    expect(page1).toHaveLength(10);
    expect(page2).toHaveLength(10);
    expect(page3).toHaveLength(10);
    expect(page4).toHaveLength(2);
    expect([...page1, ...page2, ...page3, ...page4].map((item) => item.id)).toEqual(
      full.map((item) => item.id),
    );
    // Same page twice returns the same cards in the same order.
    const page1Again = await listArtworks("vi", { limit: 10 });
    expect(page1Again.map((item) => item.id)).toEqual(page1.map((item) => item.id));
  });

  it("a limit of 6 fetches 6 rows (homepage preview), not the whole table", async () => {
    const preview = await listArtworks("vi", { limit: 6 });
    expect(preview).toHaveLength(6);
    expect(await countArtworks("vi")).toBe(32);
  });

  it("collection filter paginates within that collection", async () => {
    const total = await countArtworks("vi", { collection: "public-collection" });
    expect(total).toBe(31);
    const first = await listArtworks("vi", { collection: "public-collection", limit: 10 });
    const rest = await listArtworks("vi", { collection: "public-collection", limit: 30, offset: 10 });
    expect(first).toHaveLength(10);
    expect(rest).toHaveLength(21);
    expect(new Set([...first, ...rest].map((item) => item.id)).size).toBe(31);
  });
});

describe("slim card payload", () => {
  it("card images carry no blurDataUrl, descriptions stay for the lightbox", async () => {
    const cards = await listArtworks("vi", { limit: 5 });
    for (const card of cards) {
      expect(card.image).not.toBeNull();
      expect(card.image).not.toHaveProperty("blurDataUrl");
      // Descriptions stay in the payload: the lightbox renders them.
      expect(typeof card.description).toBe("string");
    }
    const pub = cards.find((card) => card.slug === "art-public");
    expect(pub?.description.length).toBeGreaterThan(0);
  });

  it("the JSON-LD slug list is light (slug + title only)", async () => {
    const slugs = await listArtworkSlugs("vi");
    expect(slugs).toHaveLength(32);
    for (const item of slugs) {
      expect(Object.keys(item).sort()).toEqual(["slug", "title"]);
    }
  });
});

describe("public artworks API pagination", () => {
  it("returns the requested page with a real total", async () => {
    const response = await getArtworks(
      new Request("http://localhost/api/artworks?locale=vi&page=2&perPage=10"),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(10);
    expect(body.meta).toMatchObject({ page: 2, perPage: 10, total: 32, pages: 4, locale: "vi" });
    for (const item of body.data) {
      expect(item.image ?? null).not.toHaveProperty("blurDataUrl");
    }
  });

  it("clamps a page past the end instead of returning an empty page", async () => {
    const response = await getArtworks(
      new Request("http://localhost/api/artworks?locale=vi&page=99&perPage=10"),
    );
    const body = await response.json();
    expect(body.meta).toMatchObject({ page: 4, total: 32, pages: 4 });
    expect(body.data).toHaveLength(2);
  });
});

describe("ISR configuration for content pages", () => {
  const root = process.cwd();
  const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

  it("home, art, about and contact are ISR (revalidate 60), not force-dynamic", () => {
    for (const rel of [
      "src/app/(public)/[locale]/page.tsx",
      "src/app/(public)/[locale]/art/page.tsx",
      "src/app/(public)/[locale]/about/page.tsx",
      "src/app/(public)/[locale]/contact/page.tsx",
    ]) {
      const source = read(rel);
      expect(source).toContain("export const revalidate = 60;");
      expect(source).not.toContain('export const dynamic = "force-dynamic"');
    }
  });

  it("the public layout no longer reads the per-request nonce", () => {
    const source = read("src/app/(public)/[locale]/layout.tsx");
    expect(source).not.toContain("next/headers");
    expect(source).not.toContain('export const dynamic = "force-dynamic"');
    expect(source).toContain("theme-init.js");
  });

  it("the theme bootstrap is a static file that reads its default from a data attribute", () => {
    const script = read("public/theme-init.js");
    expect(script).toContain("data-default-theme");
    expect(script).toContain("ps-theme");
  });

  it("GALLERY_PER_PAGE lives in a plain module, not the client gallery", () => {
    // A server component that imports a plain const from a "use client"
    // module gets a client-reference function instead of the number — the
    // build then fails prerendering with `take: [object Function]`.
    const shared = readFileSync("src/data/gallery.ts", "utf8");
    expect(shared).toMatch(/export const GALLERY_PER_PAGE = 24/);
    // No "use client" DIRECTIVE (the word appears in the comment, so strip
    // comments first and check the first real statement).
    const withoutComments = shared.replace(/\/\*[\s\S]*?\*\//g, "").trimStart();
    expect(withoutComments).not.toMatch(/^"use client"/);
    const gallery = readFileSync("src/components/site/art-gallery.tsx", "utf8");
    expect(gallery).not.toMatch(/export const GALLERY_PER_PAGE/);
    expect(gallery).toContain('from "@/data/gallery"');
    const artPage = readFileSync("src/app/(public)/[locale]/art/page.tsx", "utf8");
    expect(artPage).toContain('from "@/data/gallery"');
  });

  it("the Pages demo build rewrites revalidate exports to force-static", () => {
    const workflow = read(".github/workflows/pages.yml");
    expect(workflow).toContain('export const revalidate = 60;');
    expect(workflow).toContain('export const dynamic = "force-static"');
  });

  it("search-driven and freshness-critical pages stay dynamic", () => {
    for (const rel of [
      "src/app/(public)/[locale]/blog/page.tsx",
      "src/app/(public)/[locale]/dat-lich-khao-sat/page.tsx",
    ]) {
      expect(read(rel)).toContain('export const dynamic = "force-dynamic"');
    }
  });
});
