import { getMediaLibrary } from "@/server/queries/media-library";
import { PageHeader } from "@/components/admin/page-header";
import { SurveyForm, emptySurvey } from "@/components/admin/survey-form";

export const dynamic = "force-dynamic";

export default async function NewSurveyPage() {
  const library = await getMediaLibrary();

  return (
    <>
      <PageHeader
        title="Khảo sát mới"
        description="Đặt tên, mô tả và giao diện cho khảo sát. Lưu xong sẽ sang trang builder để thêm nhóm và câu hỏi."
        back={{ href: "/admin/surveys", label: "Danh sách khảo sát" }}
      />
      <SurveyForm initial={emptySurvey} library={library} />
    </>
  );
}
