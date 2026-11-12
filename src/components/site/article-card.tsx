import Image from "next/image";
import Link from "next/link";
import type { ArticleCardData } from "@/data/articles";
import { formatDate } from "@/lib/utils";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n";

export function ArticleCard({
  article,
  href,
  locale,
  dict,
  variant = "default",
  priority = false,
}: {
  article: ArticleCardData;
  href: string;
  locale: Locale;
  dict: Dictionary;
  variant?: "default" | "feature" | "row";
  priority?: boolean;
}) {
  if (variant === "row") {
    return (
      <article className="group border-t border-line">
        <Link href={href} className="grid gap-4 py-6 sm:grid-cols-[7rem_1fr_auto] sm:items-baseline sm:gap-6">
          <time
            dateTime={article.publishedAt?.toISOString()}
            className="text-[11px] tabular-nums tracking-[0.08em] text-muted"
          >
            {formatDate(article.publishedAt, locale, { day: "2-digit", month: "short", year: "numeric" })}
          </time>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {article.categoryName && (
                <span className="text-[10px] uppercase tracking-[0.16em] text-accent">{article.categoryName}</span>
              )}
              <span className="text-[10px] text-muted">·</span>
              <span className="text-[10px] text-muted">
                {article.readingMinutes} {dict.common.minRead}
              </span>
            </div>
            <h3 className="mt-2 text-lg leading-snug tracking-tight sm:text-xl">
              <span className="underline-sweep">{article.title}</span>
            </h3>
            {article.excerpt && (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{article.excerpt}</p>
            )}
          </div>
          <span className="hidden h-8 w-8 place-items-center rounded-full border border-line text-muted transition-colors group-hover:border-ink group-hover:text-ink sm:grid">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M7 17 17 7M9 7h8v8" />
            </svg>
          </span>
        </Link>
      </article>
    );
  }

  const isFeature = variant === "feature";

  return (
    <article className="group flex h-full flex-col">
      <Link href={href} className="block">
        <div className={`relative overflow-hidden border border-line bg-surface-muted ${isFeature ? "aspect-[16/10]" : "aspect-[3/2]"}`}>
          {article.cover ? (
            <Image
              src={article.cover.url}
              alt={article.cover.alt || article.title}
              fill
              priority={priority}
              sizes={isFeature ? "(min-width: 1024px) 55vw, 100vw" : "(min-width: 768px) 33vw, 100vw"}
              className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.035]"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center">
              <span className="serif-accent text-3xl text-muted">{article.categoryName || "Aa"}</span>
            </div>
          )}
        </div>
      </Link>
      <div className="flex flex-1 flex-col pt-5">
        <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted">
          {article.categoryName && <span className="text-accent">{article.categoryName}</span>}
          <span>·</span>
          <time dateTime={article.publishedAt?.toISOString()}>
            {formatDate(article.publishedAt, locale, { day: "2-digit", month: "short", year: "numeric" })}
          </time>
        </div>
        <h3 className={`mt-3 tracking-tight ${isFeature ? "text-2xl lg:text-[2rem] leading-tight" : "text-lg leading-snug"}`}>
          <Link href={href} className="underline-sweep">
            {article.title}
          </Link>
        </h3>
        {article.subtitle && <p className="mt-2 text-sm text-muted">{article.subtitle}</p>}
        {article.excerpt && (
          <p className={`mt-3 text-sm leading-relaxed text-muted ${isFeature ? "max-w-xl" : ""}`}>{article.excerpt}</p>
        )}
        <div className="mt-auto flex items-center gap-4 pt-5 text-[11px] text-muted">
          <span>{article.readingMinutes} {dict.common.minRead}</span>
          <Link href={href} className="link-arrow ml-auto text-muted group-hover:text-ink">
            {dict.common.readMore}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
          </Link>
        </div>
      </div>
    </article>
  );
}
