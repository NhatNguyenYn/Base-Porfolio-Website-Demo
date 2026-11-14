import Link from "next/link";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n";
import { isLocale, localeHref, type Locale } from "@/i18n/config";
import { listProjects } from "@/data/projects";
import { getSettings } from "@/data/settings";
import { getSocialLinks } from "@/data/social";
import { buildPageMetadata, listCanonicalQuery, paginationLinks, xHandleFromSocials } from "@/lib/seo";
import { absoluteUrl } from "@/lib/utils";
import { serializeJsonLd } from "@/lib/json-ld";
import { buildBreadcrumbSchema, buildCollectionPageSchema, buildItemListSchema } from "@/lib/structured-data";
import { prisma } from "@/server/db";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
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

// Static-export build (GitHub Pages demo): enumerate every project category
// slug so its page can prerender — without this, the category chips on the
// projects list would have nowhere to link on the static site (a
// `?category=slug` link only changes the URL; the prerendered list HTML
// stays unfiltered). Ignored by the dynamic build.
export async function generateStaticParams() {
  const groups = await prisma.project.groupBy({
    by: ["category"],
    where: { visibility: "public", deletedAt: null, publishedAt: { not: null }, category: { not: null } },
  });
  return groups
    .map((group) => group.category)
    .filter((value): value is string => typeof value === "string")
    .map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) return {};
  const dict = getDictionary(raw);
  const settings = await getSettings();
  // Static export (GitHub Pages demo): only the default view is prerendered,
  // so metadata must not depend on the request's search params — awaiting
  // them here opts the route out of static generation and the page silently
  // disappears from the export (no build error). Server mode keeps the
  // per-view metadata (paginated titles, canonicals).
  const query: { [key: string]: string | string[] | undefined } =
    process.env.PAGES_EXPORT === "1" ? {} : await searchParams;
  const page = Number.parseInt(one(query.page) ?? "1", 10) || 1;
  const categoryLabels = dict.projects.categories as Record<string, string>;
  const label = categoryLabels[slug];
  const xHandle = xHandleFromSocials(await getSocialLinks());

  if (!label) {
    return buildPageMetadata({
      locale: raw,
      path: `/projects/category/${slug}`,
      title: dict.projects.label,
      description: dict.projects.description,
      siteName: settings.siteName,
      noindex: true,
    });
  }

  const title = `${label} — ${dict.projects.label}`;
  return buildPageMetadata({
    locale: raw,
    path: `/projects/category/${slug}`,
    title: page > 1 ? `${title} — ${dict.common.page} ${page}` : title,
    description: dict.projects.description,
    siteName: settings.siteName,
    canonicalQuery: listCanonicalQuery({ page: page > 1 ? String(page) : undefined }),
    twitterSite: xHandle,
    twitterCreator: xHandle,
    faviconUrl: settings.favicon?.url,
  });
}

export default async function ProjectsCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: SearchParams;
}) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const query = await searchParams;
  const page = Number.parseInt(one(query.page) ?? "1", 10) || 1;

  const categoryLabels = dict.projects.categories as Record<string, string>;
  const label = categoryLabels[slug];
  if (!label) notFound();

  const { items, total, categories, pages, page: currentPage } = await listProjects(locale, {
    category: slug,
    page,
    perPage: 9,
  });
  // A known category slug with no public project in this locale has no
  // content to show — same 404 behaviour as the blog category page for an
  // unknown category.
  if (total === 0) notFound();

  const basePath = localeHref(locale, "/projects");
  const categoryHref = `${basePath}/category/${slug}`;
  const categoryLabel = (value: string) => categoryLabels[value] ?? value;
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const crumbs = [
    { name: dict.nav.home, href: localeHref(locale, "/") },
    { name: dict.projects.label, href: basePath },
    { name: label, href: categoryHref },
  ];
  // React 19 hoists <link> rendered in the tree into <head>.
  const pageLinks = paginationLinks({ locale, path: `/projects/category/${slug}`, params: {}, page: currentPage, pages });
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      buildBreadcrumbSchema(crumbs),
      buildCollectionPageSchema({ pageUrl: categoryHref, name: label, description: dict.projects.description }),
      buildItemListSchema({
        id: `${absoluteUrl(categoryHref)}#projects`,
        items: items.map((project) => ({ name: project.name, url: `${basePath}/${project.slug}` })),
      }),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      {pageLinks.prev && <link rel="prev" href={pageLinks.prev} />}
      {pageLinks.next && <link rel="next" href={pageLinks.next} />}
      <div className="container-page pt-8">
        <Breadcrumbs items={crumbs} label={dict.common.breadcrumb} />
      </div>
      <PageHero
        label={dict.projects.label}
        title={label}
        description={dict.projects.description}
        meta={[{ label: dict.projects.count, value: String(total).padStart(2, "0") }]}
      />

      {categories.length > 0 && (
        <section className="container-page pb-8">
          <div className="flex flex-wrap items-center gap-2 border-y border-line py-4">
            <Link href={basePath} className="chip transition-colors">
              {dict.projects.allCategories}
            </Link>
            {categories.map((item) => (
              <Link
                key={item.slug}
                href={`${basePath}/category/${item.slug}`}
                className={`chip transition-colors ${item.slug === slug ? "chip-active" : ""}`}
              >
                {categoryLabel(item.slug)}
                <span className="tabular-nums opacity-60">{item.count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="container-page pb-24">
        {items.length > 0 ? (
          <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
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
        ) : (
          <div className="border border-dashed border-line px-6 py-20 text-center">
            <p className="text-lg tracking-tight">{dict.projects.emptyTitle}</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">{dict.projects.emptyText}</p>
            <Link href={basePath} className="btn btn-outline mt-6">
              {dict.common.viewAll}
            </Link>
          </div>
        )}

        <Pagination
          page={currentPage}
          pages={pages}
          basePath={categoryHref}
          params={{}}
          labels={{
            previous: dict.common.previous,
            next: dict.common.next,
            page: dict.common.page,
            of: dict.common.of,
          }}
        />
      </section>
    </>
  );
}
