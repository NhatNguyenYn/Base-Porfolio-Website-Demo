import {
  listArtworkCategoriesForAdmin,
  listCollectionsForAdmin,
} from "@/server/queries/artworks";
import { getMediaLibrary } from "@/server/queries/media-library";
import { PageHeader } from "@/components/admin/page-header";
import { ArtworkForm, emptyArtwork } from "@/components/admin/artwork-form";

export default async function NewArtworkPage() {
  const [collections, categories, library] = await Promise.all([
    listCollectionsForAdmin(),
    listArtworkCategoriesForAdmin(),
    getMediaLibrary(),
  ]);

  return (
    <>
      <PageHeader
        title="Tải tác phẩm"
        description="Chọn ảnh, nhập tiêu đề và mô tả, chọn bộ sưu tập rồi lưu. Tác phẩm công khai xuất hiện ngay trong phòng tranh."
        back={{ href: "/admin/art", label: "Danh sách tác phẩm" }}
      />
      <ArtworkForm
        initial={emptyArtwork}
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
