import Link from "next/link";
import Image from "next/image";
import type { ArticleCardData, ArticleDetailData } from "@/data/articles";
import type { Dictionary } from "@/i18n";
import { localeHref, type Locale } from "@/i18n/config";
import { assetUrl } from "@/lib/asset";
import { formatDate } from "@/lib/utils";
import type { TocItem } from "@/lib/markdown";
import { ArticleBody } from "./article-body";
import { ArticleCard } from "@/components/site/article-card";
import { ShareBar } from "@/components/site/share-bar";
import { Reveal } from "@/components/ui/reveal";
import { AnimatedHeadline } from "@/components/ui/animated-headline";
import { ReadingProgress } from "./reading-progress";

/**
 * "Editorial / Premium News" presentation. It reads exactly the same article
 * row as the default template — only typography, hierarchy and reading chrome
 * differ. Q&A blocks come from `:::qa` ranges in the Markdown content.
 */
export function EditorialArticle({
  article,
  body,
  related,
  dict,
  locale,
  blogHref,
  canonicalUrl,
}: {
  article: ArticleDetailData;
  body: { html: string; toc: TocItem[] };
  related: ArticleCardData[];
  dict: Dictionary;
  locale: Locale;
  blogHref: string;
  /** Canonical article URL to share (instead of window.location.href). */
  canonicalUrl?: string;
}) {
  const coverCaption = article.cover?.alt && article.cover.alt !== article.title ? article.cover.alt : "";
  const monogram = article.authorName.trim().slice(0, 1).toUpperCase() || "A";
  const aboutHref = localeHref(locale, "/about");
  // Static export (GitHub Pages demo): a prerendered page cannot re-render
  // for a query string — `?category=slug` only changes the URL while the
  // served HTML stays the unfiltered list. So in export mode the category
  // chip links to the prerendered /blog/category/<slug>/ page instead (same
  // pattern as the list-page chips in blog/page.tsx). Server mode keeps the
  // query-param filter so it can combine with the q/tag search.
  // (Tag chips keep `?tag=` — there is no /blog/tag/[slug]/ route to point
  // them at; building one is out of scope for this fix.)
  const categoryHref = (slug: string) =>
    process.env.PAGES_EXPORT === "1" ? `${blogHref}/category/${slug}` : `${blogHref}?category=${slug}`;

  const toc = body.toc.length > 0 && (
    <ol className="space-y-2.5">
      {body.toc.map((item) => (
        <li key={item.id} className={item.level === 3 ? "pl-4" : ""}>
          <a
            href={`#${item.id}`}
            className="block border-l border-line py-0.5 pl-3 text-[12.5px] leading-snug text-muted transition-colors hover:border-accent hover:text-ink"
          >
            {item.text}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <>
      <ReadingProgress />

      <header className="container-page mt-10">
        <div className="max-w-5xl">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] uppercase tracking-[0.18em]">
            {article.categoryName && (
              article.categorySlug ? (
                <Link
                  href={categoryHref(article.categorySlug)}
                  className="rounded-full bg-accent-soft px-2.5 py-1 text-accent transition-colors hover:bg-accent hover:text-primary-fg"
                >
                  {article.categoryName}
                </Link>
              ) : (
                <span className="rounded-full bg-accent-soft px-2.5 py-1 text-accent">{article.categoryName}</span>
              )
            )}
            <time dateTime={article.publishedAt?.toISOString()} className="text-muted">
              {formatDate(article.publishedAt, locale)}
            </time>
            <span className="text-muted">·</span>
            <span className="text-muted">
              {article.readingMinutes} {dict.common.minRead}
            </span>
          </div>

          <AnimatedHeadline
            text={article.title}
            className="editorial-title mt-6 text-[clamp(2.15rem,5.6vw,4.6rem)]"
          />

          {article.subtitle && (
            <p className="editorial-deck mt-6 max-w-3xl text-[clamp(1.2rem,2.1vw,1.65rem)] text-slateblue">
              {article.subtitle}
            </p>
          )}

          <div className="mt-9 flex flex-wrap items-center justify-between gap-4 border-y border-line py-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface-muted text-[12px] font-medium">
                {monogram}
              </span>
              <div>
                <p className="text-[12px] text-ink">
                  <Link href={aboutHref} className="hover:underline">
                    {article.authorName}
                  </Link>
                </p>
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted">{dict.common.by}</p>
              </div>
            </div>
            <ShareBar
              title={article.title}
              url={canonicalUrl}
              labels={{ share: dict.common.share, copy: dict.common.copyLink, copied: dict.common.copied }}
            />
          </div>
        </div>
      </header>

      {article.cover && (
        <figure className="container-page mt-10">
          <Reveal variant="mask" priority>
            <div className="relative aspect-[16/9] overflow-hidden bg-surface-muted lg:aspect-[21/9]">
              <Image
                src={assetUrl(article.cover.url)}
                alt={article.cover.alt || article.title}
                fill
                priority
                sizes="(min-width: 1440px) 1344px, 94vw"
                className="object-cover"
              />
            </div>
          </Reveal>
          {coverCaption && (
            <figcaption className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-muted">
              <span className="mt-[0.45em] h-px w-6 shrink-0 bg-line-strong" aria-hidden="true" />
              {coverCaption}
            </figcaption>
          )}
        </figure>
      )}

      <div className="container-page mt-14 grid gap-12 pb-16 lg:mt-20 lg:grid-cols-12 lg:gap-14">
        <aside className="hidden lg:col-span-3 lg:block">
          <div className="lg:sticky lg:top-24">
            {body.toc.length > 0 && (
              <div className="border-t border-line pt-5">
                <p className="label">{dict.common.contents}</p>
                <nav className="mt-4" aria-label={dict.common.contents}>
                  {toc}
                </nav>
              </div>
            )}

            <div className="mt-8 border-t border-line pt-5">
              <p className="label">{dict.common.by}</p>
              <p className="mt-3 text-[14px] tracking-tight">
                <Link href={aboutHref} className="hover:underline">
                  {article.authorName}
                </Link>
              </p>
              <p className="mt-1 text-[11px] text-muted">
                {dict.common.updated}: {formatDate(article.updatedAt, locale)}
              </p>
            </div>

            <div className="mt-8 border border-line bg-surface p-5">
              <p className="text-[12.5px] leading-relaxed text-muted">{dict.contact.description}</p>
              <Link href={localeHref(locale, "/contact")} className="btn btn-primary btn-sm mt-4 w-full">
                {dict.nav.contact}
              </Link>
            </div>
          </div>
        </aside>

        <div className="min-w-0 lg:col-span-8">
          {body.toc.length > 0 && (
            <details className="mb-10 border-y border-line py-4 lg:hidden">
              <summary className="cursor-pointer text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                {dict.common.contents}
              </summary>
              <nav className="mt-4" aria-label={dict.common.contents}>
                {toc}
              </nav>
            </details>
          )}

          <ArticleBody html={body.html} template="editorial" />

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

          <div className="mt-12 border border-line bg-surface p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface-muted text-[13px] font-medium">
                {monogram}
              </span>
              <div>
                <p className="text-[13.5px] tracking-tight">
                  <Link href={aboutHref} className="hover:underline">
                    {article.authorName}
                  </Link>
                </p>
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted">{dict.common.by}</p>
              </div>
            </div>
            <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
              {article.excerpt || article.subtitle}
            </p>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="container-page border-t border-line py-16">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="label">{dict.common.related}</h2>
            <Link href={blogHref} className="link-arrow text-muted hover:text-ink">
              {dict.common.viewAll}
            </Link>
          </div>
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
  );
}
