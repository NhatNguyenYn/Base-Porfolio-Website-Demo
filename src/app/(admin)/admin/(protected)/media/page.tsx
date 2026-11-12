import Image from "next/image";
import { listMediaLibrary } from "@/server/queries/media-library";
import { deleteMediaAction, updateMediaMetaAction } from "@/server/actions/media";
import { PageHeader } from "@/components/admin/page-header";
import { MediaUploader } from "@/components/admin/media-uploader";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { Flash } from "@/components/admin/flash";
import { Pagination } from "@/components/site/pagination";
import { fileSize, formatShortDate } from "@/lib/utils";

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; saved?: string; deleted?: string; error?: string }>;
}) {
  const query = await searchParams;
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const { rows, total, pages } = await listMediaLibrary(page, 24);

  return (
    <>
      <PageHeader
        title="Thư viện ảnh"
        description={`${total} ảnh đã tải lên. Ảnh được lưu qua lớp storage (local khi phát triển, S3-compatible khi triển khai).`}
      />

      {query.saved && <Flash message="Đã cập nhật thông tin ảnh." />}
      {query.deleted && <Flash message="Đã xoá ảnh khỏi thư viện." />}
      {query.error === "in_use" && (
        <Flash
          tone="error"
          message="Ảnh này đang được dùng ở dự án, bài viết hoặc tác phẩm nên không thể xoá. Hãy gỡ ảnh khỏi nội dung trước."
        />
      )}

      <div className="mb-8">
        <MediaUploader />
      </div>

      {rows.length === 0 ? (
        <p className="border border-dashed border-line px-6 py-16 text-center text-[12.5px] text-muted">
          Thư viện chưa có ảnh nào.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((media) => (
            <article key={media.id} className="border border-line bg-surface">
              <div className="relative aspect-[4/3] overflow-hidden bg-surface-muted">
                <Image
                  src={media.url}
                  alt={media.alt ?? ""}
                  fill
                  sizes="(min-width: 1280px) 22vw, (min-width: 640px) 45vw, 92vw"
                  className="object-cover"
                />
              </div>
              <div className="p-3">
                <p className="truncate text-[11.5px]" title={media.filename}>
                  {media.title || media.filename}
                </p>
                <p className="mt-0.5 text-[10px] text-muted">
                  {media.width ?? "?"} × {media.height ?? "?"} · {fileSize(media.size)} ·{" "}
                  {formatShortDate(media.createdAt, "vi")}
                </p>

                <details className="mt-2">
                  <summary className="cursor-pointer text-[10.5px] text-muted hover:text-ink">Sửa mô tả</summary>
                  <form action={updateMediaMetaAction} className="mt-2 space-y-2">
                    <input type="hidden" name="id" value={media.id} />
                    <input
                      name="title"
                      defaultValue={media.title ?? ""}
                      placeholder="Tiêu đề"
                      className="field text-[11px]"
                      maxLength={240}
                    />
                    <input
                      name="alt"
                      defaultValue={media.alt ?? ""}
                      placeholder="Alt text (SEO)"
                      className="field text-[11px]"
                      maxLength={240}
                    />
                    <button type="submit" className="btn btn-outline btn-sm w-full">
                      Lưu
                    </button>
                  </form>
                </details>

                <form action={deleteMediaAction} className="mt-2 flex justify-end">
                  <input type="hidden" name="id" value={media.id} />
                  <ConfirmSubmit
                    title="Xoá ảnh khỏi thư viện?"
                    description="Ảnh sẽ bị xoá khỏi storage và cơ sở dữ liệu nếu không còn được sử dụng."
                    triggerLabel="Xoá ảnh"
                    confirmLabel="Xoá"
                  />
                </form>
              </div>
            </article>
          ))}
        </div>
      )}

      <Pagination
        page={page}
        pages={pages}
        basePath="/admin/media"
        params={{}}
        labels={{ previous: "Trước", next: "Sau", page: "Trang", of: "/" }}
      />
    </>
  );
}
