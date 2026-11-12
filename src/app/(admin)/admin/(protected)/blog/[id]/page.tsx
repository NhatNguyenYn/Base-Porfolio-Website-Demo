import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticleForAdmin, listCategories } from "@/server/queries/articles";
import { getMediaLibrary } from "@/server/queries/media-library";
import { toMediaView } from "@/server/queries/media";
import { PageHeader } from "@/components/admin/page-header";
import { ArticleForm, type ArticleFormInitial } from "@/components/admin/article-form";
import { Flash } from "@/components/admin/flash";

function toLocalDateTimeInput(value: Date | null): string {
  if (!value) return "";
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export default async function EditArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [article, categories, library] = await Promise.all([
    getArticleForAdmin(id),
    listCategories("vi"),
    getMediaLibrary(),
  ]);
  if (!article) notFound();

  const vi = article.translations.find((item) => item.locale === "vi");
  const en = article.translations.find((item) => item.locale === "en");

  const initial: ArticleFormInitial = {
    id: article.id,
    slug: article.slug,
    status: article.status,
    visibility: article.visibility,
    featured: article.featured,
    scheduledFor: toLocalDateTimeInput(article.scheduledFor),
    categoryId: article.categoryId ?? "",
    tags: article.tags.map((item) => item.tag.slug).join(", "),
    cover: toMediaView(article.coverMedia),
    vi: {
      title: vi?.title ?? "",
      subtitle: vi?.subtitle ?? "",
      excerpt: vi?.excerpt ?? "",
      content: vi?.content ?? "",
      seoTitle: vi?.seoTitle ?? "",
      seoDescription: vi?.seoDescription ?? "",
    },
    en: {
      title: en?.title ?? "",
      subtitle: en?.subtitle ?? "",
      excerpt: en?.excerpt ?? "",
      content: en?.content ?? "",
      seoTitle: en?.seoTitle ?? "",
      seoDescription: en?.seoDescription ?? "",
    },
  };

  return (
    <>
      <PageHeader
        title={vi?.title ?? en?.title ?? article.slug}
        description={`/${article.slug} · ${article.readingMinutes} phút đọc`}
        back={{ href: "/admin/blog", label: "Danh sách bài viết" }}
        actions={
          <>
            <Link
              href={`/preview/article/${article.id}?locale=vi`}
              target="_blank"
              className="btn btn-outline btn-sm"
            >
              Xem trước
            </Link>
            {article.status === "published" && (
              <Link href={`/vi/blog/${article.slug}`} target="_blank" className="btn btn-outline btn-sm">
                Xem bài viết
              </Link>
            )}
          </>
        }
      />

      {query.saved && <Flash message="Đã lưu bài viết." />}
      <ArticleForm
        initial={initial}
        categories={categories.map((category) => ({ id: category.id, name: category.name }))}
        library={library}
      />
    </>
  );
}
