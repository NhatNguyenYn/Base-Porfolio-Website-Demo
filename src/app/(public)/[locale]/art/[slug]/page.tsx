import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n";
import { alternateLocale, isLocale, localeHref, type Locale } from "@/i18n/config";
import { getArtworkDetail, incrementArtworkView, listArtworks } from "@/data/artworks";
import { getSettings } from "@/data/settings";
import { getSocialLinks } from "@/data/social";
import { getArtworkLocales } from "@/server/queries/artworks";
import { buildPageMetadata, safeSocialImage, socialImage, canonicalUrl, xHandleFromSocials } from "@/lib/seo";
import { absoluteUrl, formatDate, truncate } from "@/lib/utils";
import { serializeJsonLd } from "@/lib/json-ld";
import { buildBreadcrumbSchema, buildCreativeWorkSchema } from "@/lib/structured-data";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { ShareBar } from "@/components/site/share-bar";
import { prisma } from "@/server/db";
import { UntranslatedNotice } from "@/components/site/untranslated-notice";
import { ArtGallery } from "@/components/site/art-gallery";
import { Reveal } from "@/components/ui/reveal";

// The GitHub Pages demo build rewrites this to "force-static"
// (see .github/workflows/pages.yml); the full-stack build keeps it dynamic.
export const dynamic = "force-dynamic";

// Static-export build (GitHub Pages demo): enumerate every public artwork slug
// so its page can prerender. Ignored by the dynamic build.
export async function generateStaticParams() {
  const rows = await prisma.artwork.findMany({
    where: { visibility: "public", deletedAt: null },
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
  const { artwork } = await getArtworkDetail(slug, raw);
  if (!artwork) {
    return buildPageMetadata({
      locale: raw,
      path: `/art/${slug}`,
      title: raw === "vi" ? "Tác phẩm chưa có bản dịch" : "Artwork not available in English",
      description: raw === "vi" ? "Tác phẩm này chưa có bản dịch." : "This artwork is not available in this language.",
      siteName: settings.siteName,
      noindex: true,
    });
  }
  const available = await getArtworkLocales(slug);
  const xHandle = xHandleFromSocials(await getSocialLinks());

  return buildPageMetadata({
    locale: raw,
    path: `/art/${slug}`,
    title: artwork.title,
    description: truncate(artwork.description, 180),
    siteName: settings.siteName,
    availableLocales: available,
    image: artwork.image
      ? socialImage(artwork.image.url, artwork.image.alt || artwork.title, artwork.image.width, artwork.image.height)
      : null,
    twitterSite: xHandle,
    twitterCreator: xHandle,
    faviconUrl: settings.favicon?.url,
  });
}

export default async function ArtworkPage({
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

  const { status, artwork } = await getArtworkDetail(slug, locale);

  if (status === "not_found") notFound();

  if (status === "not_translated" || !artwork) {
    return (
      <UntranslatedNotice
        currentLocale={locale}
        alternate={alternateLocale(locale)}
        alternateHref={localeHref(alternateLocale(locale), `/art/${slug}`)}
        title={dict.art.notTranslatedTitle}
        text={dict.art.notTranslatedText}
        switchLabel={dict.langNotice.switch}
      />
    );
  }

  await incrementArtworkView(artwork.id);

  const siblings = artwork.collectionSlug
    ? (await listArtworks(locale, { collection: artwork.collectionSlug })).filter((item) => item.slug !== artwork.slug)
    : [];

  const width = artwork.image?.width ?? 1200;
  const height = artwork.image?.height ?? 1500;
  const artHref = localeHref(locale, "/art");
  const schemaCanonicalUrl = absoluteUrl(`/${locale}/art/${artwork.slug}`);
  const schemaImage = artwork.image
    ? safeSocialImage(
        socialImage(artwork.image.url, artwork.image.alt || artwork.title, artwork.image.width, artwork.image.height),
        settings.siteName,
      )
    : null;
  const crumbs = [
    { name: dict.nav.home, href: localeHref(locale, "/") },
    { name: dict.art.label, href: artHref },
    { name: artwork.title, href: `${artHref}/${artwork.slug}` },
  ];
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      buildBreadcrumbSchema(crumbs),
      buildCreativeWorkSchema({
        canonicalUrl: schemaCanonicalUrl,
        name: artwork.title,
        description: artwork.description,
        imageUrl: schemaImage?.url,
        datePublished: artwork.createdDate?.toISOString(),
        dateModified: artwork.updatedAt.toISOString(),
        type: "VisualArtwork",
        medium: artwork.medium,
        keywords: artwork.tags.map((tag) => tag.name),
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

      <div className="container-page mt-8 grid gap-10 lg:grid-cols-12 lg:gap-14">
        <Reveal className="lg:col-span-8" priority>
          <figure>
            <div
              className="relative w-full overflow-hidden border border-line bg-surface-muted"
              style={{ aspectRatio: `${width} / ${height}` }}
            >
              {artwork.image ? (
                <Image
                  src={artwork.image.url}
                  alt={artwork.image.alt || artwork.title}
                  fill
                  priority
                  sizes="(min-width: 1024px) 66vw, 94vw"
                  className="object-contain"
                />
              ) : (
                <span className="absolute inset-0 grid place-items-center serif-accent text-3xl text-muted">
                  {artwork.title}
                </span>
              )}
            </div>
            <figcaption className="mt-3 flex items-center justify-between gap-4 text-[10px] uppercase tracking-[0.14em] text-muted">
              <span>
                {artwork.medium || dict.art.imageAlt}
                {artwork.createdDate ? ` — ${formatDate(artwork.createdDate, locale)}` : ""}
              </span>
              {artwork.image && (
                <a
                  href={artwork.image.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4 hover:text-ink"
                >
                  {dict.common.viewFullscreen}
                </a>
              )}
            </figcaption>
          </figure>
        </Reveal>

        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-24">
            {artwork.collectionName && artwork.collectionSlug && (
              <Link
                href={`${localeHref(locale, "/art")}/collections/${artwork.collectionSlug}`}
                className="chip hover:border-ink hover:text-ink"
              >
                {artwork.collectionName}
              </Link>
            )}
            <h1 className="display mt-5 text-[clamp(2rem,3.6vw,2.9rem)]">{artwork.title}</h1>
            {artwork.categoryName && (
              <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-accent">{artwork.categoryName}</p>
            )}
            {artwork.description && (
              <p className="mt-6 whitespace-pre-line text-[14px] leading-[1.85] text-muted">{artwork.description}</p>
            )}

            <dl className="mt-8 divide-y divide-line border-y border-line text-[13px]">
              {artwork.medium && (
                <div className="flex items-baseline justify-between gap-4 py-3">
                  <dt className="text-[10px] uppercase tracking-[0.16em] text-muted">{dict.common.medium}</dt>
                  <dd className="text-right">{artwork.medium}</dd>
                </div>
              )}
              {artwork.createdDate && (
                <div className="flex items-baseline justify-between gap-4 py-3">
                  <dt className="text-[10px] uppercase tracking-[0.16em] text-muted">{dict.common.created}</dt>
                  <dd className="text-right tabular-nums">{formatDate(artwork.createdDate, locale)}</dd>
                </div>
              )}
              {artwork.tags.length > 0 && (
                <div className="flex items-baseline justify-between gap-4 py-3">
                  <dt className="text-[10px] uppercase tracking-[0.16em] text-muted">{dict.common.tags}</dt>
                  <dd className="flex flex-wrap justify-end gap-1.5">
                    {artwork.tags.map((tag) => (
                      <span key={tag.slug} className="chip">
                        {tag.name}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
            </dl>

            <div className="mt-8 border-t border-line pt-5">
              <ShareBar
                title={artwork.title}
                url={canonicalUrl(locale, `/art/${artwork.slug}`)}
                labels={{ share: dict.common.share, copy: dict.common.copyLink, copied: dict.common.copied }}
              />
            </div>

            <Link href={localeHref(locale, "/contact")} className="btn btn-outline mt-8 w-full">
              {dict.home.contactMe}
            </Link>
          </div>
        </aside>
      </div>

      {siblings.length > 0 && (
        <section className="container-page mt-20 border-t border-line pt-12 pb-24">
          <h2 className="label">{dict.art.moreFromCollection}</h2>
          <div className="mt-8">
            <ArtGallery
              artworks={siblings}
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
        </section>
      )}
    </article>
  );
}
