import { getMediaLibrary } from "@/server/queries/media-library";
import { PageHeader } from "@/components/admin/page-header";
import { ProjectForm, emptyProject } from "@/components/admin/project-form";

export default async function NewProjectPage() {
  const library = await getMediaLibrary();

  return (
    <>
      <PageHeader
        title="Dự án mới"
        description="Tạo hồ sơ dự án. Nội dung tiếng Việt và tiếng Anh được nhập riêng; để trống ngôn ngữ nào thì ngôn ngữ đó sẽ bị ẩn."
        back={{ href: "/admin/projects", label: "Danh sách dự án" }}
      />
      <ProjectForm initial={{ ...emptyProject, order: 0 }} library={library} />
    </>
  );
}
