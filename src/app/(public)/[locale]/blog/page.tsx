import Link from "next/link";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n";
import { isLocale, localeHref, type Locale } from "@/i18n/config";
import { getFeaturedArticle, listArticles } from "@/data/articles";
import { getSettings } from "@/data/settings";
import { getSocialLinks } from "@/data/social";
import { buildPageMetadata, listCanonicalQuery, paginationLinks, xHandleFromSocials } from "@/lib/seo";
import { absoluteUrl } from "@/lib/utils";
import { serializeJsonLd } from "@/lib/json-ld";
import { buildBlogSchema, buildBreadcrumbSchema, buildItemListSchema } from "@/lib/structured-data";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { PageHero } from "@/components/site/page-hero";
import { ArticleCard } from "@/components/site/article-card";
import { Pagination } from "@/components/site/pagination";
import { Reveal } from "@/components/ui/reveal";

// The GitHub Pages demo build rewrites this to "force-static"
// (see .github/workflows/pages.yml); the full-stack build keeps it dynamic.
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const dict = getDictionary(raw);
  const settings = await getSettings();
  // Static export (GitHub Pages demo): only the default view is prerendered,
  // so metadata must not depend on the request's search params — awaiting
  // them here opts the route out of static generation and the page silently
  // disappears from the export (no build error). Server mode keeps the
  // per-view metadata (filtered titles, canonicals, noindex on search).
  const query: { [key: string]: string | string[] | undefined } =
    process.env.PAGES_EXPORT === "1" ? {} : await searchParams;
  const q = one(query.q)?.trim() ?? "";
  const category = one(query.category) ?? "";
  const tag = one(query.tag) ?? "";
  const page = Number.parseInt(one(query.page) ?? "1", 10) || 1;
  const xHandle = xHandleFromSocials(await getSocialLinks());

  // Filtered/paginated views get distinct titles and a self-canonical that
  // carries the view's parameters. Search views are noindex,follow: the query
  // space is unbounded and the results themselves are the indexable content.
  const filterLabel = [q ? `"${q}"` : "", category, tag].filter(Boolean).join(" · ");
  const title = [dict.blog.title, filterLabel || undefined, page > 1 ? `${dict.common.page} ${page}` : undefined]
    .filter(Boolean)
    .join(" — ");

  return buildPageMetadata({
    locale: raw,
    path: "/blog",
    title,
    description: dict.blog.description,
    siteName: settings.siteName,
    canonicalQuery: listCanonicalQuery({ q: q || undefined, category: category || undefined, tag: tag || undefined, page: page > 1 ? String(page) : undefined }),
    ...(q ? { robots: { index: false, follow: true } } : {}),
    twitterSite: xHandle,
    twitterCreator: xHandle,
    faviconUrl: settings.favicon?.url,
  });
}

export default async function BlogPage({
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
  const category = one(query.category) ?? "";
  const tag = one(query.tag) ?? "";
  const page = Number.parseInt(one(query.page) ?? "1", 10) || 1;

  const data = await listArticles(locale, { q, category, tag, page, perPage: 9 });
  const featured = page === 1 && !q && !category && !tag ? await getFeaturedArticle(locale) : null;
  const items = featured ? data.items.filter((item) => item.id !== featured.id) : data.items;

  const blogHref = localeHref(locale, "/blog");
  const isFiltered = Boolean(q || category || tag);
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const crumbs = [
    { name: dict.nav.home, href: localeHref(locale, "/") },
    { name: dict.blog.label, href: blogHref },
  ];
  // React 19 hoists <link> rendered in the tree into <head>.
  const pageLinks = paginationLinks({
    locale,
    path: "/blog",
    params: { q: q || undefined, category: category || undefined, tag: tag || undefined },
    page: data.page,
    pages: data.pages,
  });
  const listedArticles = [...(featured ? [featured] : []), ...items];
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      buildBreadcrumbSchema(crumbs),
      buildBlogSchema({ blogUrl: blogHref, name: dict.blog.title, description: dict.blog.description }),
      buildItemListSchema({
        id: `${absoluteUrl(blogHref)}#articles`,
        items: listedArticles.map((article) => ({ name: article.title, url: `${blogHref}/${article.slug}` })),
      }),
    ],
  };

  const categoryHref = (slug: string) => {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (tag) search.set("tag", tag);
    if (slug) search.set("category", slug);
    const queryString = search.toString();
    return `${blogHref}${queryString ? `?${queryString}` : ""}`;
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
        label={dict.blog.label}
        title={dict.blog.title}
        description={dict.blog.description}
        meta={[{ label: dict.blog.count, value: String(data.total).padStart(2, "0") }]}
      />

      {data.categories.length > 0 && (
        <section className="container-page pb-8">
          <div className="flex flex-wrap items-center gap-2 border-y border-line py-4">
            <Link href={blogHref} className={`chip transition-colors ${!category ? "chip-active" : ""}`}>
              {dict.blog.allCategories}
            </Link>
            {data.categories.map((item) => (
              <Link
                key={item.slug}
                href={categoryHref(item.slug)}
                className={`chip transition-colors ${category === item.slug ? "chip-active" : ""}`}
              >
                {item.name}
                <span className="tabular-nums opacity-60">{item.count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="container-page pb-24">
        <form method="get" className="flex flex-col gap-3 pb-8 sm:flex-row sm:items-center">
          <label className="relative w-full sm:max-w-md">
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
              placeholder={dict.blog.searchPlaceholder}
              className="field pl-9"
            />
          </label>

          {data.tags.length > 0 && (
            <label className="sm:w-52">
              <span className="sr-only">{dict.common.tags}</span>
              <select name="tag" defaultValue={tag} className="field">
                <option value="">{dict.blog.allTags}</option>
                {data.tags.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.name} ({item.count})
                  </option>
                ))}
              </select>
            </label>
          )}

          {category && <input type="hidden" name="category" value={category} />}
          <button type="submit" className="btn btn-primary btn-sm h-[42px]">
            {dict.common.search}
          </button>
          {isFiltered && (
            <Link href={blogHref} className="text-[11px] text-muted underline underline-offset-4 hover:text-ink">
              {dict.common.clearFilters}
            </Link>
          )}
        </form>

        {featured && (
          <div className="mb-14 grid gap-8 border-y border-line py-10 lg:grid-cols-12 lg:items-center">
            <Reveal className="lg:col-span-7">
              <ArticleCard
                article={featured}
                href={`${blogHref}/${featured.slug}`}
                locale={locale}
                dict={dict}
                variant="feature"
                priority
              />
            </Reveal>
            <Reveal delay={100} className="lg:col-span-5 lg:pl-6">
              <p className="label">{dict.blog.featured}</p>
              <p className="mt-4 text-[clamp(1.5rem,2.6vw,2.1rem)] leading-tight tracking-tight">
                <Link href={`${blogHref}/${featured.slug}`} className="underline-sweep">
                  {featured.title}
                </Link>
              </p>
              <p className="mt-4 text-[14px] leading-relaxed text-muted">{featured.excerpt}</p>
              <div className="mt-6 flex flex-wrap items-center gap-2">
                {featured.tags.slice(0, 4).map((item) => (
                  <span key={item.slug} className="chip">
                    {item.name}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>
        )}

        {items.length > 0 ? (
          <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((article, index) => (
              <Reveal key={article.id} delay={(index % 3) * 70}>
                <ArticleCard
                  article={article}
                  href={`${blogHref}/${article.slug}`}
                  locale={locale}
                  dict={dict}
                  priority={index === 0 && !featured}
                />
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-line px-6 py-20 text-center">
            <p className="text-lg tracking-tight">{isFiltered ? dict.common.noResults : dict.blog.emptyTitle}</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              {isFiltered ? dict.common.clearFilters : dict.blog.emptyText}
            </p>
            {isFiltered && (
              <Link href={blogHref} className="btn btn-outline mt-6">
                {dict.common.clearFilters}
              </Link>
            )}
          </div>
        )}

        <Pagination
          page={data.page}
          pages={data.pages}
          basePath={blogHref}
          params={{ q, category, tag }}
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
