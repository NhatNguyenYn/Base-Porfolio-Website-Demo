import type { MetadataRoute } from "next";
import { locales, type Locale } from "@/i18n/config";
import { prisma } from "@/server/db";
import { absoluteUrl } from "@/lib/utils";
import { languageAlternates } from "@/lib/seo";

// Regenerated per request: publishing must appear without a redeploy. The query
// set is small and crawlers are infrequent.
export const dynamic = "force-dynamic";

const isLocale = (value: string): value is Locale => value === "vi" || value === "en";

function newest(rows: { updatedAt: Date }[], fallback: Date): Date {
  return rows.reduce((latest, row) => (row.updatedAt > latest ? row.updatedAt : latest), fallback);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [projects, artworks, articles, collections, settings] = await Promise.all([
    prisma.project.findMany({
      where: { visibility: "public", deletedAt: null, publishedAt: { not: null } },
      select: {
        slug: true,
        updatedAt: true,
        translations: { select: { locale: true } },
        thumbnailMedia: { select: { url: true } },
      },
    }),
    prisma.artwork.findMany({
      where: { visibility: "public", deletedAt: null },
      select: {
        slug: true,
        updatedAt: true,
        translations: { select: { locale: true } },
        imageMedia: { select: { url: true } },
      },
    }),
    prisma.article.findMany({
      where: { status: "published", visibility: "public", deletedAt: null, publishedAt: { lte: new Date() } },
      select: {
        slug: true,
        updatedAt: true,
        translations: { select: { locale: true } },
        coverMedia: { select: { url: true } },
      },
    }),
    prisma.artworkCollection.findMany({
      where: { visibility: "public", deletedAt: null },
      select: { slug: true, updatedAt: true, translations: { select: { locale: true } } },
    }),
    prisma.siteSetting.aggregate({ _max: { updatedAt: true } }),
  ]);

  const settingsUpdatedAt = settings._max.updatedAt ?? new Date(0);
  const blogUpdatedAt = newest(articles, settingsUpdatedAt);
  const projectsUpdatedAt = newest(projects, settingsUpdatedAt);
  const artUpdatedAt = newest([...artworks, ...collections], settingsUpdatedAt);
  const homeUpdatedAt = new Date(
    Math.max(blogUpdatedAt.getTime(), projectsUpdatedAt.getTime(), artUpdatedAt.getTime(), settingsUpdatedAt.getTime()),
  );

  const staticPaths: { path: string; lastModified: Date; changeFrequency: "weekly" | "monthly"; priority: number }[] = [
    { path: "", lastModified: homeUpdatedAt, changeFrequency: "weekly", priority: 1 },
    { path: "/about", lastModified: settingsUpdatedAt, changeFrequency: "monthly", priority: 0.8 },
    { path: "/projects", lastModified: projectsUpdatedAt, changeFrequency: "monthly", priority: 0.8 },
    { path: "/art", lastModified: artUpdatedAt, changeFrequency: "monthly", priority: 0.8 },
    { path: "/blog", lastModified: blogUpdatedAt, changeFrequency: "weekly", priority: 0.8 },
    { path: "/contact", lastModified: settingsUpdatedAt, changeFrequency: "monthly", priority: 0.7 },
  ];

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    for (const item of staticPaths) {
      entries.push({
        url: absoluteUrl(`/${locale}${item.path}`),
        lastModified: item.lastModified,
        changeFrequency: item.changeFrequency,
        priority: item.priority,
        alternates: {
          languages: Object.fromEntries(
            locales.map((available) => [available, absoluteUrl(`/${available}${item.path}`)]),
          ),
        },
      });
    }
  }

  const detailGroups = [
    { path: "/projects", rows: projects.map((row) => ({ ...row, imageUrl: row.thumbnailMedia?.url ?? null })) },
    { path: "/art", rows: artworks.map((row) => ({ ...row, imageUrl: row.imageMedia?.url ?? null })) },
    { path: "/blog", rows: articles.map((row) => ({ ...row, imageUrl: row.coverMedia?.url ?? null })) },
    { path: "/art/collections", rows: collections.map((row) => ({ ...row, imageUrl: null })) },
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
          priority: group.path === "/blog" ? 0.7 : 0.6,
          ...(row.imageUrl ? { images: [absoluteUrl(row.imageUrl)] } : {}),
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
