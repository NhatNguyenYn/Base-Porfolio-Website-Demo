import "server-only";
import type { Locale } from "@/i18n/config";
import { prisma } from "../db";
import { toMediaView } from "./media";
import { pickTranslation, type MediaView, type PublicStatus } from "./types";

export type ArtworkCardData = {
  id: string;
  slug: string;
  title: string;
  description: string;
  image: MediaView | null;
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
};

type ArtworkRow = Awaited<ReturnType<typeof fetchArtworkRows>>[number];

async function fetchArtworkRows(locale: Locale) {
  return prisma.artwork.findMany({
    where: { visibility: "public", deletedAt: null },
    include: {
      imageMedia: true,
      translations: { where: { locale } },
      category: { include: { translations: { where: { locale } } } },
      collection: { include: { translations: { where: { locale } } } },
      tags: { include: { tag: true } },
    },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
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
    image: toMediaView(row.imageMedia),
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

export type ArtworkFilters = { collection?: string; category?: string; limit?: number; featuredOnly?: boolean };

export async function listArtworks(
  locale: Locale,
  filters: ArtworkFilters = {},
): Promise<ArtworkCardData[]> {
  const rows = await fetchArtworkRows(locale);

  let items = rows
    .filter((row) => {
      if (filters.collection && row.collection?.slug !== filters.collection) return false;
      if (filters.category && row.category?.slug !== filters.category) return false;
      if (filters.featuredOnly && !row.featured) return false;
      return true;
    })
    .map((row) => mapArtwork(row, locale))
    .filter((row): row is ArtworkCardData => Boolean(row));

  if (filters.limit) items = items.slice(0, filters.limit);
  return items;
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
): Promise<{ collection: CollectionData | null; artworks: ArtworkCardData[] }> {
  const row = await prisma.artworkCollection.findUnique({
    where: { slug },
    include: {
      coverMedia: true,
      translations: { where: { locale } },
      artworks: { where: { visibility: "public", deletedAt: null }, select: { id: true } },
    },
  });

  if (!row || row.deletedAt || row.visibility !== "public") return { collection: null, artworks: [] };
  const translation = row.translations[0];
  if (!translation) return { collection: null, artworks: [] };

  return {
    collection: {
      id: row.id,
      slug: row.slug,
      name: translation.name,
      description: translation.description,
      cover: toMediaView(row.coverMedia),
      count: row.artworks.length,
    },
    artworks: await listArtworks(locale, { collection: slug }),
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
      image: toMediaView(artwork.imageMedia),
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
    },
  };
}

export async function incrementArtworkView(id: string): Promise<void> {
  await prisma.artwork.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => undefined);
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
