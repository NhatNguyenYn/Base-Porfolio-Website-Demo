import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectForAdmin } from "@/server/queries/projects";
import { getMediaLibrary } from "@/server/queries/media-library";
import { toMediaView } from "@/server/queries/media";
import { PageHeader } from "@/components/admin/page-header";
import { ProjectForm, type ProjectFormInitial } from "@/components/admin/project-form";
import { Flash } from "@/components/admin/flash";

function toDateInput(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

export default async function EditProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [project, library] = await Promise.all([getProjectForAdmin(id), getMediaLibrary()]);
  if (!project) notFound();

  const vi = project.translations.find((item) => item.locale === "vi");
  const en = project.translations.find((item) => item.locale === "en");

  const initial: ProjectFormInitial = {
    id: project.id,
    slug: project.slug,
    status: project.status,
    visibility: project.visibility,
    featured: project.featured,
    order: project.order,
    startDate: toDateInput(project.startDate),
    completionDate: toDateInput(project.completionDate),
    githubUrl: project.githubUrl ?? "",
    demoUrl: project.demoUrl ?? "",
    thumbnail: toMediaView(project.thumbnailMedia),
    gallery: project.images
      .map((image) => toMediaView(image.media))
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    technologies: project.technologies.map((tech) => tech.name).join(", "),
    vi: {
      name: vi?.name ?? "",
      shortDescription: vi?.shortDescription ?? "",
      fullDescription: vi?.fullDescription ?? "",
      role: vi?.role ?? "",
    },
    en: {
      name: en?.name ?? "",
      shortDescription: en?.shortDescription ?? "",
      fullDescription: en?.fullDescription ?? "",
      role: en?.role ?? "",
    },
  };

  return (
    <>
      <PageHeader
        title={vi?.name ?? en?.name ?? project.slug}
        description={`/${project.slug} · cập nhật ${project.updatedAt.toLocaleDateString("vi-VN")}`}
        back={{ href: "/admin/projects", label: "Danh sách dự án" }}
        actions={
          <>
            <Link href={`/preview/project/${project.id}?locale=vi`} target="_blank" className="btn btn-outline btn-sm">
              Xem trước
            </Link>
            {project.visibility === "public" && project.publishedAt && (
              <Link href={`/vi/projects/${project.slug}`} target="_blank" className="btn btn-outline btn-sm">
                Xem trên website
              </Link>
            )}
          </>
        }
      />

      {query.saved && <Flash message="Đã lưu dự án." />}
      <ProjectForm initial={initial} library={library} />
    </>
  );
}
