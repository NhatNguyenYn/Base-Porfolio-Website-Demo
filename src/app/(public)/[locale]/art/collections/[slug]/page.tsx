import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n";
import { isLocale, localeHref, type Locale } from "@/i18n/config";
import { getCollection } from "@/data/artworks";
import { getSettings } from "@/data/settings";
import { getCollectionLocales } from "@/server/queries/artworks";
import { buildPageMetadata, socialImage } from "@/lib/seo";
import { serializeJsonLd } from "@/lib/json-ld";
import { buildBreadcrumbSchema } from "@/lib/structured-data";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { PageHero } from "@/components/site/page-hero";
import { ArtGallery } from "@/components/site/art-gallery";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) return {};
  const dict = getDictionary(raw);
  const settings = await getSettings();
  const { collection } = await getCollection(slug, raw);
  if (!collection) {
    return buildPageMetadata({
      locale: raw,
      path: `/art/collections/${slug}`,
      title: dict.notFound.title,
      description: dict.notFound.text,
      siteName: settings.siteName,
      noindex: true,
    });
  }
  const available = await getCollectionLocales(slug);
  return buildPageMetadata({
    locale: raw,
    path: `/art/collections/${slug}`,
    title: collection.name,
    description: collection.description,
    siteName: settings.siteName,
    availableLocales: available,
    image: collection.cover
      ? socialImage(collection.cover.url, collection.cover.alt || collection.name, collection.cover.width, collection.cover.height)
      : null,
  });
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  const { collection, artworks } = await getCollection(slug, locale);
  if (!collection) notFound();
  const artHref = localeHref(locale, "/art");
  const collectionHref = `${artHref}/collections/${collection.slug}`;
  const crumbs = [
    { name: dict.nav.home, href: localeHref(locale, "/") },
    { name: dict.art.label, href: artHref },
    { name: collection.name, href: collectionHref },
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
      <div className="container-page pt-10">
        <Breadcrumbs items={crumbs} label={dict.common.breadcrumb} />
      </div>

      <PageHero
        label={dict.art.collections}
        title={collection.name}
        description={collection.description}
        meta={[{ label: dict.art.allWorks, value: String(collection.count).padStart(2, "0") }]}
      />

      <section className="container-page pb-24">
        {artworks.length > 0 ? (
          <ArtGallery
            artworks={artworks}
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
        ) : (
          <p className="border border-dashed border-line px-6 py-16 text-center text-sm text-muted">
            {dict.art.emptyTitle}
          </p>
        )}
      </section>
    </>
  );
}
