import type { MetadataRoute } from "next";
import { locales, type Locale } from "@/i18n/config";
import { prisma } from "@/server/db";
import { absoluteUrl } from "@/lib/utils";
import { languageAlternates } from "@/lib/seo";

// Regenerated per request: publishing must appear without a redeploy. The query
// set is small and crawlers are infrequent.
export const dynamic = "force-dynamic";

const isLocale = (value: string): value is Locale => value === "vi" || value === "en";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = ["", "/about", "/projects", "/art", "/blog", "/contact"];
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    for (const path of staticPaths) {
      entries.push({
        url: absoluteUrl(`/${locale}${path}`),
        lastModified: new Date(),
        changeFrequency: path === "" || path === "/blog" ? "weekly" : "monthly",
        priority: path === "" ? 1 : 0.8,
        alternates: {
          languages: Object.fromEntries(locales.map((item) => [item, absoluteUrl(`/${item}${path}`)])),
        },
      });
    }
  }

  const [projects, artworks, articles, collections] = await Promise.all([
    prisma.project.findMany({
      where: { visibility: "public", deletedAt: null, publishedAt: { not: null } },
      select: { slug: true, updatedAt: true, translations: { select: { locale: true } } },
    }),
    prisma.artwork.findMany({
      where: { visibility: "public", deletedAt: null },
      select: { slug: true, updatedAt: true, translations: { select: { locale: true } } },
    }),
    prisma.article.findMany({
      where: { status: "published", visibility: "public", deletedAt: null, publishedAt: { lte: new Date() } },
      select: { slug: true, updatedAt: true, translations: { select: { locale: true } } },
    }),
    prisma.artworkCollection.findMany({
      where: { visibility: "public", deletedAt: null },
      select: { slug: true, updatedAt: true, translations: { select: { locale: true } } },
    }),
  ]);

  const detailGroups = [
    { path: "/projects", rows: projects },
    { path: "/art", rows: artworks },
    { path: "/blog", rows: articles },
    { path: "/art/collections", rows: collections },
  ];

  for (const group of detailGroups) {
    for (const row of group.rows) {
      // Only locales that really have a translation — a missing language would
      // otherwise be advertised and then return a "not translated" page.
      const available = row.translations.map((item) => item.locale).filter(isLocale);
      if (available.length === 0) continue;

      for (const locale of available) {
        entries.push({
          url: absoluteUrl(`/${locale}${group.path}/${row.slug}`),
          lastModified: row.updatedAt,
          changeFrequency: "monthly",
          priority: 0.6,
          alternates: {
            languages: Object.fromEntries(
              Object.entries(languageAlternates(`${group.path}/${row.slug}`, available)).map(([key, value]) => [
                key,
                absoluteUrl(value),
              ]),
            ),
          },
        });
      }
    }
  }

  return entries;
}
