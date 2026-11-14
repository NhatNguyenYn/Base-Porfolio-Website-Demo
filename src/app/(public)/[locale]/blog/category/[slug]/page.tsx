import Link from "next/link";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n";
import { isLocale, localeHref, type Locale } from "@/i18n/config";
import { listArticles, listCategories } from "@/data/articles";
import { getSettings } from "@/data/settings";
import { getSocialLinks } from "@/data/social";
import { buildPageMetadata, listCanonicalQuery, paginationLinks, xHandleFromSocials } from "@/lib/seo";
import { absoluteUrl } from "@/lib/utils";
import { serializeJsonLd } from "@/lib/json-ld";
import { buildBreadcrumbSchema, buildCollectionPageSchema, buildItemListSchema } from "@/lib/structured-data";
import { prisma } from "@/server/db";
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

// Static-export build (GitHub Pages demo): enumerate every article category
// slug so its page can prerender. Ignored by the dynamic build.
export async function generateStaticParams() {
  const rows = await prisma.category.findMany({
    where: { kind: "article" },
    select: { slug: true },
  });
  return rows.map((row) => ({ slug: row.slug }));
}

async function getCategory(locale: Locale, slug: string) {
  const categories = await listCategories(locale);
  return categories.find((item) => item.slug === slug) ?? null;
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
  const category = await getCategory(raw, slug);
  const xHandle = xHandleFromSocials(await getSocialLinks());

  if (!category) {
    return buildPageMetadata({
      locale: raw,
      path: `/blog/category/${slug}`,
      title: dict.blog.label,
      description: dict.blog.description,
      siteName: settings.siteName,
      noindex: true,
    });
  }

  const title = `${category.name} — ${dict.blog.label}`;
  const description = category.description || dict.blog.description;
  return buildPageMetadata({
    locale: raw,
    path: `/blog/category/${slug}`,
    title: page > 1 ? `${title} — ${dict.common.page} ${page}` : title,
    description,
    siteName: settings.siteName,
    canonicalQuery: listCanonicalQuery({ page: page > 1 ? String(page) : undefined }),
    twitterSite: xHandle,
    twitterCreator: xHandle,
    faviconUrl: settings.favicon?.url,
  });
}

export default async function BlogCategoryPage({
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

  const category = await getCategory(locale, slug);
  if (!category) notFound();

  const data = await listArticles(locale, { category: slug, page, perPage: 9 });

  const blogHref = localeHref(locale, "/blog");
  const categoryHref = `${blogHref}/category/${slug}`;
  const description = category.description || dict.blog.description;
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const crumbs = [
    { name: dict.nav.home, href: localeHref(locale, "/") },
    { name: dict.blog.label, href: blogHref },
    { name: category.name, href: categoryHref },
  ];
  // React 19 hoists <link> rendered in the tree into <head>.
  const pageLinks = paginationLinks({ locale, path: `/blog/category/${slug}`, params: {}, page: data.page, pages: data.pages });
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      buildBreadcrumbSchema(crumbs),
      buildCollectionPageSchema({ pageUrl: categoryHref, name: category.name, description }),
      buildItemListSchema({
        id: `${absoluteUrl(categoryHref)}#articles`,
        items: data.items.map((article) => ({ name: article.title, url: `${blogHref}/${article.slug}` })),
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
        label={dict.blog.label}
        title={category.name}
        description={description}
        meta={[{ label: dict.blog.count, value: String(data.total).padStart(2, "0") }]}
      />

      <section className="container-page pb-24">
        {data.items.length > 0 ? (
          <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((article, index) => (
              <Reveal key={article.id} delay={(index % 3) * 70}>
                <ArticleCard
                  article={article}
                  href={`${blogHref}/${article.slug}`}
                  locale={locale}
                  dict={dict}
                  priority={index === 0}
                />
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-line px-6 py-20 text-center">
            <p className="text-lg tracking-tight">{dict.blog.emptyTitle}</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">{dict.blog.emptyText}</p>
            <Link href={blogHref} className="btn btn-outline mt-6">
              {dict.common.viewAll}
            </Link>
          </div>
        )}

        <Pagination
          page={data.page}
          pages={data.pages}
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
