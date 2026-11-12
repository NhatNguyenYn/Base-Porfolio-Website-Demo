import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n";
import { alternateLocale, isLocale, localeHref, type Locale } from "@/i18n/config";
import { getNextProject, getProjectDetail } from "@/data/projects";
import { getProjectLocales } from "@/server/queries/projects";
import { prisma } from "@/server/db";
import { renderMarkdown } from "@/lib/markdown";
import { canonicalPath, languageAlternates } from "@/lib/seo";
import { formatDate } from "@/lib/utils";
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
  const { project } = await getProjectDetail(slug, raw);
  if (!project) {
    return {
      title: raw === "vi" ? "Dự án chưa có bản dịch" : "Project not available in English",
      robots: { index: false, follow: false },
      alternates: { canonical: canonicalPath(raw, `/projects/${slug}`) },
    };
  }

  const available = await getProjectLocales(slug);

  return {
    title: project.name,
    description: project.shortDescription,
    alternates: {
      canonical: canonicalPath(raw, `/projects/${slug}`),
      languages: languageAlternates(`/projects/${slug}`, available),
    },
    openGraph: {
      title: project.name,
      description: project.shortDescription,
      images: project.thumbnail ? [{ url: project.thumbnail.url }] : undefined,
      type: "article",
    },
  };
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

  const [body, next] = await Promise.all([renderMarkdown(project.fullDescription), getNextProject(slug, locale)]);
  const statusLabel = (dict.projects.statuses as Record<string, string>)[project.status] ?? project.status;

  return (
    <article>
      <header className="container-page pt-10 lg:pt-14">
        <Link href={localeHref(locale, "/projects")} className="link-arrow text-muted hover:text-ink">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
          {dict.projects.label}
        </Link>

        <div className="mt-10 grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="chip chip-active">{statusLabel}</span>
              {project.featured && <span className="chip">{dict.common.featured}</span>}
              {project.year && <span className="text-[11px] tabular-nums text-muted">{project.year}</span>}
            </div>
            <h1 className="display mt-6 text-[clamp(2.4rem,5.4vw,4.6rem)]">{project.name}</h1>
            <p className="mt-5 max-w-2xl text-[0.975rem] leading-relaxed text-muted">{project.shortDescription}</p>
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
        <Reveal className="container-page mt-12">
          <div className="relative aspect-[16/9] overflow-hidden border border-line bg-surface-muted">
            <Image
              src={project.thumbnail.url}
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
          <div className="lg:col-span-8">
            <h2 className="text-[10px] uppercase tracking-[0.18em] text-muted">{dict.projects.detail.overview}</h2>
            {body.html ? (
              <div className="prose-editorial mt-6" dangerouslySetInnerHTML={{ __html: body.html }} />
            ) : (
              <p className="mt-6 text-sm text-muted">{dict.projects.detail.empty}</p>
            )}
          </div>

          <aside className="lg:col-span-4 lg:pl-4">
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
                    src={image.url}
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
