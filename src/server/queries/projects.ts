import "server-only";
import type { Locale } from "@/i18n/config";
import { prisma } from "../db";
import { toMediaView } from "./media";
import { pickTranslation, type MediaView, type PublicStatus } from "./types";

export type ProjectCardData = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  category: string | null;
  role: string;
  technologies: string[];
  thumbnail: MediaView | null;
  status: string;
  featured: boolean;
  year: number | null;
};

export type ProjectDetailData = ProjectCardData & {
  fullDescription: string;
  images: MediaView[];
  githubUrl: string | null;
  demoUrl: string | null;
  startDate: Date | null;
  completionDate: Date | null;
  publishedAt: Date | null;
  updatedAt: Date;
};

const projectInclude = (locale?: Locale) => ({
  thumbnailMedia: true,
  technologies: { orderBy: { order: "asc" as const } },
  translations: locale ? { where: { locale } } : true,
});

function mapCard(project: {
  id: string;
  slug: string;
  category: string | null;
  status: string;
  featured: boolean;
  completionDate: Date | null;
  startDate: Date | null;
  thumbnailMedia: { id: string; url: string; width: number | null; height: number | null; alt: string | null; title: string | null; filename: string } | null;
  technologies: { name: string }[];
  translations: { locale: string; name: string; shortDescription: string; role: string; fullDescription: string }[];
}, locale: Locale): ProjectCardData | null {
  const { row } = pickTranslation(project.translations, locale);
  if (!row) return null;
  return {
    id: project.id,
    slug: project.slug,
    name: row.name,
    shortDescription: row.shortDescription,
    category: project.category,
    role: row.role,
    technologies: project.technologies.map((tech) => tech.name),
    thumbnail: toMediaView(project.thumbnailMedia),
    status: project.status,
    featured: project.featured,
    year: (project.completionDate ?? project.startDate)?.getFullYear() ?? null,
  };
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();
}

export type ProjectFilters = {
  q?: string;
  tech?: string;
  category?: string;
  status?: string;
  sort?: "newest" | "oldest" | "title";
  page?: number;
  perPage?: number;
};

export async function listProjects(
  locale: Locale,
  filters: ProjectFilters = {},
): Promise<{
  items: ProjectCardData[];
  total: number;
  technologies: string[];
  categories: { slug: string; count: number }[];
  page: number;
  pages: number;
}> {
  const rows = await prisma.project.findMany({
    where: { visibility: "public", deletedAt: null, publishedAt: { not: null } },
    include: projectInclude(locale),
    orderBy: [{ featured: "desc" }, { order: "asc" }, { createdAt: "desc" }],
  });

  const all = rows
    .map((row) => mapCard(row, locale))
    .filter((row): row is ProjectCardData => Boolean(row));

  const technologies = Array.from(new Set(all.flatMap((item) => item.technologies))).sort((a, b) =>
    a.localeCompare(b),
  );

  const categoryCounts = new Map<string, number>();
  for (const item of all) {
    if (item.category) categoryCounts.set(item.category, (categoryCounts.get(item.category) ?? 0) + 1);
  }
  const categories = Array.from(categoryCounts.entries())
    .map(([slug, count]) => ({ slug, count }))
    .sort((a, b) => a.slug.localeCompare(b.slug));

  let items = all;
  if (filters.q?.trim()) {
    const needle = normalize(filters.q.trim());
    items = items.filter(
      (item) =>
        normalize(item.name).includes(needle) ||
        normalize(item.shortDescription).includes(needle) ||
        normalize(item.technologies.join(" ")).includes(needle),
    );
  }
  if (filters.tech) {
    items = items.filter((item) => item.technologies.includes(filters.tech!));
  }
  if (filters.category) {
    items = items.filter((item) => item.category === filters.category);
  }
  if (filters.status) {
    items = items.filter((item) => item.status === filters.status);
  }
  if (filters.sort === "oldest") {
    items = [...items].sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
  } else if (filters.sort === "title") {
    items = [...items].sort((a, b) => a.name.localeCompare(b.name, locale));
  }

  const perPage = filters.perPage ?? 12;
  const page = Math.max(1, filters.page ?? 1);
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, pages);

  return {
    items: items.slice((safePage - 1) * perPage, safePage * perPage),
    total,
    technologies,
    categories,
    page: safePage,
    pages,
  };
}

export async function getFeaturedProjects(locale: Locale, limit = 4): Promise<ProjectCardData[]> {
  const rows = await prisma.project.findMany({
    where: { visibility: "public", deletedAt: null, publishedAt: { not: null }, featured: true },
    include: projectInclude(locale),
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    take: limit,
  });

  const items = rows.map((row) => mapCard(row, locale)).filter((row): row is ProjectCardData => Boolean(row));
  if (items.length >= limit) return items;

  const fill = await prisma.project.findMany({
    where: {
      visibility: "public",
      deletedAt: null,
      publishedAt: { not: null },
      id: { notIn: items.map((item) => item.id) },
    },
    include: projectInclude(locale),
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    take: limit - items.length,
  });

  return [...items, ...fill.map((row) => mapCard(row, locale)).filter((row): row is ProjectCardData => Boolean(row))];
}

export async function getProjectDetail(
  slug: string,
  locale: Locale,
): Promise<{ status: PublicStatus; project: ProjectDetailData | null }> {
  const project = await prisma.project.findUnique({
    where: { slug },
    include: {
      thumbnailMedia: true,
      technologies: { orderBy: { order: "asc" } },
      images: { orderBy: { order: "asc" }, include: { media: true } },
      translations: true,
    },
  });

  if (!project || project.deletedAt || project.visibility !== "public" || !project.publishedAt) {
    return { status: "not_found", project: null };
  }

  const { row } = pickTranslation(project.translations, locale);
  if (!row) return { status: "not_translated", project: null };

  return {
    status: "ok",
    project: {
      id: project.id,
      slug: project.slug,
      name: row.name,
      shortDescription: row.shortDescription,
      category: project.category,
      role: row.role,
      fullDescription: row.fullDescription,
      technologies: project.technologies.map((tech) => tech.name),
      thumbnail: toMediaView(project.thumbnailMedia),
      images: project.images.map((image) => toMediaView(image.media)).filter((item): item is MediaView => Boolean(item)),
      status: project.status,
      featured: project.featured,
      year: (project.completionDate ?? project.startDate)?.getFullYear() ?? null,
      githubUrl: project.githubUrl,
      demoUrl: project.demoUrl,
      startDate: project.startDate,
      completionDate: project.completionDate,
      publishedAt: project.publishedAt,
      updatedAt: project.updatedAt,
    },
  };
}

/** Next public project in display order, for the detail page footer. */
export async function getNextProject(slug: string, locale: Locale): Promise<ProjectCardData | null> {
  const rows = await prisma.project.findMany({
    where: { visibility: "public", deletedAt: null, publishedAt: { not: null } },
    include: projectInclude(locale),
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  });
  const items = rows.map((row) => mapCard(row, locale)).filter((row): row is ProjectCardData => Boolean(row));
  if (items.length < 2) return null;
  const index = items.findIndex((item) => item.slug === slug);
  if (index === -1) return items[0] ?? null;
  return items[(index + 1) % items.length] ?? null;
}

export async function getProjectCategoriesOfTechnologies(): Promise<string[]> {
  const rows = await prisma.projectTechnology.findMany({ select: { name: true }, distinct: ["name"] });
  return rows.map((row) => row.name).sort();
}

export async function publishDueProjects(): Promise<void> {
  await prisma.project.updateMany({
    where: { publishedAt: null, visibility: "public" },
    data: { publishedAt: new Date() },
  });
}

/** Admin list */
export async function listProjectsForAdmin() {
  return prisma.project.findMany({
    where: { deletedAt: null },
    include: {
      thumbnailMedia: true,
      translations: true,
      technologies: { orderBy: { order: "asc" } },
    },
    orderBy: [{ order: "asc" }, { updatedAt: "desc" }],
  });
}

export async function getProjectForAdmin(id: string) {
  return prisma.project.findFirst({
    where: { id, deletedAt: null },
    include: {
      thumbnailMedia: true,
      translations: true,
      technologies: { orderBy: { order: "asc" } },
      images: { orderBy: { order: "asc" }, include: { media: true } },
    },
  });
}

/** Locales with a published translation of this project (hreflang/sitemap). */
export async function getProjectLocales(slug: string): Promise<Locale[]> {
  const row = await prisma.project.findUnique({
    where: { slug },
    select: {
      visibility: true,
      deletedAt: true,
      publishedAt: true,
      translations: { select: { locale: true } },
    },
  });
  if (!row || row.deletedAt || row.visibility !== "public" || !row.publishedAt) return [];
  return row.translations
    .map((item) => item.locale)
    .filter((locale): locale is Locale => locale === "vi" || locale === "en");
}
