import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { listProjectsForAdmin } from "@/server/queries/projects";
import { deleteProjectAction, toggleProjectFeaturedAction } from "@/server/actions/projects";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { Flash } from "@/components/admin/flash";
import { Pagination } from "@/components/site/pagination";
import { formatShortDate, paginate, totalPages } from "@/lib/utils";

export default async function AdminProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; saved?: string; deleted?: string }>;
}) {
  const query = await searchParams;
  const projects = await listProjectsForAdmin();
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const pages = totalPages(projects.length, 20);
  const items = paginate(projects, Math.min(page, pages), 20);

  return (
    <>
      <PageHeader
        title="Dự án"
        description="Quản lý hồ sơ dự án: tạo, chỉnh sửa, xuất bản và sắp xếp thứ tự hiển thị."
        actions={
          <Link href="/admin/projects/new" className="btn btn-primary btn-sm">
            <Plus size={12} aria-hidden="true" />
            Dự án mới
          </Link>
        }
      />

      {query.saved && <Flash message="Đã lưu dự án." />}
      {query.deleted && <Flash message="Đã chuyển dự án vào trạng thái xoá mềm." />}

      <DataTable
        columns={[
          { key: "project", label: "Dự án" },
          { key: "status", label: "Trạng thái" },
          { key: "visibility", label: "Hiển thị" },
          { key: "featured", label: "Nổi bật" },
          { key: "order", label: "Thứ tự", className: "w-16" },
          { key: "updated", label: "Cập nhật" },
          { key: "actions", label: "", className: "text-right" },
        ]}
        rows={items.map((project) => {
          const vi = project.translations.find((item) => item.locale === "vi");
          const en = project.translations.find((item) => item.locale === "en");
          return {
            id: project.id,
            cells: {
              project: (
                <div className="flex items-center gap-3">
                  <div className="relative h-10 w-14 shrink-0 overflow-hidden border border-line bg-surface-muted">
                    {project.thumbnailMedia ? (
                      <Image
                        src={project.thumbnailMedia.url}
                        alt=""
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="grid h-full place-items-center text-[9px] text-muted">—</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <Link href={`/admin/projects/${project.id}`} className="block truncate text-[12.5px] hover:underline">
                      {vi?.name ?? en?.name ?? project.slug}
                    </Link>
                    <p className="truncate font-mono text-[10px] text-muted">/{project.slug}</p>
                  </div>
                </div>
              ),
              status: <StatusBadge status={project.status} />,
              visibility: <StatusBadge status={project.visibility} />,
              featured: project.featured ? <StatusBadge status="featured" label="Nổi bật" /> : <span className="text-muted">—</span>,
              order: <span className="tabular-nums text-muted">{project.order}</span>,
              updated: <span className="text-[11px] text-muted">{formatShortDate(project.updatedAt, "vi")}</span>,
              actions: (
                <div className="flex items-center justify-end gap-1.5">
                  <form action={toggleProjectFeaturedAction}>
                    <input type="hidden" name="id" value={project.id} />
                    <button
                      type="submit"
                      className="rounded-full border border-line px-2.5 py-1 text-[10.5px] text-muted transition-colors hover:border-ink hover:text-ink"
                    >
                      {project.featured ? "Bỏ nổi bật" : "Nổi bật"}
                    </button>
                  </form>
                  <Link
                    href={`/admin/projects/${project.id}`}
                    className="rounded-full border border-line px-2.5 py-1 text-[10.5px] text-muted transition-colors hover:border-ink hover:text-ink"
                  >
                    Sửa
                  </Link>
                  <form action={deleteProjectAction}>
                    <input type="hidden" name="id" value={project.id} />
                    <ConfirmSubmit
                      title={`Xoá dự án “${vi?.name ?? en?.name ?? project.slug}”?`}
                      description="Dự án sẽ bị ẩn khỏi website (xoá mềm) nhưng dữ liệu vẫn còn trong cơ sở dữ liệu."
                      triggerLabel="Xoá"
                      confirmLabel="Xoá dự án"
                    />
                  </form>
                </div>
              ),
            },
          };
        })}
        empty="Chưa có dự án nào. Bấm “Dự án mới” để bắt đầu."
      />

      <Pagination
        page={Math.min(page, pages)}
        pages={pages}
        basePath="/admin/projects"
        params={{}}
        labels={{ previous: "Trước", next: "Sau", page: "Trang", of: "/" }}
      />
    </>
  );
}
