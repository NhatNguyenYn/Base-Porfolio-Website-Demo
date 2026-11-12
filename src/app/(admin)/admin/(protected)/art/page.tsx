import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { listArtworksForAdmin } from "@/server/queries/artworks";
import {
  deleteArtworkAction,
  moveArtworkAction,
  toggleArtworkFeaturedAction,
} from "@/server/actions/artworks";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { Flash } from "@/components/admin/flash";
import { Pagination } from "@/components/site/pagination";
import { paginate, totalPages } from "@/lib/utils";

export default async function AdminArtPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; saved?: string; deleted?: string }>;
}) {
  const query = await searchParams;
  const artworks = await listArtworksForAdmin();
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const pages = totalPages(artworks.length, 20);
  const items = paginate(artworks, Math.min(page, pages), 20);

  return (
    <>
      <PageHeader
        title="Tác phẩm"
        description="Tải tranh lên, viết mô tả song ngữ, sắp xếp thứ tự trưng bày và chọn tác phẩm nổi bật."
        actions={
          <>
            <Link href="/admin/art/collections" className="btn btn-outline btn-sm">
              Bộ sưu tập
            </Link>
            <Link href="/admin/art/new" className="btn btn-primary btn-sm">
              <Plus size={12} aria-hidden="true" />
              Tải tác phẩm
            </Link>
          </>
        }
      />

      {query.saved && <Flash message="Đã lưu tác phẩm." />}
      {query.deleted && <Flash message="Đã chuyển tác phẩm vào trạng thái xoá mềm." />}

      <DataTable
        columns={[
          { key: "artwork", label: "Tác phẩm" },
          { key: "collection", label: "Bộ sưu tập" },
          { key: "order", label: "Thứ tự", className: "w-24" },
          { key: "featured", label: "Nổi bật" },
          { key: "visibility", label: "Hiển thị" },
          { key: "actions", label: "", className: "text-right" },
        ]}
        rows={items.map((artwork) => {
          const vi = artwork.translations.find((item) => item.locale === "vi");
          const en = artwork.translations.find((item) => item.locale === "en");
          const collection = artwork.collection?.translations.find((item) => item.locale === "vi")?.name;
          return {
            id: artwork.id,
            cells: {
              artwork: (
                <div className="flex items-center gap-3">
                  <div className="relative h-14 w-11 shrink-0 overflow-hidden border border-line bg-surface-muted">
                    <Image src={artwork.imageMedia.url} alt="" fill sizes="44px" className="object-cover" />
                  </div>
                  <div className="min-w-0">
                    <Link href={`/admin/art/${artwork.id}`} className="block truncate text-[12.5px] hover:underline">
                      {vi?.title ?? en?.title ?? artwork.slug}
                    </Link>
                    <p className="truncate font-mono text-[10px] text-muted">/{artwork.slug}</p>
                  </div>
                </div>
              ),
              collection: <span className="text-[11.5px] text-muted">{collection ?? "—"}</span>,
              order: (
                <div className="flex items-center gap-1">
                  <form action={moveArtworkAction}>
                    <input type="hidden" name="id" value={artwork.id} />
                    <input type="hidden" name="direction" value="up" />
                    <button
                      type="submit"
                      className="grid h-6 w-6 place-items-center rounded-full border border-line text-muted hover:text-ink"
                      aria-label="Đưa lên trước"
                    >
                      <ArrowUp size={11} />
                    </button>
                  </form>
                  <span className="w-5 text-center text-[11px] tabular-nums text-muted">{artwork.order}</span>
                  <form action={moveArtworkAction}>
                    <input type="hidden" name="id" value={artwork.id} />
                    <input type="hidden" name="direction" value="down" />
                    <button
                      type="submit"
                      className="grid h-6 w-6 place-items-center rounded-full border border-line text-muted hover:text-ink"
                      aria-label="Đưa xuống sau"
                    >
                      <ArrowDown size={11} />
                    </button>
                  </form>
                </div>
              ),
              featured: artwork.featured ? <StatusBadge status="featured" label="Nổi bật" /> : <span className="text-muted">—</span>,
              visibility: <StatusBadge status={artwork.visibility} />,
              actions: (
                <div className="flex items-center justify-end gap-1.5">
                  <form action={toggleArtworkFeaturedAction}>
                    <input type="hidden" name="id" value={artwork.id} />
                    <button
                      type="submit"
                      className="rounded-full border border-line px-2.5 py-1 text-[10.5px] text-muted transition-colors hover:border-ink hover:text-ink"
                    >
                      {artwork.featured ? "Bỏ nổi bật" : "Nổi bật"}
                    </button>
                  </form>
                  <Link
                    href={`/admin/art/${artwork.id}`}
                    className="rounded-full border border-line px-2.5 py-1 text-[10.5px] text-muted transition-colors hover:border-ink hover:text-ink"
                  >
                    Sửa
                  </Link>
                  <form action={deleteArtworkAction}>
                    <input type="hidden" name="id" value={artwork.id} />
                    <ConfirmSubmit
                      title={`Xoá tác phẩm “${vi?.title ?? en?.title ?? artwork.slug}”?`}
                      description="Tác phẩm sẽ bị ẩn khỏi phòng tranh (xoá mềm). Ảnh gốc vẫn còn trong thư viện."
                      triggerLabel="Xoá"
                      confirmLabel="Xoá tác phẩm"
                    />
                  </form>
                </div>
              ),
            },
          };
        })}
        empty="Phòng tranh chưa có tác phẩm. Bấm “Tải tác phẩm” để bắt đầu."
      />

      <Pagination
        page={Math.min(page, pages)}
        pages={pages}
        basePath="/admin/art"
        params={{}}
        labels={{ previous: "Trước", next: "Sau", page: "Trang", of: "/" }}
      />
    </>
  );
}
