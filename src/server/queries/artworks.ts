import "server-only";
import type { Locale } from "@/i18n/config";
import type { Media } from "@prisma/client";
import { prisma } from "../db";
import { toMediaView } from "./media";
import { pickTranslation, type MediaView, type PublicStatus } from "./types";

/**
 * The image a gallery card actually renders: URL, dimensions, alt and title.
 * Deliberately WITHOUT `blurDataUrl` — no public component renders a blur
 * placeholder (SkeletonImage shows a CSS shimmer instead), so shipping the
 * 16px WebP data URI for every card only bloats the RSC payload (~300 bytes
 * × 117 artworks on /art). The full MediaView (with blur) is still used
 * where a single artwork is shown (detail page, admin).
 */
export type CardMediaView = {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  alt: string;
  title: string;
};

export function toCardMediaView(media: Partial<Media> | null | undefined): CardMediaView | null {
  if (!media?.url) return null;
  return {
    id: media.id ?? "",
    url: media.url,
    width: media.width ?? null,
    height: media.height ?? null,
    alt: media.alt ?? "",
    title: media.title ?? media.filename ?? "",
  };
}

export type ArtworkCardData = {
  id: string;
  slug: string;
  title: string;
  description: string;
  image: CardMediaView | null;
  medium: string;
  createdDate: Date | null;
  categoryName: string;
  categorySlug: string | null;
  collectionName: string;
  collectionSlug: string | null;
  featured: boolean;
  order: number;
};

export type ArtworkDetailData = ArtworkCardData & {
  tags: { name: string; slug: string }[];
  viewCount: number;
  /** Content-edit timestamp, for the detail page's schema dateModified (8B-5). */
  updatedAt: Date;
};

type ArtworkRow = Awaited<ReturnType<typeof fetchArtworkRows>>[number];

/** Shared filters for the public artwork list, applied at the database. */
function artworkWhere(
  locale: Locale,
  filters: { collection?: string; category?: string; featuredOnly?: boolean },
) {
  return {
    visibility: "public" as const,
    deletedAt: null,
    ...(filters.collection ? { collection: { slug: filters.collection } } : {}),
    ...(filters.category ? { category: { slug: filters.category } } : {}),
    ...(filters.featuredOnly ? { featured: true } : {}),
    // A row only survives mapping when it has a translation for the locale,
    // so the database must apply the same rule — otherwise a DB-level limit
    // could return fewer visible cards than requested.
    translations: { some: { locale } },
  };
}

/**
 * Stable order for paginated reads: `order` is admin-set and not unique,
 * so `id` breaks ties and a card never jumps pages or appears twice.
 */
const ARTWORK_ORDER = [{ order: "asc" }, { createdAt: "desc" }, { id: "asc" }] as const;

async function fetchArtworkRows(
  locale: Locale,
  filters: { collection?: string; category?: string; featuredOnly?: boolean },
  page: { skip?: number; take?: number } = {},
) {
  return prisma.artwork.findMany({
    where: artworkWhere(locale, filters),
    include: {
      imageMedia: true,
      translations: { where: { locale } },
      category: { include: { translations: { where: { locale } } } },
      collection: { include: { translations: { where: { locale } } } },
    },
    orderBy: [...ARTWORK_ORDER],
    ...(page.skip ? { skip: page.skip } : {}),
    ...(page.take ? { take: page.take } : {}),
  });
}

function mapArtwork(row: ArtworkRow, locale: Locale): ArtworkCardData | null {
  const { row: translation } = pickTranslation(row.translations, locale);
  if (!translation) return null;
  const categoryTranslation = row.category?.translations[0];
  const collectionTranslation = row.collection?.translations[0];

  return {
    id: row.id,
    slug: row.slug,
    title: translation.title,
    description: translation.description,
    image: toCardMediaView(row.imageMedia),
    medium: row.medium ?? "",
    createdDate: row.createdDate,
    categoryName: categoryTranslation?.name ?? "",
    categorySlug: row.category?.slug ?? null,
    collectionName: collectionTranslation?.name ?? "",
    collectionSlug: row.collection?.slug ?? null,
    featured: row.featured,
    order: row.order,
  };
}

export type ArtworkFilters = {
  collection?: string;
  category?: string;
  /** Maximum cards to return; applied at the database, not after fetching. */
  limit?: number;
  /** Cards to skip (page-1 × limit); only meaningful together with `limit`. */
  offset?: number;
  featuredOnly?: boolean;
};

/**
 * Public artwork cards, paginated at the database: the homepage asks for 6
 * and the gallery asks for one batch at a time instead of all 117 rows.
 */
export async function listArtworks(
  locale: Locale,
  filters: ArtworkFilters = {},
): Promise<ArtworkCardData[]> {
  const rows = await fetchArtworkRows(
    locale,
    filters,
    { skip: filters.offset, take: filters.limit },
  );

  return rows
    .map((row) => mapArtwork(row, locale))
    .filter((row): row is ArtworkCardData => Boolean(row));
}

/** Total visible cards for the same filters — the gallery's "has more" and counts. */
export async function countArtworks(
  locale: Locale,
  filters: { collection?: string; category?: string; featuredOnly?: boolean } = {},
): Promise<number> {
  return prisma.artwork.count({ where: artworkWhere(locale, filters) });
}

/** Light slug + title list for the art page's JSON-LD ItemList (no media). */
export async function listArtworkSlugs(
  locale: Locale,
  filters: { collection?: string } = {},
): Promise<{ slug: string; title: string }[]> {
  const rows = await prisma.artwork.findMany({
    where: artworkWhere(locale, filters),
    select: { slug: true, translations: { where: { locale }, select: { title: true } } },
    orderBy: [...ARTWORK_ORDER],
  });
  return rows
    .map((row) => ({ slug: row.slug, title: row.translations[0]?.title ?? "" }))
    .filter((row) => row.title !== "");
}

export type CollectionData = {
  id: string;
  slug: string;
  name: string;
  description: string;
  cover: MediaView | null;
  count: number;
};

export async function listCollections(locale: Locale): Promise<CollectionData[]> {
  const rows = await prisma.artworkCollection.findMany({
    where: { visibility: "public", deletedAt: null },
    include: {
      coverMedia: true,
      translations: { where: { locale } },
      artworks: { where: { visibility: "public", deletedAt: null }, select: { id: true } },
    },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  return rows
    .map((row) => {
      const translation = row.translations[0];
      if (!translation) return null;
      return {
        id: row.id,
        slug: row.slug,
        name: translation.name,
        description: translation.description,
        cover: toMediaView(row.coverMedia),
        count: row.artworks.length,
      };
    })
    .filter((row): row is CollectionData => Boolean(row));
}

export async function getCollection(
  slug: string,
  locale: Locale,
  page: { limit?: number; offset?: number } = {},
): Promise<{ collection: CollectionData | null; artworks: ArtworkCardData[]; total: number }> {
  const row = await prisma.artworkCollection.findUnique({
    where: { slug },
    include: {
      coverMedia: true,
      translations: { where: { locale } },
      artworks: { where: { visibility: "public", deletedAt: null }, select: { id: true } },
    },
  });

  if (!row || row.deletedAt || row.visibility !== "public") return { collection: null, artworks: [], total: 0 };
  const translation = row.translations[0];
  if (!translation) return { collection: null, artworks: [], total: 0 };

  const [artworks, total] = await Promise.all([
    listArtworks(locale, { collection: slug, limit: page.limit, offset: page.offset }),
    countArtworks(locale, { collection: slug }),
  ]);

  return {
    collection: {
      id: row.id,
      slug: row.slug,
      name: translation.name,
      description: translation.description,
      cover: toMediaView(row.coverMedia),
      count: row.artworks.length,
    },
    artworks,
    total,
  };
}

export async function getArtworkDetail(
  slug: string,
  locale: Locale,
): Promise<{ status: PublicStatus; artwork: ArtworkDetailData | null }> {
  const artwork = await prisma.artwork.findUnique({
    where: { slug },
    include: {
      imageMedia: true,
      translations: true,
      category: { include: { translations: { where: { locale } } } },
      collection: { include: { translations: { where: { locale } } } },
      tags: { include: { tag: true } },
    },
  });

  if (!artwork || artwork.deletedAt || artwork.visibility !== "public") {
    return { status: "not_found", artwork: null };
  }

  const { row } = pickTranslation(artwork.translations, locale);
  if (!row) return { status: "not_translated", artwork: null };

  return {
    status: "ok",
    artwork: {
      id: artwork.id,
      slug: artwork.slug,
      title: row.title,
      description: row.description,
      image: toCardMediaView(artwork.imageMedia),
      medium: artwork.medium ?? "",
      createdDate: artwork.createdDate,
      categoryName: artwork.category?.translations[0]?.name ?? "",
      categorySlug: artwork.category?.slug ?? null,
      collectionName: artwork.collection?.translations[0]?.name ?? "",
      collectionSlug: artwork.collection?.slug ?? null,
      featured: artwork.featured,
      order: artwork.order,
      tags: artwork.tags.map((item) => ({ name: item.tag.name, slug: item.tag.slug })),
      viewCount: artwork.viewCount,
      updatedAt: artwork.updatedAt,
    },
  };
}

/** Locales with a translation of a public collection (hreflang/sitemap). */
export async function getCollectionLocales(slug: string): Promise<Locale[]> {
  const row = await prisma.artworkCollection.findUnique({
    where: { slug },
    select: { visibility: true, deletedAt: true, translations: { select: { locale: true } } },
  });
  if (!row || row.deletedAt || row.visibility !== "public") return [];
  return row.translations
    .map((item) => item.locale)
    .filter((locale): locale is Locale => locale === "vi" || locale === "en");
}

export async function incrementArtworkView(id: string): Promise<void> {
  // Keep updatedAt tied to content edits, not gallery traffic.
  await prisma.$executeRaw`UPDATE "Artwork" SET "viewCount" = "viewCount" + 1 WHERE "id" = ${id}`.catch(() => undefined);
}

export async function getArtworkCategories(locale: Locale) {
  const rows = await prisma.category.findMany({
    where: { kind: "artwork" },
    include: { translations: { where: { locale } } },
    orderBy: { order: "asc" },
  });
  return rows
    .map((row) => ({ slug: row.slug, name: row.translations[0]?.name ?? "" }))
    .filter((row) => row.name);
}

export async function listArtworkCategoriesForAdmin() {
  const rows = await prisma.category.findMany({
    where: { kind: "artwork" },
    include: { translations: true },
    orderBy: { order: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.translations.find((item) => item.locale === "vi")?.name ?? row.slug,
  }));
}

export async function getCollectionForAdmin(id: string) {
  return prisma.artworkCollection.findFirst({
    where: { id, deletedAt: null },
    include: { coverMedia: true, translations: true },
  });
}

export async function listArtworksForAdmin() {
  return prisma.artwork.findMany({
    where: { deletedAt: null },
    include: {
      imageMedia: true,
      translations: true,
      collection: { include: { translations: true } },
    },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  });
}

export async function getArtworkForAdmin(id: string) {
  return prisma.artwork.findFirst({
    where: { id, deletedAt: null },
    include: {
      imageMedia: true,
      translations: true,
      tags: { include: { tag: true } },
      collection: true,
    },
  });
}

export async function listCollectionsForAdmin() {
  return prisma.artworkCollection.findMany({
    where: { deletedAt: null },
    include: {
      coverMedia: true,
      translations: true,
      _count: { select: { artworks: { where: { deletedAt: null } } } },
    },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
}

/** Locales with a published translation of this artwork (hreflang/sitemap). */
export async function getArtworkLocales(slug: string): Promise<Locale[]> {
  const row = await prisma.artwork.findUnique({
    where: { slug },
    select: {
      visibility: true,
      deletedAt: true,
      translations: { select: { locale: true } },
    },
  });
  if (!row || row.deletedAt || row.visibility !== "public") return [];
  return row.translations
    .map((item) => item.locale)
    .filter((locale): locale is Locale => locale === "vi" || locale === "en");
}
