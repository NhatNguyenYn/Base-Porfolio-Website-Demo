import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getArtworkForAdmin,
  listArtworkCategoriesForAdmin,
  listCollectionsForAdmin,
} from "@/server/queries/artworks";
import { getMediaLibrary } from "@/server/queries/media-library";
import { toMediaView } from "@/server/queries/media";
import { PageHeader } from "@/components/admin/page-header";
import { ArtworkForm, type ArtworkFormInitial } from "@/components/admin/artwork-form";
import { Flash } from "@/components/admin/flash";

export default async function EditArtworkPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [artwork, collections, categories, library] = await Promise.all([
    getArtworkForAdmin(id),
    listCollectionsForAdmin(),
    listArtworkCategoriesForAdmin(),
    getMediaLibrary(),
  ]);
  if (!artwork) notFound();

  const vi = artwork.translations.find((item) => item.locale === "vi");
  const en = artwork.translations.find((item) => item.locale === "en");

  const initial: ArtworkFormInitial = {
    id: artwork.id,
    slug: artwork.slug,
    image: toMediaView(artwork.imageMedia),
    collectionId: artwork.collectionId ?? "",
    categoryId: artwork.categoryId ?? "",
    medium: artwork.medium ?? "",
    createdDate: artwork.createdDate ? artwork.createdDate.toISOString().slice(0, 10) : "",
    featured: artwork.featured,
    visibility: artwork.visibility,
    order: artwork.order,
    tags: artwork.tags.map((item) => item.tag.slug).join(", "),
    vi: { title: vi?.title ?? "", description: vi?.description ?? "" },
    en: { title: en?.title ?? "", description: en?.description ?? "" },
  };

  return (
    <>
      <PageHeader
        title={vi?.title ?? en?.title ?? artwork.slug}
        description={`/${artwork.slug} · ${artwork.viewCount} lượt xem`}
        back={{ href: "/admin/art", label: "Danh sách tác phẩm" }}
        actions={
          <>
            <Link href={`/preview/artwork/${artwork.id}?locale=vi`} target="_blank" className="btn btn-outline btn-sm">
              Xem trước
            </Link>
            {artwork.visibility === "public" && (
              <Link href={`/vi/art/${artwork.slug}`} target="_blank" className="btn btn-outline btn-sm">
                Xem trên website
              </Link>
            )}
          </>
        }
      />

      {query.saved && <Flash message="Đã lưu tác phẩm." />}
      <ArtworkForm
        initial={initial}
        collections={collections.map((collection) => ({
          id: collection.id,
          name: collection.translations.find((item) => item.locale === "vi")?.name ?? collection.slug,
        }))}
        categories={categories}
        library={library}
      />
    </>
  );
}
