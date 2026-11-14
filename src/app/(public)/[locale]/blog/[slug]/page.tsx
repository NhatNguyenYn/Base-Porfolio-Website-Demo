import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n";
import { alternateLocale, isLocale, localeHref, type Locale } from "@/i18n/config";
import { getArticleDetail, getRelatedArticles, incrementArticleView } from "@/data/articles";
import { getSettings } from "@/data/settings";
import { getSocialLinks } from "@/data/social";
import { getArticleLocales } from "@/server/queries/articles";
import { prisma } from "@/server/db";
import { renderMarkdown } from "@/lib/markdown";
import { buildPageMetadata, canonicalUrl, safeSocialImage, socialImage, xHandleFromSocials } from "@/lib/seo";
import { assetUrl } from "@/lib/asset";
import { absoluteUrl, formatDate } from "@/lib/utils";
import { serializeJsonLd } from "@/lib/json-ld";
import { buildArticleSchema, buildBreadcrumbSchema } from "@/lib/structured-data";
import { UntranslatedNotice } from "@/components/site/untranslated-notice";
import { ArticleCard } from "@/components/site/article-card";
import { ShareBar } from "@/components/site/share-bar";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { Reveal } from "@/components/ui/reveal";
import { EditorialArticle } from "@/components/blog/editorial-article";

// The GitHub Pages demo build rewrites this to "force-static"
// (see .github/workflows/pages.yml); the full-stack build keeps it dynamic.
export const dynamic = "force-dynamic";

// Static-export build (GitHub Pages demo): enumerate every published article slug
// so its page can prerender. Ignored by the dynamic build.
export async function generateStaticParams() {
  const rows = await prisma.article.findMany({
    where: { status: "published", visibility: "public", publishedAt: { not: null }, deletedAt: null },
    select: { slug: true },
  });
  return rows.map((row) => ({ slug: row.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) return {};
  const settings = await getSettings();
  const { article } = await getArticleDetail(slug, raw);
  // No translation in this locale (or not published): keep it out of the index.
  if (!article) {
    return buildPageMetadata({
      locale: raw,
      path: `/blog/${slug}`,
      title: raw === "vi" ? "Bài viết chưa có bản dịch" : "Article not available in English",
      description: raw === "vi" ? "Bài viết này chưa có bản dịch." : "This article is not available in this language.",
      siteName: settings.siteName,
      noindex: true,
    });
  }

  const title = article.seoTitle || article.title;
  const description = article.seoDescription || article.excerpt;
  const available = await getArticleLocales(slug);
  const xHandle = xHandleFromSocials(await getSocialLinks());

  return buildPageMetadata({
    locale: raw,
    path: `/blog/${slug}`,
    title,
    description,
    siteName: settings.siteName,
    availableLocales: available,
    type: "article",
    image: article.cover
      ? socialImage(article.cover.url, article.cover.alt || title, article.cover.width, article.cover.height)
      : null,
    publishedTime: article.publishedAt?.toISOString(),
    modifiedTime: article.updatedAt.toISOString(),
    authors: [article.authorName],
    twitterSite: xHandle,
    twitterCreator: xHandle,
    faviconUrl: settings.favicon?.url,
  });
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const settings = await getSettings();

  const { status, article } = await getArticleDetail(slug, locale);

  if (status === "not_found") notFound();

  if (status === "not_translated" || !article) {
    return (
      <UntranslatedNotice
        currentLocale={locale}
        alternate={alternateLocale(locale)}
        alternateHref={localeHref(alternateLocale(locale), `/blog/${slug}`)}
        title={dict.blog.notTranslatedTitle}
        text={dict.blog.notTranslatedText}
        switchLabel={dict.langNotice.switch}
      />
    );
  }

  await incrementArticleView(article.id);

  const [body, related] = await Promise.all([
    renderMarkdown(article.content, { editorial: article.template === "editorial" }),
    getRelatedArticles(locale, article.id, article.categorySlug, 3),
  ]);

  const blogHref = localeHref(locale, "/blog");
  // Static export (GitHub Pages demo): a prerendered page cannot re-render
  // for a query string — `?category=slug` only changes the URL while the
  // served HTML stays the unfiltered list. So in export mode the category
  // chip links to the prerendered /blog/category/<slug>/ page instead (same
  // pattern as the list-page chips in blog/page.tsx). Server mode keeps the
  // query-param filter so it can combine with the q/tag search.
  const categoryHref = (slug: string) =>
    process.env.PAGES_EXPORT === "1" ? `${blogHref}/category/${slug}` : `${blogHref}?category=${slug}`;
  const aboutHref = localeHref(locale, "/about");
  const homeHref = localeHref(locale, "/");
  const schemaCanonicalUrl = absoluteUrl(`/${locale}/blog/${article.slug}`);
  const shareCanonicalUrl = canonicalUrl(locale, `/blog/${article.slug}`);
  const schemaImage = article.cover
    ? safeSocialImage(
        socialImage(article.cover.url, article.cover.alt || article.title, article.cover.width, article.cover.height),
        settings.siteName,
      )
    : null;
  const crumbs = [
    { name: dict.nav.home, href: homeHref },
    { name: dict.blog.label, href: blogHref },
    { name: article.title, href: `${blogHref}/${article.slug}` },
  ];
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      buildBreadcrumbSchema(crumbs),
      buildArticleSchema({
        locale,
        siteName: settings.siteName,
        // Publisher logo falls back to the bundled 512×512 icon when unset.
        siteLogoUrl: settings.logo?.url ?? "/icon.png",
        canonicalUrl: schemaCanonicalUrl,
        headline: article.title,
        description: article.seoDescription || article.excerpt,
        imageUrl: schemaImage?.url,
        datePublished: article.publishedAt?.toISOString(),
        dateModified: article.updatedAt.toISOString(),
        authorName: article.authorName,
        authorAboutUrl: `/${locale}/about`,
        categoryName: article.categoryName,
        keywords: article.tags.map((tag) => tag.name),
        wordCount: article.content.split(/\s+/).filter(Boolean).length,
        blogUrl: blogHref,
      }),
    ],
  };

  return (
    <article>
      <script
        type="application/ld+json"
        nonce={nonce}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      <div className="container-page pt-8">
        <Breadcrumbs items={crumbs} label={dict.common.breadcrumb} />
      </div>

      {article.template === "editorial" ? (
        <EditorialArticle
          article={article}
          body={body}
          related={related}
          dict={dict}
          locale={locale}
          blogHref={blogHref}
          canonicalUrl={shareCanonicalUrl}
        />
      ) : (
      <>
      <header className="container-page mt-10 max-w-4xl">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.16em] text-muted">
          {article.categoryName &&
            (article.categorySlug ? (
              <Link href={categoryHref(article.categorySlug)} className="text-accent hover:underline">
                {article.categoryName}
              </Link>
            ) : (
              <span className="text-accent">{article.categoryName}</span>
            ))}
          <span>·</span>
          <time dateTime={article.publishedAt?.toISOString()}>
            {formatDate(article.publishedAt, locale)}
          </time>
          <span>·</span>
          <span>
            {article.readingMinutes} {dict.common.minRead}
          </span>
        </div>

        <h1 className="display mt-6 text-[clamp(2.1rem,4.8vw,3.9rem)]">{article.title}</h1>
        {article.subtitle && (
          <p className="serif-accent mt-5 max-w-3xl text-[clamp(1.1rem,1.8vw,1.4rem)] leading-snug text-slateblue">
            {article.subtitle}
          </p>
        )}

        <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-y border-line py-3">
          <p className="text-[12px] text-muted">
            {dict.common.by}{" "}
            <Link href={aboutHref} className="text-ink hover:underline">
              {article.authorName}
            </Link>
            <span aria-hidden="true"> · </span>
            <span>
              {dict.common.updated}:{" "}
              <time dateTime={article.updatedAt.toISOString()}>{formatDate(article.updatedAt, locale)}</time>
            </span>
          </p>
          <ShareBar
            title={article.title}
            url={shareCanonicalUrl}
            labels={{ share: dict.common.share, copy: dict.common.copyLink, copied: dict.common.copied }}
          />
        </div>
      </header>

      {article.cover && (
        <div className="container-page mt-10">
          <div className="relative aspect-[16/9] overflow-hidden border border-line bg-surface-muted">
            <Image
              src={assetUrl(article.cover.url)}
              alt={article.cover.alt || article.title}
              fill
              priority
              sizes="(min-width: 1440px) 1344px, 92vw"
              className="object-cover"
            />
          </div>
        </div>
      )}

      <div className="container-page mt-12 grid gap-12 pb-16 lg:grid-cols-12">
        {/* E2E 2026-11-14: min-w-0 — same single-column grid blowout as the
            project detail page (a <pre> in the prose forces the implicit
            `auto` track wider than the viewport on phones). */}
        <div className="min-w-0 lg:col-span-8">
          <div className="prose-editorial" dangerouslySetInnerHTML={{ __html: body.html }} />

          {article.tags.length > 0 && (
            <div className="mt-14 flex flex-wrap items-center gap-2 border-t border-line pt-6">
              <span className="text-[10px] uppercase tracking-[0.16em] text-muted">{dict.common.tags}</span>
              {article.tags.map((tag) => (
                <Link key={tag.slug} href={`${blogHref}?tag=${tag.slug}`} className="chip hover:border-ink hover:text-ink">
                  {tag.name}
                </Link>
              ))}
            </div>
          )}
        </div>

        <aside className="min-w-0 lg:col-span-4">
          <div className="lg:sticky lg:top-24">
            {body.toc.length > 0 && (
              <div className="border-t border-line pt-5">
                <p className="label">{dict.common.contents}</p>
                <nav className="mt-4" aria-label={dict.common.contents}>
                  <ol className="space-y-2.5">
                    {body.toc.map((item) => (
                      <li key={item.id} className={item.level === 3 ? "pl-4" : ""}>
                        <a
                          href={`#${item.id}`}
                          className="text-[13px] leading-snug text-muted transition-colors hover:text-ink"
                        >
                          {item.text}
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>
              </div>
            )}

            <div className="mt-8 border border-line bg-surface p-5">
              <p className="text-[13px] leading-relaxed text-muted">{dict.contact.description}</p>
              <Link href={localeHref(locale, "/contact")} className="btn btn-primary btn-sm mt-4 w-full">
                {dict.nav.contact}
              </Link>
            </div>
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="container-page border-t border-line py-16">
          <h2 className="label">{dict.common.related}</h2>
          <div className="mt-8 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item, index) => (
              <Reveal key={item.id} delay={index * 60}>
                <ArticleCard article={item} href={`${blogHref}/${item.slug}`} locale={locale} dict={dict} />
              </Reveal>
            ))}
          </div>
        </section>
      )}
      </>
      )}
    </article>
  );
}
