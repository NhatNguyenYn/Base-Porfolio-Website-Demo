import "server-only";
import type { Locale } from "@/i18n/config";
import { normalizeArticleTemplate, type ArticleTemplate } from "@/lib/article-template";
import { prisma } from "../db";
import { toMediaView } from "./media";
import { pickTranslation, type MediaView, type PublicStatus } from "./types";

export type ArticleCardData = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  excerpt: string;
  cover: MediaView | null;
  categoryName: string;
  categorySlug: string | null;
  tags: { name: string; slug: string }[];
  publishedAt: Date | null;
  readingMinutes: number;
  featured: boolean;
};

export type ArticleDetailData = ArticleCardData & {
  template: ArticleTemplate;
  content: string;
  authorName: string;
  updatedAt: Date;
  viewCount: number;
  seoTitle: string | null;
  seoDescription: string | null;
};

/**
 * Publish window evaluated per query. A module-level `new Date()` would freeze at
 * server start, hiding anything published later until the next restart.
 */
function publishedWhere() {
  return {
    status: "published" as const,
    visibility: "public" as const,
    deletedAt: null,
    publishedAt: { lte: new Date() },
  };
}

type ArticleRow = {
  id: string;
  slug: string;
  featured: boolean;
  publishedAt: Date | null;
  readingMinutes: number;
  category: { slug: string; translations: { name: string }[] } | null;
  coverMedia: Parameters<typeof toMediaView>[0];
  translations: {
    locale: string;
    title: string;
    subtitle: string | null;
    excerpt: string;
    content: string;
    seoTitle: string | null;
    seoDescription: string | null;
  }[];
  tags: { tag: { name: string; slug: string } }[];
};

function mapCard(row: ArticleRow, locale: Locale): ArticleCardData | null {
  const { row: translation } = pickTranslation(row.translations, locale);
  if (!translation) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: translation.title,
    subtitle: translation.subtitle ?? "",
    excerpt: translation.excerpt,
    cover: toMediaView(row.coverMedia),
    categoryName: row.category?.translations[0]?.name ?? "",
    categorySlug: row.category?.slug ?? null,
    tags: row.tags.map((item) => item.tag),
    publishedAt: row.publishedAt,
    readingMinutes: row.readingMinutes,
    featured: row.featured,
  };
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();
}

export type ArticleFilters = {
  q?: string;
  category?: string;
  tag?: string;
  page?: number;
  perPage?: number;
  excludeSlug?: string;
};

export async function listArticles(
  locale: Locale,
  filters: ArticleFilters = {},
): Promise<{
  items: ArticleCardData[];
  total: number;
  page: number;
  pages: number;
  categories: { slug: string; name: string; count: number }[];
  tags: { slug: string; name: string; count: number }[];
}> {
  const rows = await prisma.article.findMany({
    where: publishedWhere(),
    include: {
      coverMedia: true,
      category: { include: { translations: { where: { locale } } } },
      translations: { where: { locale } },
      tags: { include: { tag: true } },
    },
    orderBy: [{ featured: "desc" }, { publishedAt: "desc" }],
  });

  const all = rows.map((row) => mapCard(row, locale)).filter((row): row is ArticleCardData => Boolean(row));

  const categoryCounts = new Map<string, { name: string; count: number }>();
  const tagCounts = new Map<string, { name: string; count: number }>();
  for (const article of all) {
    if (article.categorySlug) {
      const current = categoryCounts.get(article.categorySlug);
      categoryCounts.set(article.categorySlug, {
        name: article.categoryName,
        count: (current?.count ?? 0) + 1,
      });
    }
    for (const tag of article.tags) {
      const current = tagCounts.get(tag.slug);
      tagCounts.set(tag.slug, { name: tag.name, count: (current?.count ?? 0) + 1 });
    }
  }

  let items = all;
  if (filters.excludeSlug) items = items.filter((item) => item.slug !== filters.excludeSlug);
  if (filters.category) items = items.filter((item) => item.categorySlug === filters.category);
  if (filters.tag) items = items.filter((item) => item.tags.some((tag) => tag.slug === filters.tag));
  if (filters.q?.trim()) {
    const needle = normalize(filters.q.trim());
    items = items.filter(
      (item) =>
        normalize(item.title).includes(needle) ||
        normalize(item.excerpt).includes(needle) ||
        item.tags.some((tag) => normalize(tag.name).includes(needle)),
    );
  }

  const perPage = filters.perPage ?? 9;
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(1, filters.page ?? 1), pages);

  return {
    items: items.slice((page - 1) * perPage, page * perPage),
    total,
    page,
    pages,
    categories: Array.from(categoryCounts.entries())
      .map(([slug, value]) => ({ slug, ...value }))
      .sort((a, b) => b.count - a.count),
    tags: Array.from(tagCounts.entries())
      .map(([slug, value]) => ({ slug, ...value }))
      .sort((a, b) => b.count - a.count),
  };
}

export async function getFeaturedArticle(locale: Locale): Promise<ArticleCardData | null> {
  const rows = await prisma.article.findMany({
    where: publishedWhere(),
    include: {
      coverMedia: true,
      category: { include: { translations: { where: { locale } } } },
      translations: { where: { locale } },
      tags: { include: { tag: true } },
    },
    orderBy: [{ featured: "desc" }, { publishedAt: "desc" }],
    take: 1,
  });
  const row = rows[0];
  return row ? mapCard(row as ArticleRow, locale) : null;
}

export async function getArticleDetail(
  slug: string,
  locale: Locale,
): Promise<{ status: PublicStatus; article: ArticleDetailData | null }> {
  const article = await prisma.article.findUnique({
    where: { slug },
    include: {
      coverMedia: true,
      category: { include: { translations: { where: { locale } } } },
      translations: true,
      tags: { include: { tag: true } },
      author: { select: { name: true } },
    },
  });

  if (
    !article ||
    article.deletedAt ||
    article.status !== "published" ||
    article.visibility !== "public" ||
    !article.publishedAt ||
    article.publishedAt.getTime() > Date.now()
  ) {
    return { status: "not_found", article: null };
  }

  const { row } = pickTranslation(article.translations, locale);
  if (!row) return { status: "not_translated", article: null };

  return {
    status: "ok",
    article: {
      id: article.id,
      slug: article.slug,
      template: normalizeArticleTemplate(article.template),
      title: row.title,
      subtitle: row.subtitle ?? "",
      excerpt: row.excerpt,
      content: row.content,
      cover: toMediaView(article.coverMedia),
      categoryName: article.category?.translations[0]?.name ?? "",
      categorySlug: article.category?.slug ?? null,
      tags: article.tags.map((item) => item.tag),
      publishedAt: article.publishedAt,
      readingMinutes: article.readingMinutes,
      featured: article.featured,
      authorName: article.author.name,
      updatedAt: article.updatedAt,
      viewCount: article.viewCount,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
    },
  };
}

export async function incrementArticleView(id: string): Promise<void> {
  // Raw increment: Prisma's @updatedAt would otherwise mark the article as
  // modified on every public view, corrupting dateModified and sitemap lastmod.
  await prisma.$executeRaw`UPDATE "Article" SET "viewCount" = "viewCount" + 1 WHERE "id" = ${id}`.catch(() => undefined);
}

export async function getRelatedArticles(
  locale: Locale,
  excludeId: string,
  categorySlug: string | null,
  limit = 3,
): Promise<ArticleCardData[]> {
  const rows = await prisma.article.findMany({
    where: { ...publishedWhere(), id: { not: excludeId } },
    include: {
      coverMedia: true,
      category: { include: { translations: { where: { locale } } } },
      translations: { where: { locale } },
      tags: { include: { tag: true } },
    },
    orderBy: { publishedAt: "desc" },
    take: 12,
  });

  const items = rows.map((row) => mapCard(row, locale)).filter((row): row is ArticleCardData => Boolean(row));
  const sameCategory = items.filter((item) => item.categorySlug === categorySlug);
  const others = items.filter((item) => item.categorySlug !== categorySlug);
  return [...sameCategory, ...others].slice(0, limit);
}

export async function listCategories(locale: Locale) {
  const rows = await prisma.category.findMany({
    where: { kind: "article" },
    include: { translations: { where: { locale } }, _count: { select: { articles: true } } },
    orderBy: { order: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.translations[0]?.name ?? row.slug,
    description: row.translations[0]?.description ?? "",
    count: row._count.articles,
  }));
}

/** Admin queries */
export async function listArticlesForAdmin() {
  return prisma.article.findMany({
    where: { deletedAt: null },
    include: {
      coverMedia: true,
      translations: true,
      category: { include: { translations: true } },
      author: { select: { name: true } },
      tags: { include: { tag: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
  });
}

export async function getArticleForAdmin(id: string) {
  return prisma.article.findFirst({
    where: { id, deletedAt: null },
    include: {
      coverMedia: true,
      translations: true,
      category: true,
      tags: { include: { tag: true } },
    },
  });
}

export async function listCategoriesForAdmin() {
  return prisma.category.findMany({
    include: { translations: true, _count: { select: { articles: true } } },
    orderBy: [{ kind: "asc" }, { order: "asc" }],
  });
}

export async function listTagsForAdmin() {
  return prisma.tag.findMany({
    include: { _count: { select: { articles: true, artworks: true } } },
    orderBy: { name: "asc" },
  });
}

/**
 * Locales that actually have a published translation of this article.
 * Used for hreflang/sitemap so unpublished or missing languages are not
 * advertised to crawlers.
 */
export async function getArticleLocales(slug: string): Promise<Locale[]> {
  const row = await prisma.article.findUnique({
    where: { slug },
    select: {
      status: true,
      visibility: true,
      deletedAt: true,
      publishedAt: true,
      translations: { select: { locale: true } },
    },
  });
  if (
    !row ||
    row.deletedAt ||
    row.status !== "published" ||
    row.visibility !== "public" ||
    !row.publishedAt ||
    row.publishedAt.getTime() > Date.now()
  ) {
    return [];
  }
  return row.translations
    .map((item) => item.locale)
    .filter((locale): locale is Locale => locale === "vi" || locale === "en");
}
