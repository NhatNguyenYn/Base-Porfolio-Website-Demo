import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n";
import { isLocale, type Locale } from "@/i18n/config";
import { getProfile } from "@/data/profile";
import { getSocialLinks } from "@/data/social";
import { getSettings } from "@/data/settings";
import { buildPageMetadata } from "@/lib/seo";
import { PageHero } from "@/components/site/page-hero";
import { ContactForm } from "@/components/site/contact-form";
import { SocialLinks } from "@/components/site/social-links";
import { Reveal } from "@/components/ui/reveal";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const dict = getDictionary(raw);
  const settings = await getSettings();
  return buildPageMetadata({
    locale: raw,
    path: "/contact",
    title: dict.contact.label,
    description: dict.contact.description,
    siteName: settings.siteName,
  });
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);

  const [settings, profile, socials] = await Promise.all([getSettings(), getProfile(), getSocialLinks()]);
  const content = profile?.translations.find((item) => item.locale === locale) ?? null;
  const email = profile?.email || settings.contactEmail;
  const location = settings.contactLocation || profile?.location || "";

  return (
    <>
      <PageHero
        label={dict.contact.label}
        title={dict.contact.title}
        description={dict.contact.description}
        meta={[
          { label: dict.contact.availabilityLabel, value: profile?.availableForWork === false ? dict.home.unavailable : dict.home.availability },
        ]}
      />

      <section className="container-page pb-24">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <Reveal className="lg:col-span-5">
            <div className="space-y-8">
              <div className="border-t border-line pt-5">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted">{dict.contact.emailLabel}</p>
                <a
                  href={`mailto:${email}`}
                  className="serif-accent mt-3 inline-block text-[clamp(1.3rem,2.4vw,1.9rem)] leading-tight underline decoration-line-strong decoration-1 underline-offset-8 transition-colors hover:text-accent"
                >
                  {email}
                </a>
              </div>

              {location && (
                <div className="border-t border-line pt-5">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted">{dict.contact.locationLabel}</p>
                  <p className="mt-3 text-[15px]">{location}</p>
                </div>
              )}

              {content?.title && (
                <div className="border-t border-line pt-5">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted">{dict.common.role}</p>
                  <p className="mt-3 text-[15px]">{content.title}</p>
                </div>
              )}

              <div className="border-t border-line pt-5">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted">{dict.contact.socialLabel}</p>
                <SocialLinks links={socials} className="mt-4" />
              </div>

              <div className="border-t border-line pt-5">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted">{dict.contact.availabilityLabel}</p>
                <p className="mt-3 flex items-center gap-2 text-[14px]">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${profile?.availableForWork === false ? "bg-muted" : "bg-accent"}`}
                    aria-hidden="true"
                  />
                  {profile?.availableForWork === false ? dict.home.unavailable : dict.home.availability}
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={80} className="lg:col-span-7">
            <ContactForm dict={dict} startedAt={Date.now()} />
          </Reveal>
        </div>
      </section>
    </>
  );
}
