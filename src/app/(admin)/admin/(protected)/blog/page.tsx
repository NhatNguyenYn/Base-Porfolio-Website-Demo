import Link from "next/link";
import { Plus } from "lucide-react";
import { listArticlesForAdmin } from "@/server/queries/articles";
import { deleteArticleAction, toggleArticleFeaturedAction } from "@/server/actions/articles";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { Flash } from "@/components/admin/flash";
import { Pagination } from "@/components/site/pagination";
import { formatShortDate, paginate, totalPages } from "@/lib/utils";

function statusOf(article: { status: string; publishedAt: Date | null }): string {
  if (article.status === "published" && article.publishedAt && article.publishedAt.getTime() > Date.now()) {
    return "scheduled";
  }
  return article.status;
}

export default async function AdminBlogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; saved?: string; deleted?: string }>;
}) {
  const query = await searchParams;
  const articles = await listArticlesForAdmin();
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const pages = totalPages(articles.length, 20);
  const items = paginate(articles, Math.min(page, pages), 20);

  return (
    <>
      <PageHeader
        title="Bài viết"
        description="Tạo, chỉnh sửa, hẹn giờ xuất bản và lưu trữ bài viết. Mỗi bài có bản tiếng Việt và tiếng Anh riêng."
        actions={
          <>
            <Link href="/admin/taxonomy" className="btn btn-outline btn-sm">
              Danh mục & thẻ
            </Link>
            <Link href="/admin/blog/new" className="btn btn-primary btn-sm">
              <Plus size={12} aria-hidden="true" />
              Bài viết mới
            </Link>
          </>
        }
      />

      {query.saved && <Flash message="Đã lưu bài viết." />}
      {query.deleted && <Flash message="Đã chuyển bài viết vào trạng thái xoá mềm." />}

      <DataTable
        columns={[
          { key: "title", label: "Bài viết" },
          { key: "status", label: "Trạng thái" },
          { key: "category", label: "Danh mục" },
          { key: "locales", label: "Ngôn ngữ" },
          { key: "updated", label: "Cập nhật" },
          { key: "actions", label: "", className: "text-right" },
        ]}
        rows={items.map((article) => {
          const vi = article.translations.find((item) => item.locale === "vi");
          const en = article.translations.find((item) => item.locale === "en");
          const category = article.category?.translations.find((item) => item.locale === "vi")?.name;
          return {
            id: article.id,
            cells: {
              title: (
                <div className="min-w-0 max-w-[360px]">
                  <Link href={`/admin/blog/${article.id}`} className="block truncate text-[12.5px] hover:underline">
                    {vi?.title ?? en?.title ?? "(chưa có tiêu đề)"}
                  </Link>
                  <p className="truncate font-mono text-[10px] text-muted">/{article.slug}</p>
                </div>
              ),
              status: <StatusBadge status={statusOf(article)} />,
              category: <span className="text-[11.5px] text-muted">{category ?? "—"}</span>,
              locales: (
                <div className="flex items-center gap-1">
                  <span className={`chip ${vi ? "" : "opacity-40"}`}>VI</span>
                  <span className={`chip ${en ? "" : "opacity-40"}`}>EN</span>
                </div>
              ),
              updated: <span className="text-[11px] text-muted">{formatShortDate(article.updatedAt, "vi")}</span>,
              actions: (
                <div className="flex items-center justify-end gap-1.5">
                  <form action={toggleArticleFeaturedAction}>
                    <input type="hidden" name="id" value={article.id} />
                    <button
                      type="submit"
                      className="rounded-full border border-line px-2.5 py-1 text-[10.5px] text-muted transition-colors hover:border-ink hover:text-ink"
                    >
                      {article.featured ? "Bỏ nổi bật" : "Nổi bật"}
                    </button>
                  </form>
                  <Link
                    href={`/admin/blog/${article.id}`}
                    className="rounded-full border border-line px-2.5 py-1 text-[10.5px] text-muted transition-colors hover:border-ink hover:text-ink"
                  >
                    Sửa
                  </Link>
                  <form action={deleteArticleAction}>
                    <input type="hidden" name="id" value={article.id} />
                    <ConfirmSubmit
                      title={`Xoá bài viết “${vi?.title ?? en?.title ?? article.slug}”?`}
                      description="Bài viết sẽ bị ẩn khỏi website (xoá mềm) nhưng vẫn còn trong cơ sở dữ liệu."
                      triggerLabel="Xoá"
                      confirmLabel="Xoá bài viết"
                    />
                  </form>
                </div>
              ),
            },
          };
        })}
        empty="Chưa có bài viết nào."
      />

      <Pagination
        page={Math.min(page, pages)}
        pages={pages}
        basePath="/admin/blog"
        params={{}}
        labels={{ previous: "Trước", next: "Sau", page: "Trang", of: "/" }}
      />
    </>
  );
}
