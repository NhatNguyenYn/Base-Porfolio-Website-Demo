import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n";
import { isLocale, localeHref, type Locale } from "@/i18n/config";
import { listArtworks, listCollections } from "@/data/artworks";
import { getSettings } from "@/data/settings";
import { getSocialLinks } from "@/data/social";
import { buildPageMetadata, xHandleFromSocials } from "@/lib/seo";
import { absoluteUrl } from "@/lib/utils";
import { serializeJsonLd } from "@/lib/json-ld";
import { buildBreadcrumbSchema, buildCollectionPageSchema, buildItemListSchema } from "@/lib/structured-data";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { PageHero } from "@/components/site/page-hero";
import { ArtGallery } from "@/components/site/art-gallery";
import { Reveal } from "@/components/ui/reveal";

// The GitHub Pages demo build rewrites this to "force-static"
// (see .github/workflows/pages.yml); the full-stack build keeps it dynamic.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const dict = getDictionary(raw);
  const settings = await getSettings();
  const xHandle = xHandleFromSocials(await getSocialLinks());
  return buildPageMetadata({
    locale: raw,
    path: "/art",
    title: dict.art.title,
    description: dict.art.description,
    siteName: settings.siteName,
    twitterSite: xHandle,
    twitterCreator: xHandle,
    faviconUrl: settings.favicon?.url,
  });
}

export default async function ArtPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);

  const [artworks, collections] = await Promise.all([listArtworks(locale), listCollections(locale)]);
  const artHref = localeHref(locale, "/art");
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const crumbs = [
    { name: dict.nav.home, href: localeHref(locale, "/") },
    { name: dict.art.label, href: artHref },
  ];
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      buildBreadcrumbSchema(crumbs),
      buildCollectionPageSchema({ pageUrl: artHref, name: dict.art.title, description: dict.art.description }),
      buildItemListSchema({
        id: `${absoluteUrl(artHref)}#artworks`,
        items: artworks.map((artwork) => ({ name: artwork.title, url: `${artHref}/${artwork.slug}` })),
      }),
    ],
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
        label={dict.art.label}
        title={dict.art.title}
        description={dict.art.description}
        meta={[
          { label: dict.art.allWorks, value: String(artworks.length).padStart(2, "0") },
          ...(collections.length
            ? [{ label: dict.art.collections, value: String(collections.length).padStart(2, "0") }]
            : []),
        ]}
      />

      {collections.length > 0 && (
        <section className="container-page pb-14">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {collections.slice(0, 3).map((collection, index) => (
              <Reveal key={collection.id} delay={index * 60}>
                <Link
                  href={`${artHref}/collections/${collection.slug}`}
                  className="group flex items-center gap-4 border border-line bg-surface p-3"
                >
                  <div className="relative h-20 w-24 shrink-0 overflow-hidden bg-surface-muted">
                    {collection.cover ? (
                      <Image
                        src={collection.cover.url}
                        alt={collection.cover.alt || collection.name}
                        fill
                        sizes="96px"
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <span className="absolute inset-0 grid place-items-center serif-accent text-muted">
                        {collection.name.slice(0, 1)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-muted">
                      {collection.count} {dict.art.collectionCount}
                    </p>
                    <p className="mt-1 truncate text-[15px] tracking-tight">{collection.name}</p>
                    <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted">
                      {collection.description}
                    </p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <section className="container-page pb-24">
        {artworks.length > 0 ? (
          <ArtGallery
            artworks={artworks}
            collections={collections}
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
        ) : (
          <div className="border border-dashed border-line px-6 py-20 text-center">
            <p className="text-lg tracking-tight">{dict.art.emptyTitle}</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">{dict.art.emptyText}</p>
          </div>
        )}
      </section>
    </>
  );
}
