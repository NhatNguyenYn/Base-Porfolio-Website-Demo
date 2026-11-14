import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n";
import { alternateLocale, isLocale, localeHref, type Locale } from "@/i18n/config";
import { getEducation, getExperience, getProfile, getSkills } from "@/data/profile";
import { getSocialLinks } from "@/data/social";
import { getSettings } from "@/data/settings";
import { renderMarkdown } from "@/lib/markdown";
import { formatMonthYear } from "@/lib/utils";
import { buildPageMetadata, socialImage, xHandleFromSocials } from "@/lib/seo";
import { parseInterests } from "@/lib/interests";
import { serializeJsonLd } from "@/lib/json-ld";
import { buildBreadcrumbSchema } from "@/lib/structured-data";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { PageHero } from "@/components/site/page-hero";
import { SectionHeader } from "@/components/site/section-header";
import { Reveal } from "@/components/ui/reveal";
import { SocialLinks } from "@/components/site/social-links";
import { UntranslatedNotice } from "@/components/site/untranslated-notice";

// The GitHub Pages demo build rewrites this to "force-static"
// (see .github/workflows/pages.yml); the full-stack build keeps it dynamic.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const dict = getDictionary(raw);
  const [profile, settings] = await Promise.all([getProfile(), getSettings()]);
  const content = profile?.translations.find((item) => item.locale === raw);
  const xHandle = xHandleFromSocials(await getSocialLinks());
  return buildPageMetadata({
    locale: raw,
    path: "/about",
    title: dict.about.label,
    description: content?.shortBio || settings.seoDescription,
    siteName: settings.siteName,
    image: profile?.avatar
      ? socialImage(profile.avatar.url, profile.avatar.alt || content?.fullName || settings.siteName, profile.avatar.width, profile.avatar.height)
      : null,
    twitterSite: xHandle,
    twitterCreator: xHandle,
    faviconUrl: settings.favicon?.url,
  });
}

function LevelDots({ level }: { level: number }) {
  return (
    <span className="flex items-center gap-1" role="img" aria-label={`${level}/5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <span
          key={index}
          className={`h-1 w-4 ${index < level ? "bg-accent" : "bg-line-strong"}`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);

  const [profile, settings, education, experience, skills, socials] = await Promise.all([
    getProfile(),
    getSettings(),
    getEducation(locale),
    getExperience(locale),
    getSkills(),
    getSocialLinks(),
  ]);

  const content = profile?.translations.find((item) => item.locale === locale) ?? null;

  if (!content) {
    return (
      <UntranslatedNotice
        currentLocale={locale}
        alternate={alternateLocale(locale)}
        alternateHref={localeHref(alternateLocale(locale), "/about")}
        title={dict.langNotice.title}
        text={dict.langNotice.text}
        switchLabel={dict.langNotice.switch}
      />
    );
  }

  const [bio, philosophy, goals] = await Promise.all([
    renderMarkdown(content.longBio),
    renderMarkdown(content.philosophy),
    renderMarkdown(content.futureGoals),
  ]);

  const interests = parseInterests(content.interests);

  const milestones = [
    ...experience.map((item) => ({
      id: `exp-${item.id}`,
      type: dict.about.experienceLabel,
      start: item.startDate,
      end: item.endDate,
      isCurrent: item.isCurrent,
      title: item.role || item.company,
      subtitle: item.company,
      summary: item.summary,
    })),
    ...education.map((item) => ({
      id: `edu-${item.id}`,
      type: dict.about.educationLabel,
      start: new Date(item.startYear, 0, 1),
      end: item.endYear ? new Date(item.endYear, 0, 1) : null,
      isCurrent: item.isCurrent,
      title: [item.degree, item.field].filter(Boolean).join(", ") || item.institution,
      subtitle: item.institution,
      summary: item.description,
    })),
  ].sort((a, b) => b.start.getTime() - a.start.getTime());

  const skillGroups = Object.entries(
    skills.reduce<Record<string, typeof skills>>((groups, skill) => {
      groups[skill.category] = [...(groups[skill.category] ?? []), skill];
      return groups;
    }, {}),
  );

  const groupLabel = (key: string) =>
    (dict.about.skillsGroups as Record<string, string>)[key] ?? key;

  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const crumbs = [
    { name: dict.nav.home, href: localeHref(locale, "/") },
    { name: dict.about.label, href: localeHref(locale, "/about") },
  ];
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [buildBreadcrumbSchema(crumbs)],
  };

  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <div className="container-page pt-8">
        <Breadcrumbs items={crumbs} label={dict.common.breadcrumb} />
      </div>
      <PageHero
        label={dict.about.label}
        title={
          <>
            {dict.about.title.split(",")[0]}
            {dict.about.title.includes(",") && (
              <span className="serif-accent text-slateblue">, {dict.about.title.split(",").slice(1).join(",").trim()}</span>
            )}
          </>
        }
        description={content.shortBio}
        meta={[
          ...(profile?.location ? [{ label: dict.home.basedIn, value: profile.location }] : []),
          {
            label: dict.contact.availabilityLabel,
            value: profile?.availableForWork ? dict.home.availability : dict.home.unavailable,
          },
        ]}
      />

      {/* Introduction */}
      <section className="container-page pb-16 lg:pb-24">
        <div className="grid gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-4">
            <div className="lg:sticky lg:top-24">
              <div className="relative aspect-[4/5] overflow-hidden border border-line bg-surface-muted">
                {profile?.avatar ? (
                  <Image
                    src={profile.avatar.url}
                    alt={profile.avatar.alt || content.fullName}
                    fill
                    sizes="(min-width: 1024px) 30vw, 90vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center">
                    <span className="serif-accent text-5xl text-muted">{content.fullName.slice(0, 1)}</span>
                  </div>
                )}
              </div>
              <div className="mt-5 space-y-4 border-t border-line pt-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted">{dict.contact.emailLabel}</p>
                  <a
                    href={`mailto:${profile?.email ?? settings.contactEmail}`}
                    className="mt-1 block text-[13px] underline decoration-line-strong underline-offset-4 hover:text-accent"
                  >
                    {profile?.email ?? settings.contactEmail}
                  </a>
                </div>
                {profile?.resumeUrl && (
                  <a href={profile.resumeUrl} target="_blank" rel="noopener noreferrer" className="link-arrow text-muted hover:text-ink">
                    {dict.about.downloadCv}
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                      <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
                    </svg>
                  </a>
                )}
                <SocialLinks links={socials} />
              </div>
            </div>
          </Reveal>

          <Reveal delay={80} className="lg:col-span-8">
            <p className="text-[10px] uppercase tracking-[0.18em] text-accent">{dict.about.label}</p>
            <div className="prose-editorial mt-6" dangerouslySetInnerHTML={{ __html: bio.html }} />
            {bio.toc.length > 0 && (
              <div className="mt-10 flex flex-wrap gap-2">
                {bio.toc.map((item) => (
                  <a key={item.id} href={`#${item.id}`} className="chip hover:border-ink hover:text-ink">
                    {item.text}
                  </a>
                ))}
              </div>
            )}
          </Reveal>
        </div>
      </section>

      {/* Journey */}
      {milestones.length > 0 && (
        <section className="container-page py-16 lg:py-24">
          <SectionHeader
            index="01"
            label={dict.about.journeyLabel}
            title={dict.about.journeyTitle}
            description={content.shortBio}
          />
          <div className="mt-10">
            {milestones.map((item) => (
              <Reveal key={item.id}>
                <div className="grid gap-3 border-t border-line py-7 sm:grid-cols-[9rem_1fr] sm:gap-8">
                  <div>
                    <p className="text-[11px] tabular-nums tracking-[0.06em] text-muted">
                      {formatMonthYear(item.start, locale)} —{" "}
                      {item.isCurrent ? dict.about.present : item.end ? formatMonthYear(item.end, locale) : "—"}
                    </p>
                    <p className="mt-1.5 text-[10px] uppercase tracking-[0.16em] text-accent">{item.type}</p>
                  </div>
                  <div className="max-w-2xl">
                    <h3 className="text-lg tracking-tight">{item.title}</h3>
                    <p className="mt-1 text-[13px] text-muted">{item.subtitle}</p>
                    {item.summary && (
                      <p className="mt-2 text-[13px] leading-relaxed text-muted">{item.summary}</p>
                    )}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* Education */}
      {education.length > 0 && (
        <section className="container-page py-16 lg:py-24">
          <SectionHeader index="02" label={dict.about.educationLabel} title={dict.about.educationTitle} />
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {education.map((item, index) => (
              <Reveal key={item.id} delay={index * 60}>
                <article className="flex h-full flex-col border border-line bg-surface p-6">
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-muted">
                      {item.startYear} — {item.isCurrent ? dict.about.present : item.endYear ?? "—"}
                    </p>
                    <span className="text-[10px] tabular-nums text-muted">{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="mt-4 text-lg tracking-tight">{item.institution}</h3>
                  <p className="mt-1 text-[13px] text-accent">
                    {[item.degree, item.field].filter(Boolean).join(" · ")}
                  </p>
                  {item.location && <p className="mt-1 text-[12px] text-muted">{item.location}</p>}
                  {item.description && (
                    <p className="mt-4 text-[13px] leading-relaxed text-muted">{item.description}</p>
                  )}
                </article>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* Interests */}
      {interests.length > 0 && (
        <section className="container-page py-16 lg:py-24">
          <SectionHeader
            index="03"
            label={dict.about.interestsLabel}
            title={dict.about.interestsTitle}
          />
          <div className="mt-10 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {interests.map((interest, index) => (
              <div key={interest.title} className="bg-surface p-7">
                <span className="text-[10px] tabular-nums tracking-[0.18em] text-accent">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-4 text-[17px] tracking-tight">{interest.title}</h3>
                {interest.description && (
                  <p className="mt-2 text-[13px] leading-relaxed text-muted">{interest.description}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Skills */}
      {skills.length > 0 && (
        <section className="container-page py-16 lg:py-24">
          <SectionHeader index="04" label={dict.about.skillsLabel} title={dict.about.skillsTitle} />
          <div className="mt-10 grid gap-10 md:grid-cols-2">
            {skillGroups.map(([group, items], groupIndex) => (
              <Reveal key={group} delay={groupIndex * 60}>
                <div className="border-t border-line pt-5">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{groupLabel(group)}</p>
                  <ul className="mt-5 space-y-4">
                    {items.map((skill) => (
                      <li key={skill.id} className="flex items-center justify-between gap-6">
                        <span className="text-[14px]">{skill.name}</span>
                        <LevelDots level={skill.level} />
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* Experience */}
      {experience.length > 0 && (
        <section className="container-page py-16 lg:py-24">
          <SectionHeader index="05" label={dict.about.experienceLabel} title={dict.about.experienceTitle} />
          <div className="mt-10 space-y-12">
            {experience.map((item) => {
              const achievements = item.achievements
                ? item.achievements
                    .split(/\r?\n/)
                    .map((line) => line.replace(/^[-*]\s*/, "").trim())
                    .filter(Boolean)
                : [];

              return (
                <Reveal key={item.id}>
                  <article className="grid gap-6 border-t border-line pt-7 lg:grid-cols-[1fr_2fr]">
                    <div>
                      <h3 className="text-xl tracking-tight">{item.company}</h3>
                      <p className="mt-1 text-[13px] text-accent">{item.role}</p>
                      <p className="mt-2 text-[11px] tabular-nums tracking-[0.06em] text-muted">
                        {formatMonthYear(item.startDate, locale)} —{" "}
                        {item.isCurrent ? dict.about.present : item.endDate ? formatMonthYear(item.endDate, locale) : "—"}
                      </p>
                      {item.location && <p className="mt-1 text-[11px] text-muted">{item.location}</p>}
                    </div>
                    <div>
                      {item.summary && (
                        <p className="text-[0.95rem] leading-relaxed text-muted">{item.summary}</p>
                      )}
                      {achievements.length > 0 && (
                        <ul className="mt-4 space-y-2.5">
                          {achievements.map((achievement, index) => (
                            <li key={index} className="flex gap-3 text-[13px] leading-relaxed text-muted">
                              <span className="mt-2 h-px w-3 shrink-0 bg-accent" aria-hidden="true" />
                              {achievement}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </section>
      )}

      {/* Philosophy */}
      {philosophy.html && (
        <section className="border-t-2 border-t-ruby bg-primary py-20 text-primary-fg lg:py-28">
          <div className="container-page">
            <div className="grid gap-10 lg:grid-cols-12">
              <div className="lg:col-span-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-ruby-on-dark">{dict.about.philosophyLabel}</p>
                <p className="mt-3 text-xl tracking-tight">{dict.about.philosophyTitle}</p>
              </div>
              <div className="lg:col-span-9">
                <div
                  className="prose-editorial max-w-3xl text-primary-fg [&_blockquote]:border-white/30 [&_strong]:text-primary-fg [&_a]:text-primary-fg"
                  dangerouslySetInnerHTML={{ __html: philosophy.html }}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Goals */}
      {goals.html && (
        <section className="container-page py-16 lg:py-24">
          <SectionHeader index="06" label={dict.about.goalsLabel} title={dict.about.goalsTitle} />
          <div className="mt-10 grid gap-10 lg:grid-cols-12">
            <div
              className="prose-editorial lg:col-span-8"
              dangerouslySetInnerHTML={{ __html: goals.html }}
            />
            <div className="lg:col-span-4 lg:pl-4">
              <div className="border border-line bg-surface p-6">
                <p className="text-[13px] leading-relaxed text-muted">{dict.contact.description}</p>
                <Link href={localeHref(locale, "/contact")} className="btn btn-primary mt-5 w-full">
                  {dict.nav.contact}
                </Link>
                {profile?.resumeUrl && (
                  <a
                    href={profile.resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[11px] text-muted hover:text-ink"
                  >
                    {dict.about.downloadCv}
                    <span aria-hidden="true">↗</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
