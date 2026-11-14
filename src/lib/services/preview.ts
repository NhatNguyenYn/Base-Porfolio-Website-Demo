import "server-only";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";
import type { Locale } from "@/i18n/config";

export type PreviewKind = "article" | "project" | "artwork" | "survey";

export function isPreviewKind(value: string): value is PreviewKind {
  return value === "article" || value === "project" || value === "artwork" || value === "survey";
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
      template: row.template,
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

  if (kind === "survey") {
    const row = await prisma.survey.findFirst({
      where: { id, deletedAt: null },
      include: {
        coverMedia: true,
        brandLogoMedia: true,
        translations: true,
        sections: {
          include: { translations: true },
          orderBy: { order: "asc" },
        },
        questions: {
          include: {
            translations: true,
            options: {
              include: { translations: true },
              orderBy: { order: "asc" },
            },
          },
          orderBy: { order: "asc" },
        },
        _count: { select: { responses: true } },
      },
    });
    if (!row) return null;
    return {
      kind,
      status: row.status,
      slug: row.slug,
      publishedAt: row.publishedAt,
      updatedAt: row.updatedAt,
      cover: row.coverMedia?.url ?? null,
      // BỔ SUNG 15:14 (A2 columns).
      brandName: row.brandName,
      brandLogo: row.brandLogoMedia?.url ?? null,
      badgeFromColor: row.badgeFromColor,
      badgeToColor: row.badgeToColor,
      themePreset: row.themePreset,
      layout: row.layout,
      progressStyle: row.progressStyle,
      buttonStyle: row.buttonStyle,
      borderRadius: row.borderRadius,
      primaryColor: row.primaryColor,
      accentColor: row.accentColor,
      backgroundColor: row.backgroundColor,
      surfaceColor: row.surfaceColor,
      textColor: row.textColor,
      estimatedMinutes: row.estimatedMinutes,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      isBookingIntake: row.isBookingIntake,
      responseCount: row._count.responses,
      sections: row.sections,
      questions: row.questions,
      translation: row.translations.find((item) => item.locale === locale) ?? null,
      locales: row.translations.map((item) => item.locale),
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
