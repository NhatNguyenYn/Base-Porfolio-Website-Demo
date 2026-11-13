import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n";
import { isLocale, localeHref, type Locale } from "@/i18n/config";
import { listProjects } from "@/data/projects";
import { getSettings } from "@/data/settings";
import { buildPageMetadata } from "@/lib/seo";
import { PageHero } from "@/components/site/page-hero";
import { ProjectCard } from "@/components/site/project-card";
import { Pagination } from "@/components/site/pagination";
import { Reveal } from "@/components/ui/reveal";

// The GitHub Pages demo build rewrites this to "force-static"
// (see .github/workflows/pages.yml); the full-stack build keeps it dynamic.
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const dict = getDictionary(raw);
  const settings = await getSettings();
  return buildPageMetadata({
    locale: raw,
    path: "/projects",
    title: dict.projects.label,
    description: dict.projects.description,
    siteName: settings.siteName,
  });
}

export default async function ProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const query = await searchParams;

  const q = one(query.q)?.trim() ?? "";
  const tech = one(query.tech) ?? "";
  const category = one(query.category) ?? "";
  const sort = (one(query.sort) ?? "newest") as "newest" | "oldest" | "title";
  const page = Number.parseInt(one(query.page) ?? "1", 10) || 1;

  const {
    items,
    total,
    technologies,
    categories,
    pages,
    page: currentPage,
  } = await listProjects(locale, {
    q,
    tech,
    category,
    sort,
    page,
    perPage: 9,
  });

  const basePath = localeHref(locale, "/projects");
  const activeFilters = Boolean(q || tech || category || sort !== "newest");
  const categoryLabels = dict.projects.categories as Record<string, string>;
  const categoryLabel = (slug: string) => categoryLabels[slug] ?? slug;

  const categoryHref = (slug: string) => {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (tech) search.set("tech", tech);
    if (sort !== "newest") search.set("sort", sort);
    if (slug) search.set("category", slug);
    const queryString = search.toString();
    return `${basePath}${queryString ? `?${queryString}` : ""}`;
  };

  return (
    <>
      <PageHero
        label={dict.projects.label}
        title={dict.projects.title}
        description={dict.projects.description}
        meta={[{ label: dict.projects.count, value: String(total).padStart(2, "0") }]}
      />

      <section className="container-page pb-24">
        {categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-line py-4">
            <Link href={categoryHref("")} className={`chip transition-colors ${!category ? "chip-active" : ""}`}>
              {dict.projects.allCategories}
            </Link>
            {categories.map((item) => (
              <Link
                key={item.slug}
                href={categoryHref(item.slug)}
                className={`chip transition-colors ${category === item.slug ? "chip-active" : ""}`}
              >
                {categoryLabel(item.slug)}
                <span className="tabular-nums opacity-60">{item.count}</span>
              </Link>
            ))}
          </div>
        )}

        <form method="get" className="flex flex-col gap-4 border-b border-line py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:max-w-2xl">
            <label className="relative w-full">
              <span className="sr-only">{dict.common.search}</span>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m16.5 16.5 4 4" />
              </svg>
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder={dict.projects.searchPlaceholder}
                className="field pl-9"
              />
            </label>

            <label className="sm:w-52">
              <span className="sr-only">{dict.common.technologies}</span>
              <select name="tech" defaultValue={tech} className="field">
                <option value="">{dict.projects.allTechnologies}</option>
                {technologies.map((technology) => (
                  <option key={technology} value={technology}>
                    {technology}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center gap-3">
            <label>
              <span className="sr-only">{dict.common.filter}</span>
              <select name="sort" defaultValue={sort} className="field w-40">
                <option value="newest">{dict.projects.sortNewest}</option>
                <option value="oldest">{dict.projects.sortOldest}</option>
                <option value="title">{dict.projects.sortTitle}</option>
              </select>
            </label>
            <button type="submit" className="btn btn-primary btn-sm h-[42px]">
              {dict.common.search}
            </button>
            {activeFilters && (
              <Link href={basePath} className="text-[11px] text-muted underline underline-offset-4 hover:text-ink">
                {dict.common.clearFilters}
              </Link>
            )}
          </div>
        </form>

        {items.length > 0 ? (
          <>
            <div className="mt-12 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((project, index) => (
                <Reveal key={project.id} delay={(index % 3) * 70}>
                  <ProjectCard
                    project={project}
                    href={`${basePath}/${project.slug}`}
                    dict={dict}
                    index={index}
                    priority={index === 0}
                  />
                </Reveal>
              ))}
            </div>
            <Pagination
              page={currentPage}
              pages={pages}
              basePath={basePath}
              params={{ q, tech, category, sort }}
              labels={{
                previous: dict.common.previous,
                next: dict.common.next,
                page: dict.common.page,
                of: dict.common.of,
              }}
            />
          </>
        ) : (
          <div className="mt-16 border border-dashed border-line px-6 py-16 text-center">
            <p className="text-lg tracking-tight">{q || tech ? dict.common.noResults : dict.projects.emptyTitle}</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              {q || tech ? dict.common.clearFilters : dict.projects.emptyText}
            </p>
            {activeFilters && (
              <Link href={basePath} className="btn btn-outline mt-6">
                {dict.common.clearFilters}
              </Link>
            )}
          </div>
        )}
      </section>
    </>
  );
}
