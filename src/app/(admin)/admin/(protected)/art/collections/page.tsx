import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCollectionForAdmin,
  listCollectionsForAdmin,
} from "@/server/queries/artworks";
import { deleteCollectionAction } from "@/server/actions/artworks";
import { getMediaLibrary } from "@/server/queries/media-library";
import { toMediaView } from "@/server/queries/media";
import { assetUrl } from "@/lib/asset";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable } from "@/components/admin/data-table";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { Flash } from "@/components/admin/flash";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  CollectionForm,
  emptyCollection,
  type CollectionFormInitial,
} from "@/components/admin/collection-form";

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; saved?: string; deleted?: string }>;
}) {
  const query = await searchParams;
  const [collections, library] = await Promise.all([listCollectionsForAdmin(), getMediaLibrary()]);

  let editing: CollectionFormInitial | null = null;
  if (query.edit) {
    const row = await getCollectionForAdmin(query.edit);
    if (!row) notFound();
    const vi = row.translations.find((item) => item.locale === "vi");
    const en = row.translations.find((item) => item.locale === "en");
    editing = {
      id: row.id,
      slug: row.slug,
      cover: toMediaView(row.coverMedia),
      featured: row.featured,
      visibility: row.visibility,
      order: row.order,
      vi: { name: vi?.name ?? "", description: vi?.description ?? "" },
      en: { name: en?.name ?? "", description: en?.description ?? "" },
    };
  }

  return (
    <>
      <PageHeader
        title="Bộ sưu tập"
        description="Nhóm các tác phẩm thành bộ sưu tập có câu chuyện riêng. Bộ sưu tập công khai hiển thị trong góc nghệ thuật số."
        back={{ href: "/admin/art", label: "Danh sách tác phẩm" }}
      />

      {query.saved && <Flash message="Đã lưu bộ sưu tập." />}
      {query.deleted && <Flash message="Đã xoá bộ sưu tập (các tác phẩm vẫn được giữ lại)." />}

      <section className="mb-8 border border-line bg-surface p-5">
        <h2 className="mb-4 text-[13px] font-medium">
          {editing ? "Chỉnh sửa bộ sưu tập" : "Tạo bộ sưu tập mới"}
        </h2>
        <CollectionForm
          initial={editing ?? emptyCollection}
          library={library}
          onCancelHref={editing ? "/admin/art/collections" : undefined}
        />
      </section>

      <DataTable
        columns={[
          { key: "collection", label: "Bộ sưu tập" },
          { key: "count", label: "Tác phẩm", className: "w-24" },
          { key: "visibility", label: "Hiển thị" },
          { key: "order", label: "Thứ tự", className: "w-16" },
          { key: "actions", label: "", className: "text-right" },
        ]}
        rows={collections.map((collection) => {
          const vi = collection.translations.find((item) => item.locale === "vi");
          const en = collection.translations.find((item) => item.locale === "en");
          return {
            id: collection.id,
            cells: {
              collection: (
                <div className="flex items-center gap-3">
                  <div className="relative h-10 w-14 shrink-0 overflow-hidden border border-line bg-surface-muted">
                    {collection.coverMedia ? (
                      <Image src={assetUrl(collection.coverMedia.url)} alt="" fill sizes="56px" className="object-cover" />
                    ) : (
                      <span className="grid h-full place-items-center text-[9px] text-muted">—</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px]">{vi?.name ?? en?.name ?? collection.slug}</p>
                    <p className="truncate font-mono text-[10px] text-muted">/{collection.slug}</p>
                  </div>
                </div>
              ),
              count: <span className="tabular-nums text-[12px]">{collection._count.artworks}</span>,
              visibility: <StatusBadge status={collection.visibility} />,
              order: <span className="tabular-nums text-[11px] text-muted">{collection.order}</span>,
              actions: (
                <div className="flex items-center justify-end gap-1.5">
                  <Link
                    href={`/admin/art/collections?edit=${collection.id}`}
                    className="rounded-full border border-line px-2.5 py-1 text-[10.5px] text-muted transition-colors hover:border-ink hover:text-ink"
                  >
                    Sửa
                  </Link>
                  <form action={deleteCollectionAction}>
                    <input type="hidden" name="id" value={collection.id} />
                    <ConfirmSubmit
                      title={`Xoá bộ sưu tập “${vi?.name ?? en?.name ?? collection.slug}”?`}
                      description="Bộ sưu tập sẽ bị ẩn. Các tác phẩm bên trong vẫn được giữ lại và trở về trạng thái không thuộc bộ sưu tập."
                      triggerLabel="Xoá"
                      confirmLabel="Xoá bộ sưu tập"
                    />
                  </form>
                </div>
              ),
            },
          };
        })}
        empty="Chưa có bộ sưu tập nào."
      />
    </>
  );
}
