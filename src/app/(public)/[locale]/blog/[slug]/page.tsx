import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n";
import { alternateLocale, isLocale, localeHref, type Locale } from "@/i18n/config";
import { getArticleDetail, getRelatedArticles, incrementArticleView } from "@/data/articles";
import { getArticleLocales } from "@/server/queries/articles";
import { renderMarkdown } from "@/lib/markdown";
import { canonicalPath, languageAlternates } from "@/lib/seo";
import { absoluteUrl, formatDate } from "@/lib/utils";
import { UntranslatedNotice } from "@/components/site/untranslated-notice";
import { ArticleCard } from "@/components/site/article-card";
import { ShareBar } from "@/components/site/share-bar";
import { Reveal } from "@/components/ui/reveal";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) return {};
  const { article } = await getArticleDetail(slug, raw);
  // No translation in this locale (or not published): keep it out of the index.
  if (!article) {
    return {
      title: raw === "vi" ? "Bài viết chưa có bản dịch" : "Article not available in English",
      robots: { index: false, follow: false },
      alternates: { canonical: canonicalPath(raw, `/blog/${slug}`) },
    };
  }

  const title = article.seoTitle || article.title;
  const description = article.seoDescription || article.excerpt;
  const available = await getArticleLocales(slug);

  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath(raw, `/blog/${slug}`),
      languages: languageAlternates(`/blog/${slug}`, available),
    },
    openGraph: {
      type: "article",
      title,
      description,
      publishedTime: article.publishedAt?.toISOString(),
      modifiedTime: article.updatedAt.toISOString(),
      authors: [article.authorName],
      images: article.cover ? [{ url: article.cover.url }] : undefined,
    },
    twitter: { card: "summary_large_image", title, description },
  };
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
    renderMarkdown(article.content),
    getRelatedArticles(locale, article.id, article.categorySlug, 3),
  ]);

  const blogHref = localeHref(locale, "/blog");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.seoDescription || article.excerpt,
    datePublished: article.publishedAt?.toISOString(),
    dateModified: article.updatedAt.toISOString(),
    author: { "@type": "Person", name: article.authorName },
    image: article.cover ? absoluteUrl(article.cover.url) : undefined,
    inLanguage: locale,
    mainEntityOfPage: absoluteUrl(`/${locale}/blog/${article.slug}`),
    wordCount: article.content.split(/\s+/).filter(Boolean).length,
  };

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="container-page pt-8">
        <Link href={blogHref} className="link-arrow text-muted hover:text-ink">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
          {dict.common.backToBlog}
        </Link>
      </div>

      <header className="container-page mt-10 max-w-4xl">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.16em] text-muted">
          {article.categoryName && <span className="text-accent">{article.categoryName}</span>}
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
            {dict.common.by} <span className="text-ink">{article.authorName}</span>
          </p>
          <ShareBar
            title={article.title}
            labels={{ share: dict.common.share, copy: dict.common.copyLink, copied: dict.common.copied }}
          />
        </div>
      </header>

      {article.cover && (
        <div className="container-page mt-10">
          <div className="relative aspect-[16/9] overflow-hidden border border-line bg-surface-muted">
            <Image
              src={article.cover.url}
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
        <div className="lg:col-span-8">
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

        <aside className="lg:col-span-4">
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
    </article>
  );
}
