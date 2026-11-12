import Link from "next/link";
import { notFound } from "next/navigation";
import { listCategoriesForAdmin, listTagsForAdmin } from "@/server/queries/articles";
import {
  deleteCategoryAction,
  deleteTagAction,
  saveCategoryAction,
} from "@/server/actions/articles";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable } from "@/components/admin/data-table";
import { ActionForm } from "@/components/admin/action-form";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { Flash } from "@/components/admin/flash";
import { LocaleTabs } from "@/components/admin/locale-tabs";

export default async function TaxonomyPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; saved?: string; deleted?: string }>;
}) {
  const query = await searchParams;
  const [categories, tags] = await Promise.all([listCategoriesForAdmin(), listTagsForAdmin()]);

  let editing = null as null | (typeof categories)[number];
  if (query.edit) {
    editing = categories.find((category) => category.id === query.edit) ?? null;
    if (!editing) notFound();
  }

  const vi = editing?.translations.find((item) => item.locale === "vi");
  const en = editing?.translations.find((item) => item.locale === "en");

  return (
    <>
      <PageHeader
        title="Danh mục & thẻ"
        description="Danh mục dùng để phân loại bài viết và tác phẩm. Thẻ được tạo tự động khi gán trong bài viết hoặc tác phẩm."
        actions={
          <Link href="/admin/blog" className="btn btn-outline btn-sm">
            Về danh sách bài viết
          </Link>
        }
      />

      {query.saved && <Flash message="Đã lưu danh mục." />}
      {query.deleted && <Flash message="Đã xoá. Nội dung liên quan vẫn được giữ lại." />}

      <section className="mb-8 border border-line bg-surface p-5">
        <h2 className="mb-4 text-[13px] font-medium">
          {editing ? `Chỉnh sửa danh mục: ${vi?.name ?? en?.name ?? editing.slug}` : "Tạo danh mục mới"}
        </h2>
        <ActionForm
          action={saveCategoryAction}
          submitLabel={editing ? "Lưu danh mục" : "Tạo danh mục"}
          hint="Danh mục tiếng Việt là bắt buộc."
        >
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
            <LocaleTabs
              vi={
                <div className="space-y-4">
                  <div>
                    <label className="field-label" htmlFor="cat-vi-name">
                      Tên danh mục (VI) *
                    </label>
                    <input
                      id="cat-vi-name"
                      name="vi.name"
                      defaultValue={vi?.name ?? ""}
                      maxLength={120}
                      className="field"
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="cat-vi-desc">
                      Mô tả (VI)
                    </label>
                    <textarea
                      id="cat-vi-desc"
                      name="vi.description"
                      defaultValue={vi?.description ?? ""}
                      rows={3}
                      className="field"
                    />
                  </div>
                </div>
              }
              en={
                <div className="space-y-4">
                  <div>
                    <label className="field-label" htmlFor="cat-en-name">
                      Category name (EN)
                    </label>
                    <input
                      id="cat-en-name"
                      name="en.name"
                      defaultValue={en?.name ?? ""}
                      maxLength={120}
                      className="field"
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="cat-en-desc">
                      Description (EN)
                    </label>
                    <textarea
                      id="cat-en-desc"
                      name="en.description"
                      defaultValue={en?.description ?? ""}
                      rows={3}
                      className="field"
                    />
                  </div>
                </div>
              }
            />
            <div className="space-y-4">
              <div>
                <label className="field-label" htmlFor="kind">
                  Loại danh mục
                </label>
                <select id="kind" name="kind" defaultValue={editing?.kind ?? "article"} className="field">
                  <option value="article">Bài viết</option>
                  <option value="artwork">Tác phẩm</option>
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="cat-slug">
                  Slug
                </label>
                <input
                  id="cat-slug"
                  name="slug"
                  defaultValue={editing?.slug ?? ""}
                  className="field font-mono text-[12px]"
                  placeholder="tu-dong-tao"
                />
              </div>
              {editing && (
                <Link href="/admin/taxonomy" className="text-[11px] text-muted underline underline-offset-4 hover:text-ink">
                  Huỷ chỉnh sửa
                </Link>
              )}
            </div>
          </div>
        </ActionForm>
      </section>

      <h2 className="mb-3 text-[13px] font-medium">Danh mục</h2>
      <DataTable
        columns={[
          { key: "name", label: "Tên" },
          { key: "kind", label: "Loại" },
          { key: "count", label: "Số bài viết", className: "w-24" },
          { key: "actions", label: "", className: "text-right" },
        ]}
        rows={categories.map((category) => {
          const name = category.translations.find((item) => item.locale === "vi")?.name;
          const nameEn = category.translations.find((item) => item.locale === "en")?.name;
          return {
            id: category.id,
            cells: {
              name: (
                <div>
                  <p className="text-[12.5px]">{name ?? nameEn ?? category.slug}</p>
                  <p className="font-mono text-[10px] text-muted">/{category.slug}</p>
                </div>
              ),
              kind: (
                <span className="text-[11px] text-muted">{category.kind === "article" ? "Bài viết" : "Tác phẩm"}</span>
              ),
              count: <span className="tabular-nums text-[12px]">{category._count.articles}</span>,
              actions: (
                <div className="flex items-center justify-end gap-1.5">
                  <Link
                    href={`/admin/taxonomy?edit=${category.id}`}
                    className="rounded-full border border-line px-2.5 py-1 text-[10.5px] text-muted hover:border-ink hover:text-ink"
                  >
                    Sửa
                  </Link>
                  <form action={deleteCategoryAction}>
                    <input type="hidden" name="id" value={category.id} />
                    <ConfirmSubmit
                      title={`Xoá danh mục “${name ?? nameEn ?? category.slug}”?`}
                      description="Bài viết thuộc danh mục này sẽ trở về trạng thái chưa phân loại."
                      triggerLabel="Xoá"
                      confirmLabel="Xoá danh mục"
                    />
                  </form>
                </div>
              ),
            },
          };
        })}
        empty="Chưa có danh mục nào."
      />

      <h2 className="mb-3 mt-8 text-[13px] font-medium">Thẻ</h2>
      <DataTable
        columns={[
          { key: "name", label: "Thẻ" },
          { key: "articles", label: "Bài viết", className: "w-24" },
          { key: "artworks", label: "Tác phẩm", className: "w-24" },
          { key: "actions", label: "", className: "text-right" },
        ]}
        rows={tags.map((tag) => ({
          id: tag.id,
          cells: {
            name: (
              <div>
                <p className="text-[12.5px]">{tag.name}</p>
                <p className="font-mono text-[10px] text-muted">/{tag.slug}</p>
              </div>
            ),
            articles: <span className="tabular-nums text-[12px]">{tag._count.articles}</span>,
            artworks: <span className="tabular-nums text-[12px]">{tag._count.artworks}</span>,
            actions: (
              <form action={deleteTagAction} className="flex justify-end">
                <input type="hidden" name="id" value={tag.id} />
                <ConfirmSubmit
                  title={`Xoá thẻ “${tag.name}”?`}
                  description="Thẻ sẽ bị gỡ khỏi mọi bài viết và tác phẩm."
                  triggerLabel="Xoá"
                  confirmLabel="Xoá thẻ"
                />
              </form>
            ),
          },
        }))}
        empty="Chưa có thẻ nào."
      />
    </>
  );
}
