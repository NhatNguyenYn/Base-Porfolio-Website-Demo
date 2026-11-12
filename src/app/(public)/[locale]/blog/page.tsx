import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n";
import { isLocale, localeHref, type Locale } from "@/i18n/config";
import { getFeaturedArticle, listArticles } from "@/data/articles";
import { PageHero } from "@/components/site/page-hero";
import { ArticleCard } from "@/components/site/article-card";
import { Pagination } from "@/components/site/pagination";
import { Reveal } from "@/components/ui/reveal";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const dict = getDictionary(raw);
  return {
    title: dict.blog.label,
    description: dict.blog.description,
    alternates: {
      canonical: `/${raw}/blog`,
      languages: { vi: "/vi/blog", en: "/en/blog", "x-default": "/vi/blog" },
    },
  };
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
              <h2 className="mt-4 text-[clamp(1.5rem,2.6vw,2.1rem)] leading-tight tracking-tight">
                <Link href={`${blogHref}/${featured.slug}`} className="underline-sweep">
                  {featured.title}
                </Link>
              </h2>
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
                  priority={index < 3 && !featured}
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
