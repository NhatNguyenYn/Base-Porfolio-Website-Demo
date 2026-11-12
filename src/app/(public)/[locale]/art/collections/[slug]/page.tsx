import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n";
import { isLocale, localeHref, type Locale } from "@/i18n/config";
import { getCollection } from "@/data/artworks";
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
  const { collection } = await getCollection(slug, raw);
  if (!collection) return { title: "404" };
  return {
    title: collection.name,
    description: collection.description,
    alternates: {
      canonical: `/${raw}/art/collections/${slug}`,
      languages: {
        vi: `/vi/art/collections/${slug}`,
        en: `/en/art/collections/${slug}`,
        "x-default": `/vi/art/collections/${slug}`,
      },
    },
  };
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

  const { collection, artworks } = await getCollection(slug, locale);
  if (!collection) notFound();

  return (
    <>
      <div className="container-page pt-10">
        <Link href={localeHref(locale, "/art")} className="link-arrow text-muted hover:text-ink">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
          {dict.common.backToGallery}
        </Link>
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
