import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n";
import { alternateLocale, isLocale, localeHref, type Locale } from "@/i18n/config";
import { getNextProject, getProjectDetail, getRelatedProjects } from "@/data/projects";
import { getSettings } from "@/data/settings";
import { getSocialLinks } from "@/data/social";
import { getProjectLocales } from "@/server/queries/projects";
import { prisma } from "@/server/db";
import { renderMarkdown } from "@/lib/markdown";
import { buildPageMetadata, canonicalUrl, safeSocialImage, socialImage, xHandleFromSocials } from "@/lib/seo";
import { assetUrl } from "@/lib/asset";
import { absoluteUrl, formatDate } from "@/lib/utils";
import { serializeJsonLd } from "@/lib/json-ld";
import { buildBreadcrumbSchema, buildCreativeWorkSchema } from "@/lib/structured-data";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { ProjectCard } from "@/components/site/project-card";
import { ShareBar } from "@/components/site/share-bar";
import { UntranslatedNotice } from "@/components/site/untranslated-notice";
import { Reveal } from "@/components/ui/reveal";

// The GitHub Pages demo build rewrites this to "force-static"
// (see .github/workflows/pages.yml); the full-stack build keeps it dynamic.
export const dynamic = "force-dynamic";

// Static-export build (GitHub Pages demo): enumerate every public project slug
// so its page can prerender. Ignored by the dynamic build.
export async function generateStaticParams() {
  const rows = await prisma.project.findMany({
    where: { visibility: "public", publishedAt: { not: null }, deletedAt: null },
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
  const { project } = await getProjectDetail(slug, raw);
  if (!project) {
    return buildPageMetadata({
      locale: raw,
      path: `/projects/${slug}`,
      title: raw === "vi" ? "Dự án chưa có bản dịch" : "Project not available in English",
      description: raw === "vi" ? "Dự án này chưa có bản dịch." : "This project is not available in this language.",
      siteName: settings.siteName,
      noindex: true,
    });
  }

  const available = await getProjectLocales(slug);
  const xHandle = xHandleFromSocials(await getSocialLinks());

  return buildPageMetadata({
    locale: raw,
    path: `/projects/${slug}`,
    title: project.name,
    description: project.shortDescription,
    siteName: settings.siteName,
    availableLocales: available,
    image: project.thumbnail
      ? socialImage(project.thumbnail.url, project.thumbnail.alt || project.name, project.thumbnail.width, project.thumbnail.height)
      : null,
    twitterSite: xHandle,
    twitterCreator: xHandle,
    faviconUrl: settings.favicon?.url,
  });
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const settings = await getSettings();
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  const { status, project } = await getProjectDetail(slug, locale);

  if (status === "not_found") notFound();

  if (status === "not_translated" || !project) {
    return (
      <UntranslatedNotice
        currentLocale={locale}
        alternate={alternateLocale(locale)}
        alternateHref={localeHref(alternateLocale(locale), `/projects/${slug}`)}
        title={dict.langNotice.title}
        text={dict.langNotice.text}
        switchLabel={dict.langNotice.switch}
      />
    );
  }

  const [body, next, related] = await Promise.all([
    renderMarkdown(project.fullDescription),
    getNextProject(slug, locale),
    getRelatedProjects(locale, project.id, project.category, 3),
  ]);
  const statusLabel = (dict.projects.statuses as Record<string, string>)[project.status] ?? project.status;
  const projectsHref = localeHref(locale, "/projects");
  const schemaCanonicalUrl = absoluteUrl(`/${locale}/projects/${project.slug}`);
  const shareCanonicalUrl = canonicalUrl(locale, `/projects/${project.slug}`);
  const schemaImage = project.thumbnail
    ? safeSocialImage(
        socialImage(project.thumbnail.url, project.thumbnail.alt || project.name, project.thumbnail.width, project.thumbnail.height),
        settings.siteName,
      )
    : null;
  const crumbs = [
    { name: dict.nav.home, href: localeHref(locale, "/") },
    { name: dict.projects.label, href: projectsHref },
    { name: project.name, href: `${projectsHref}/${project.slug}` },
  ];
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      buildBreadcrumbSchema(crumbs),
      buildCreativeWorkSchema({
        canonicalUrl: schemaCanonicalUrl,
        name: project.name,
        description: project.shortDescription,
        imageUrl: schemaImage?.url,
        datePublished: project.startDate?.toISOString(),
        dateModified: project.updatedAt.toISOString(),
        technologies: project.technologies,
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
      <header className="container-page pt-10 lg:pt-14">
        <Breadcrumbs items={crumbs} label={dict.common.breadcrumb} />

        <div className="mt-10 grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="chip chip-active">{statusLabel}</span>
              {project.featured && <span className="chip">{dict.common.featured}</span>}
              {project.year && <span className="text-[11px] tabular-nums text-muted">{project.year}</span>}
            </div>
            <h1 className="display mt-6 text-[clamp(2.4rem,5.4vw,4.6rem)]">{project.name}</h1>
            <p className="mt-5 max-w-2xl text-[0.975rem] leading-relaxed text-muted">{project.shortDescription}</p>
            <div className="mt-6">
              <ShareBar
                title={project.name}
                url={shareCanonicalUrl}
                labels={{ share: dict.common.share, copy: dict.common.copyLink, copied: dict.common.copied }}
              />
            </div>
          </div>

          <div className="lg:col-span-4">
            <dl className="divide-y divide-line border-y border-line">
              {project.role && (
                <div className="flex items-baseline justify-between gap-4 py-3">
                  <dt className="text-[10px] uppercase tracking-[0.16em] text-muted">{dict.common.role}</dt>
                  <dd className="text-right text-[13px]">{project.role}</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between gap-4 py-3">
                <dt className="text-[10px] uppercase tracking-[0.16em] text-muted">{dict.common.status}</dt>
                <dd className="text-right text-[13px]">{statusLabel}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-3">
                <dt className="text-[10px] uppercase tracking-[0.16em] text-muted">{dict.common.timeline}</dt>
                <dd className="text-right text-[13px] tabular-nums">
                  {project.startDate ? formatDate(project.startDate, locale, { month: "short", year: "numeric" }) : "—"}
                  {" — "}
                  {project.completionDate
                    ? formatDate(project.completionDate, locale, { month: "short", year: "numeric" })
                    : dict.common.present}
                </dd>
              </div>
              {(project.githubUrl || project.demoUrl) && (
                <div className="flex items-baseline justify-between gap-4 py-3">
                  <dt className="text-[10px] uppercase tracking-[0.16em] text-muted">{dict.projects.detail.links}</dt>
                  <dd className="flex flex-col items-end gap-1 text-[13px]">
                    {project.demoUrl && (
                      <a href={project.demoUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-accent">
                        {dict.common.liveDemo} ↗
                      </a>
                    )}
                    {project.githubUrl && (
                      <a href={project.githubUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-accent">
                        {dict.common.sourceCode} ↗
                      </a>
                    )}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </header>

      {project.thumbnail && (
        <Reveal className="container-page mt-12" priority>
          <div className="relative aspect-[16/9] overflow-hidden border border-line bg-surface-muted">
            <Image
              src={assetUrl(project.thumbnail.url)}
              alt={project.thumbnail.alt || project.name}
              fill
              priority
              sizes="(min-width: 1440px) 1344px, 92vw"
              className="object-cover"
            />
          </div>
        </Reveal>
      )}

      <section className="container-page py-16 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-12">
          {/* E2E 2026-11-14: min-w-0 on grid children. Below lg this grid is
              a single implicit `auto` track, which sizes to the largest
              item's min-content — the <pre> code block in the prose
              (~403px) — causing 33px horizontal overflow at 390px
              viewports. min-w-0 lets the track shrink to the container. */}
          <div className="min-w-0 lg:col-span-8">
            <h2 className="text-[10px] uppercase tracking-[0.18em] text-muted">{dict.projects.detail.overview}</h2>
            {body.html ? (
              <div className="prose-editorial mt-6" dangerouslySetInnerHTML={{ __html: body.html }} />
            ) : (
              <p className="mt-6 text-sm text-muted">{dict.projects.detail.empty}</p>
            )}
          </div>

          <aside className="min-w-0 lg:col-span-4 lg:pl-4">
            <div className="lg:sticky lg:top-24">
              <h2 className="text-[10px] uppercase tracking-[0.18em] text-muted">{dict.projects.detail.stack}</h2>
              <ul className="mt-5 flex flex-wrap gap-1.5">
                {project.technologies.map((technology) => (
                  <li key={technology} className="chip">
                    {technology}
                  </li>
                ))}
              </ul>

              <div className="mt-8 border-t border-line pt-5">
                <Link href={localeHref(locale, "/contact")} className="btn btn-outline w-full">
                  {dict.home.contactMe}
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {project.images.length > 0 && (
        <section className="container-page pb-16 lg:pb-24">
          <h2 className="text-[10px] uppercase tracking-[0.18em] text-muted">{dict.projects.detail.gallery}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {project.images.map((image, index) => (
              <Reveal key={image.id} delay={(index % 2) * 60}>
                <div className="relative aspect-[4/3] overflow-hidden border border-line bg-surface-muted">
                  <Image
                    src={assetUrl(image.url)}
                    alt={image.alt || `${project.name} ${index + 1}`}
                    fill
                    sizes="(min-width: 768px) 45vw, 92vw"
                    className="object-cover"
                  />
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="container-page border-t border-line py-16">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="label">{dict.projects.detail.related}</h2>
            <Link href={projectsHref} className="link-arrow text-muted hover:text-ink">
              {dict.common.viewAll}
            </Link>
          </div>
          <div className="mt-8 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item, index) => (
              <Reveal key={item.id} delay={index * 60}>
                <ProjectCard project={item} href={`${projectsHref}/${item.slug}`} dict={dict} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {next && (
        <section className="border-t border-line">
          <Link href={`${localeHref(locale, "/projects")}/${next.slug}`} className="group block">
            <div className="container-page flex flex-col gap-3 py-12 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted">{dict.projects.detail.next}</p>
                <p className="mt-3 text-[clamp(1.6rem,3vw,2.6rem)] tracking-tight">{next.name}</p>
              </div>
              <span className="grid h-12 w-12 place-items-center rounded-full border border-line-strong text-muted transition-colors group-hover:border-ink group-hover:text-ink">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </span>
            </div>
          </Link>
        </section>
      )}
    </article>
  );
}
