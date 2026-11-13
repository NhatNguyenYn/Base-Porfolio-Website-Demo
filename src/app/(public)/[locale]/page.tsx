import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getDictionary } from "@/i18n";
import { isLocale, localeHref, type Locale } from "@/i18n/config";
import { getSettings } from "@/data/settings";
import { getProfile } from "@/data/profile";
import { getSocialLinks } from "@/data/social";
import { getFeaturedProjects, listProjects } from "@/data/projects";
import { listArtworks } from "@/data/artworks";
import { getFeaturedArticle, listArticles } from "@/data/articles";
import { DEFAULT_SETTINGS } from "@/data/settings";
import { loadSection } from "@/lib/services/safe-data";
import { markdownExcerpt } from "@/lib/utils";
import { buildPageMetadata, socialImage } from "@/lib/seo";
import { Reveal } from "@/components/ui/reveal";
import { AnimatedHeadline } from "@/components/ui/animated-headline";
import { Parallax } from "@/components/ui/parallax";
import { SectionHeader } from "@/components/site/section-header";
import { ProjectCard } from "@/components/site/project-card";
import { ArticleCard } from "@/components/site/article-card";
import { ArtGallery } from "@/components/site/art-gallery";
import { SocialLinks } from "@/components/site/social-links";
import { parseInterests } from "@/lib/interests";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const locale: Locale = raw;
  const [profile, settings] = await Promise.all([getProfile(), getSettings()]);
  const content = profile?.translations.find((item) => item.locale === locale);
  return buildPageMetadata({
    locale,
    path: "/",
    title: content ? `${content.fullName} — ${content.title}` : settings.seoTitle,
    description: content?.shortBio || settings.seoDescription,
    siteName: settings.siteName,
    absoluteTitle: true,
    image: profile?.avatar
      ? socialImage(profile.avatar.url, profile.avatar.alt || content?.fullName || settings.siteName, profile.avatar.width, profile.avatar.height)
      : null,
  });
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "vi") as Locale;
  const dict = getDictionary(locale);

  // Sections load independently: a failing gallery must never blank the page.
  const [settings, profile, socials, featuredProjects, projectStats, artworks, featuredArticle, latestArticles] =
    await Promise.all([
      loadSection("settings", getSettings, { ...DEFAULT_SETTINGS, logo: null, favicon: null }),
      loadSection("profile", getProfile, null),
      loadSection("socials", getSocialLinks, []),
      loadSection("featured-projects", () => getFeaturedProjects(locale, 4), []),
      loadSection("project-stats", () => listProjects(locale, { perPage: 1 }), {
        items: [],
        total: 0,
        technologies: [],
        categories: [],
        page: 1,
        pages: 1,
      }),
      loadSection("artworks", () => listArtworks(locale), []),
      loadSection("featured-article", () => getFeaturedArticle(locale), null),
      loadSection("articles", () => listArticles(locale, { perPage: 4 }), {
        items: [],
        total: 0,
        page: 1,
        pages: 1,
        categories: [],
        tags: [],
      }),
    ]);

  const content = profile?.translations.find((item) => item.locale === locale) ?? null;
  const name = content?.fullName ?? settings.siteName;
  const title = content?.title ?? settings.siteTagline;
  // Never fall back to the other locale's biography: missing copy falls back to
  // language-neutral site settings, and the About page explains the gap.
  const intro = content?.shortBio ?? settings.siteTagline;
  const philosophyExcerpt = markdownExcerpt(content?.longBio ?? content?.philosophy ?? "", 520);
  const galleryPreview = artworks.slice(0, 6);
  const interests = parseInterests(content?.interests ?? "").slice(0, 3);
  const listArticlesExcludeFeatured = latestArticles.items.filter((item) => item.id !== featuredArticle?.id).slice(0, 3);

  const projectsHref = localeHref(locale, "/projects");
  const artHref = localeHref(locale, "/art");
  const blogHref = localeHref(locale, "/blog");
  const contactHref = localeHref(locale, "/contact");

  return (
    <>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="container-page relative pt-8 pb-16 lg:pt-14 lg:pb-24">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-7 lg:pt-6">
            <Reveal priority>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="label">{dict.home.eyebrow}</span>
                <span className="h-px w-6 bg-line-strong" aria-hidden="true" />
                <span className="flex items-center gap-2 text-[11px] text-muted">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${profile?.availableForWork === false ? "bg-muted" : "bg-accent"}`}
                    aria-hidden="true"
                  />
                  {profile?.availableForWork === false ? dict.home.unavailable : dict.home.availability}
                </span>
              </div>
            </Reveal>

            <Reveal delay={80} priority>
              <AnimatedHeadline
                text={name}
                className="display mt-8 text-[clamp(2.9rem,7.4vw,6.1rem)] text-balance"
              />
              <p className="serif-accent mt-4 max-w-2xl text-[clamp(1.35rem,2.6vw,2.1rem)] leading-[1.25] text-slateblue">
                {title}
              </p>
            </Reveal>

            <Reveal delay={160} priority>
              <p className="mt-8 max-w-lg text-[0.975rem] leading-[1.8] text-muted">{intro}</p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link href={projectsHref} className="btn btn-primary">
                  {dict.home.exploreWork}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </Link>
                <Link href={contactHref} className="btn btn-outline">
                  {dict.home.contactMe}
                </Link>
              </div>
            </Reveal>

            <Reveal delay={220} priority>
              <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4 border-t border-line pt-6">
                <SocialLinks links={socials} />
                <span className="hidden h-4 w-px bg-line sm:block" aria-hidden="true" />
                <a
                  href={`mailto:${settings.contactEmail}`}
                  className="text-[12px] tracking-[0.01em] text-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink"
                >
                  {settings.contactEmail}
                </a>
              </div>
            </Reveal>
          </div>

          {/* Portrait column */}
          <div className="lg:col-span-5 lg:pt-5">
            <Reveal delay={120} variant="mask" priority className="lg:pl-6">
              <Parallax strength={10}>
              <figure className="relative">
                <div className="relative aspect-[4/5] overflow-hidden border border-line bg-surface-muted">
                  {profile?.avatar ? (
                    <Image
                      src={profile.avatar.url}
                      alt={profile.avatar.alt || name}
                      fill
                      priority
                      sizes="(min-width: 1024px) 38vw, 92vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center bg-surface-muted">
                      <span className="serif-accent text-6xl text-muted">{name.slice(0, 1)}</span>
                    </div>
                  )}
                  <span className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/5" aria-hidden="true" />
                </div>

                <figcaption className="mt-4 flex items-start justify-between gap-4 border-t border-line pt-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
                      {dict.home.basedIn}
                    </p>
                    <p className="mt-1 text-[13px]">{settings.contactLocation || profile?.location || "—"}</p>
                  </div>
                  <p className="text-right text-[11px] uppercase tracking-[0.16em] text-muted">
                    {new Date().getFullYear()}
                  </p>
                </figcaption>
              </figure>
              </Parallax>
            </Reveal>
          </div>
        </div>

        {/* Editorial stat rail */}
        <Reveal delay={160}>
          <dl className="mt-16 grid grid-cols-2 gap-y-8 border-y border-line py-7 sm:grid-cols-4">
            {[
              { label: dict.home.stats.projects, value: projectStats.total },
              { label: dict.home.stats.artworks, value: artworks.length },
              { label: dict.home.stats.articles, value: latestArticles.total },
              { label: dict.home.focusLabel, value: null, text: content?.title ?? title },
            ].map((item) => (
              <div key={item.label} className="border-l border-line pl-5 first:border-l-0 first:pl-0 sm:pl-6">
                <dt className="text-[10px] uppercase tracking-[0.16em] text-muted">{item.label}</dt>
                <dd className="mt-2 truncate text-[15px] tabular-nums tracking-tight">
                  {item.value !== null ? String(item.value).padStart(2, "0") : item.text}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </section>

      {/* --------------------------------------------------------------- About */}
      <section className="container-page py-16 lg:py-24">
        <SectionHeader
          index="01"
          label={dict.home.aboutLabel}
          title={dict.home.aboutTitle}
          action={{ href: localeHref(locale, "/about"), label: dict.home.aboutCta }}
        />
        <div className="mt-10 grid gap-10 lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            <p className="text-[clamp(1.2rem,2vw,1.6rem)] leading-[1.55] tracking-[-0.01em]">
              {content?.shortBio ?? intro}
            </p>
            {philosophyExcerpt && (
              <p className="mt-6 max-w-2xl text-[0.95rem] leading-[1.8] text-muted">{philosophyExcerpt}</p>
            )}
          </Reveal>
          {interests.length > 0 && (
            <Reveal delay={100} className="lg:col-span-5">
              <ul className="divide-y divide-line border-y border-line">
                {interests.map((interest, index) => (
                  <li key={interest.title} className="flex gap-5 py-5">
                    <span className="pt-0.5 text-[10px] tabular-nums tracking-[0.16em] text-accent">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p className="text-[15px] tracking-tight">{interest.title}</p>
                      {interest.description && (
                        <p className="mt-1 text-[13px] leading-relaxed text-muted">{interest.description}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Reveal>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------ Projects */}
      <section className="container-page py-16 lg:py-24">
        <SectionHeader
          index="02"
          label={dict.home.projectsLabel}
          title={dict.home.projectsTitle}
          action={{ href: projectsHref, label: dict.home.projectsCta }}
        />
        {featuredProjects.length > 0 ? (
          <div className="mt-12 grid gap-x-8 gap-y-14 md:grid-cols-12">
            {featuredProjects.map((project, index) => {
              const span = index % 4 === 0 || index % 4 === 3 ? "md:col-span-7" : "md:col-span-5";
              return (
                <Reveal key={project.id} className={span} delay={(index % 2) * 80}>
                  <ProjectCard
                    project={project}
                    href={`${projectsHref}/${project.slug}`}
                    dict={dict}
                    index={index}
                    size={index % 4 === 0 ? "large" : "default"}
                  />
                </Reveal>
              );
            })}
          </div>
        ) : (
          <div className="mt-10 border border-dashed border-line p-10 text-center">
            <p className="text-sm text-muted">{dict.projects.emptyTitle}</p>
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------- Art gallery */}
      <section className="relative overflow-hidden bg-[#0e131a] py-16 text-white lg:py-24">
        <span
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(65%_55%_at_88%_-5%,var(--ruby-tint),transparent_72%)]"
          aria-hidden="true"
        />
        <div className="container-page relative">
          <SectionHeader
            index="03"
            label={dict.home.artLabel}
            title={dict.home.artTitle}
            action={{ href: artHref, label: dict.home.artCta }}
            tone="inverse"
            className="border-white/15"
          />

          {galleryPreview.length > 0 ? (
            <div className="mt-12">
              <ArtGallery
                artworks={galleryPreview}
                collections={[]}
                locale={locale}
                labels={{
                  allWorks: dict.art.allWorks,
                  allCollections: dict.art.allCollections,
                  collections: dict.art.collections,
                  viewFullscreen: dict.common.viewFullscreen,
                  close: dict.common.closeLabel,
                  next: dict.common.nextImage,
                  previous: dict.common.prevImage,
                  details: dict.art.details,
                  medium: dict.common.medium,
                  created: dict.common.created,
                  collection: dict.common.collection,
                  category: dict.common.category,
                  viewArtwork: dict.common.viewArtwork,
                  imageAlt: dict.art.imageAlt,
                  count: dict.art.collectionCount,
                }}
              />
            </div>
          ) : (
            <p className="mt-10 border border-dashed border-white/20 p-10 text-center text-sm text-white/60">
              {dict.art.emptyTitle}
            </p>
          )}
        </div>
      </section>

      {/* --------------------------------------------------------------- Blog */}
      <section className="container-page py-16 lg:py-24">
        <SectionHeader
          index="04"
          label={dict.home.blogLabel}
          title={dict.home.blogTitle}
          action={{ href: blogHref, label: dict.home.blogCta }}
        />

        {featuredArticle ? (
          <div className="mt-12 grid gap-10 lg:grid-cols-12">
            <Reveal className="lg:col-span-6">
              <ArticleCard
                article={featuredArticle}
                href={`${blogHref}/${featuredArticle.slug}`}
                locale={locale}
                dict={dict}
                variant="feature"
              />
            </Reveal>
            <div className="lg:col-span-6 lg:pl-4">
              {listArticlesExcludeFeatured.map((article, index) => (
                <Reveal key={article.id} delay={index * 70}>
                  <ArticleCard
                    article={article}
                    href={`${blogHref}/${article.slug}`}
                    locale={locale}
                    dict={dict}
                    variant="row"
                  />
                </Reveal>
              ))}
              <div className="border-t border-line pt-6">
                <Link href={blogHref} className="link-arrow text-muted hover:text-ink">
                  {dict.home.blogCta}
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-10 border border-dashed border-line p-10 text-center">
            <p className="text-sm text-muted">{dict.blog.emptyTitle}</p>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------ Contact */}
      <section className="container-page pb-8 pt-10 lg:pb-16">
        <div className="relative overflow-hidden border border-line bg-surface px-6 py-14 sm:px-12 lg:py-20">
          <span className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent-soft blur-3xl" aria-hidden="true" />
          <div className="relative grid gap-10 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7">
              <span className="label">{dict.home.contactLabel}</span>
              <h2 className="display mt-4 text-[clamp(2rem,4.6vw,3.6rem)]">{dict.home.contactTitle}</h2>
              <p className="mt-5 max-w-lg text-[0.95rem] leading-relaxed text-muted">{dict.home.contactText}</p>
            </div>
            <div className="lg:col-span-5 lg:text-right">
              <a
                href={`mailto:${settings.contactEmail}`}
                className="serif-accent inline-block text-[clamp(1.1rem,2.2vw,1.6rem)] underline decoration-line-strong decoration-1 underline-offset-8 transition-colors hover:text-accent"
              >
                {settings.contactEmail}
              </a>
              <div className="mt-7 flex flex-wrap gap-3 lg:justify-end">
                <Link href={contactHref} className="btn btn-primary">
                  {dict.contact.formTitle}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </Link>
                <SocialLinks links={socials} />
              </div>
              {profile?.location && (
                <p className="mt-6 text-[11px] uppercase tracking-[0.16em] text-muted">{profile.location}</p>
              )}
            </div>
          </div>
          {settings.showDemoBadge && (
            <p className="relative mt-12 text-[10px] uppercase tracking-[0.14em] text-muted">
              {dict.meta.demoNotice}
            </p>
          )}
        </div>
      </section>
    </>
  );
}
