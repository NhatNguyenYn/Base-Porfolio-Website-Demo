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
  // Phase 9D #5: paginate in the database (take/skip + count) instead of
  // loading every public row and filtering/paginating in memory. The
  // category/status/tech filters and the "has a translation in this locale"
  // condition are all pushed into the Prisma where clause, so untranslated
  // rows never inflate `total` or steal a slot on the page (previously they
  // were mapped to null and dropped after loading).
  const baseWhere = {
    visibility: "public",
    deletedAt: null,
    publishedAt: { not: null },
    translations: { some: { locale } },
  } as const;
  const where = {
    ...baseWhere,
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.tech ? { technologies: { some: { name: filters.tech } } } : {}),
  };

  // Facets cover all public projects (as before — they were computed before
  // the filters were applied), via DB aggregation instead of loaded rows.
  const [technologyRows, categoryGroups] = await Promise.all([
    prisma.projectTechnology.findMany({
      where: { project: baseWhere },
      select: { name: true },
      distinct: ["name"],
    }),
    prisma.project.groupBy({
      by: ["category"],
      where: baseWhere,
      _count: { _all: true },
    }),
  ]);
  const technologies = technologyRows.map((row) => row.name).sort((a, b) => a.localeCompare(b));
  const categories = categoryGroups
    .filter((group): group is typeof group & { category: string } => group.category !== null)
    .map((group) => ({ slug: group.category, count: group._count._all }))
    .sort((a, b) => a.slug.localeCompare(b.slug));

  const perPage = filters.perPage ?? 12;
  const page = Math.max(1, filters.page ?? 1);

  // Two filters cannot be expressed in the database and stay in memory:
  // - `q`: diacritic-folded search ("thiet ke" must match "thiết kế").
  //   Postgres has no `unaccent` extension installed here, and a plain
  //   `contains, mode: "insensitive"` would silently drop those matches.
  // - `sort: "title"`: a locale-aware sort on the translated name; Prisma
  //   rejects orderBy on the to-many `translations` relation (verified).
  // For those cases only the *sort keys* are loaded (id + translated
  // name/shortDescription + technology names — no media, no full text),
  // filtered/sorted in memory, and the page itself is then fetched by id
  // with a normal paginated query. Every other case is pure take/skip.
  const needsKeyQuery = Boolean(filters.q?.trim()) || filters.sort === "title";
  if (needsKeyQuery) {
    const keys = await prisma.project.findMany({
      where,
      select: {
        id: true,
        completionDate: true,
        startDate: true,
        translations: { where: { locale }, select: { name: true, shortDescription: true } },
        technologies: { select: { name: true } },
      },
    });
    let keyed = keys
      .map((row) => {
        const translation = row.translations[0];
        if (!translation) return null;
        return {
          id: row.id,
          name: translation.name,
          shortDescription: translation.shortDescription,
          technologies: row.technologies.map((tech) => tech.name),
          year: (row.completionDate ?? row.startDate)?.getFullYear() ?? 0,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    if (filters.q?.trim()) {
      const needle = normalize(filters.q.trim());
      keyed = keyed.filter(
        (item) =>
          normalize(item.name).includes(needle) ||
          normalize(item.shortDescription).includes(needle) ||
          normalize(item.technologies.join(" ")).includes(needle),
      );
    }
    if (filters.sort === "title") {
      keyed = [...keyed].sort((a, b) => a.name.localeCompare(b.name, locale));
    } else if (filters.sort === "oldest") {
      keyed = [...keyed].sort((a, b) => a.year - b.year);
    }

    const total = keyed.length;
    const pages = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(page, pages);
    const pageIds = keyed.slice((safePage - 1) * perPage, safePage * perPage).map((item) => item.id);
    const rows = pageIds.length
      ? await prisma.project.findMany({
          where: { id: { in: pageIds } },
          include: projectInclude(locale),
        })
      : [];
    const byId = new Map(rows.map((row) => [row.id, row]));
    const items = pageIds
      .map((id) => byId.get(id))
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .map((row) => mapCard(row, locale))
      .filter((row): row is ProjectCardData => Boolean(row));
    return { items, total, technologies, categories, page: safePage, pages };
  }

  const orderBy =
    filters.sort === "oldest"
      ? // Year in the old in-memory sort was (completionDate ?? startDate).
        // completionDate ASC (nulls last in Postgres) then startDate ASC
        // reproduces that ordering for dated projects.
        [{ completionDate: "asc" as const }, { startDate: "asc" as const }, { createdAt: "desc" as const }]
      : [{ featured: "desc" as const }, { order: "asc" as const }, { createdAt: "desc" as const }];

  const total = await prisma.project.count({ where });
  const pages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, pages);
  const rows = await prisma.project.findMany({
    where,
    include: projectInclude(locale),
    orderBy,
    skip: (safePage - 1) * perPage,
    take: perPage,
  });
  const items = rows.map((row) => mapCard(row, locale)).filter((row): row is ProjectCardData => Boolean(row));

  return { items, total, technologies, categories, page: safePage, pages };
}

/**
 * Related projects for the detail page, mirroring getRelatedArticles:
 * same category first, then everything else, newest featured first, max 3.
 */
export async function getRelatedProjects(
  locale: Locale,
  excludeId: string,
  category: string | null,
  limit = 3,
): Promise<ProjectCardData[]> {
  const rows = await prisma.project.findMany({
    where: {
      visibility: "public",
      deletedAt: null,
      publishedAt: { not: null },
      id: { not: excludeId },
      translations: { some: { locale } },
    },
    include: projectInclude(locale),
    orderBy: [{ featured: "desc" }, { order: "asc" }, { createdAt: "desc" }],
    take: 12,
  });

  const items = rows.map((row) => mapCard(row, locale)).filter((row): row is ProjectCardData => Boolean(row));
  const sameCategory = items.filter((item) => item.category === category);
  const others = items.filter((item) => item.category !== category);
  return [...sameCategory, ...others].slice(0, limit);
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
