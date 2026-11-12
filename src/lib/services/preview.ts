import "server-only";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";
import type { Locale } from "@/i18n/config";

export type PreviewKind = "article" | "project" | "artwork";

export function isPreviewKind(value: string): value is PreviewKind {
  return value === "article" || value === "project" || value === "artwork";
}

/**
 * Preview data is read by id, ignoring publish state, but only after a session
 * check. There is no public URL, fixed token or query secret to leak.
 */
export async function getPreviewData(kind: PreviewKind, id: string, locale: Locale) {
  await requireUser();

  if (kind === "article") {
    const row = await prisma.article.findFirst({
      where: { id, deletedAt: null },
      include: {
        coverMedia: true,
        author: { select: { name: true } },
        category: { include: { translations: true } },
        translations: true,
      },
    });
    if (!row) return null;
    return {
      kind,
      status: row.status,
      publishedAt: row.publishedAt,
      updatedAt: row.updatedAt,
      cover: row.coverMedia?.url ?? null,
      author: row.author.name,
      category: row.category?.translations.find((item) => item.locale === locale)?.name ?? "",
      translation: row.translations.find((item) => item.locale === locale) ?? null,
      locales: row.translations.map((item) => item.locale),
    };
  }

  if (kind === "project") {
    const row = await prisma.project.findFirst({
      where: { id, deletedAt: null },
      include: {
        thumbnailMedia: true,
        images: { include: { media: true }, orderBy: { order: "asc" } },
        technologies: { orderBy: { order: "asc" } },
        translations: true,
      },
    });
    if (!row) return null;
    return {
      kind,
      status: row.visibility === "public" && row.publishedAt ? "published" : "draft",
      publishedAt: row.publishedAt,
      updatedAt: row.updatedAt,
      cover: row.thumbnailMedia?.url ?? null,
      gallery: row.images.map((image) => image.media.url),
      technologies: row.technologies.map((tech) => tech.name),
      translation: row.translations.find((item) => item.locale === locale) ?? null,
      locales: row.translations.map((item) => item.locale),
      githubUrl: row.githubUrl,
      demoUrl: row.demoUrl,
    };
  }

  const row = await prisma.artwork.findFirst({
    where: { id, deletedAt: null },
    include: {
      imageMedia: true,
      thumbnailMedia: true,
      collection: { include: { translations: true } },
      category: { include: { translations: true } },
      translations: true,
    },
  });
  if (!row) return null;
  return {
    kind,
    status: row.visibility === "public" ? "published" : "draft",
    publishedAt: null,
    updatedAt: row.updatedAt,
    cover: row.imageMedia.url,
    thumbnail: row.thumbnailMedia?.url ?? null,
    image: row.imageMedia.url,
    dimensions: { width: row.imageMedia.width, height: row.imageMedia.height },
    collection: row.collection?.translations.find((item) => item.locale === locale)?.name ?? "",
    category: row.category?.translations.find((item) => item.locale === locale)?.name ?? "",
    createdDate: row.createdDate,
    medium: row.medium,
    translation: row.translations.find((item) => item.locale === locale) ?? null,
    locales: row.translations.map((item) => item.locale),
  };
}

export type PreviewData = NonNullable<Awaited<ReturnType<typeof getPreviewData>>>;
