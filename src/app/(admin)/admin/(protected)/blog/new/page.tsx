import { listCategories } from "@/server/queries/articles";
import { getMediaLibrary } from "@/server/queries/media-library";
import { PageHeader } from "@/components/admin/page-header";
import { ArticleForm, emptyArticle } from "@/components/admin/article-form";

export default async function NewArticlePage() {
  const [categories, library] = await Promise.all([listCategories("vi"), getMediaLibrary()]);

  return (
    <>
      <PageHeader
        title="Bài viết mới"
        description="Viết nội dung bằng Markdown. Lưu nháp trước, xuất bản sau — hoặc hẹn giờ xuất bản."
        back={{ href: "/admin/blog", label: "Danh sách bài viết" }}
      />
      <ArticleForm
        initial={emptyArticle}
        categories={categories.map((category) => ({ id: category.id, name: category.name }))}
        library={library}
      />
    </>
  );
}
