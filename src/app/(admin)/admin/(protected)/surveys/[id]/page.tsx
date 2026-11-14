import Link from "next/link";
import { notFound } from "next/navigation";
import { getSurveyForAdmin } from "@/server/queries/surveys";
import { getMediaLibrary } from "@/server/queries/media-library";
import { toMediaView } from "@/server/queries/media";
import { PageHeader } from "@/components/admin/page-header";
import { Flash } from "@/components/admin/flash";
import { SurveyBuilder } from "@/components/admin/survey-builder";
import { SurveyForm, type SurveyFormInitial } from "@/components/admin/survey-form";
import { StatusBadge } from "@/components/admin/status-badge";

export const dynamic = "force-dynamic";

function toLocalDateTimeInput(value: Date | null): string {
  if (!value) return "";
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export default async function EditSurveyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [survey, library] = await Promise.all([getSurveyForAdmin(id), getMediaLibrary()]);
  if (!survey) notFound();

  const vi = survey.translations.find((item) => item.locale === "vi");
  const en = survey.translations.find((item) => item.locale === "en");
  const responseCount = survey._count.responses;
  const hasEn = Boolean(en?.title.trim());

  const initial: SurveyFormInitial = {
    id: survey.id,
    slug: survey.slug,
    status: survey.status,
    cover: toMediaView(survey.coverMedia),
    // BỔ SUNG 15:14 (A2 columns).
    brandName: survey.brandName ?? "",
    brandLogo: toMediaView(survey.brandLogoMedia),
    badgeFromColor: survey.badgeFromColor ?? "",
    badgeToColor: survey.badgeToColor ?? "",
    themePreset: survey.themePreset,
    layout: survey.layout,
    progressStyle: survey.progressStyle,
    primaryColor: survey.primaryColor ?? "",
    accentColor: survey.accentColor ?? "",
    backgroundColor: survey.backgroundColor ?? "",
    surfaceColor: survey.surfaceColor ?? "",
    textColor: survey.textColor ?? "",
    buttonStyle: survey.buttonStyle,
    borderRadius: survey.borderRadius,
    estimatedMinutes: survey.estimatedMinutes?.toString() ?? "",
    startsAt: toLocalDateTimeInput(survey.startsAt),
    endsAt: toLocalDateTimeInput(survey.endsAt),
    isBookingIntake: survey.isBookingIntake,
    vi: {
      title: vi?.title ?? "",
      subtitle: vi?.subtitle ?? "",
      description: vi?.description ?? "",
      introduction: vi?.introduction ?? "",
      completionMessage: vi?.completionMessage ?? "",
      privacyNotice: vi?.privacyNotice ?? "",
      highlights: vi?.highlights ?? "",
    },
    en: {
      title: en?.title ?? "",
      subtitle: en?.subtitle ?? "",
      description: en?.description ?? "",
      introduction: en?.introduction ?? "",
      completionMessage: en?.completionMessage ?? "",
      privacyNotice: en?.privacyNotice ?? "",
      highlights: en?.highlights ?? "",
    },
  };

  return (
    <>
      <PageHeader
        title={vi?.title ?? en?.title ?? survey.slug}
        description={`/${survey.slug} · ${survey.questions.length} câu hỏi · ${survey.sections.length} nhóm · ${responseCount} phản hồi`}
        back={{ href: "/admin/surveys", label: "Danh sách khảo sát" }}
        actions={
          <>
            <Link href={`/preview/survey/${survey.id}?locale=vi`} target="_blank" className="btn btn-outline btn-sm">
              Xem trước
            </Link>
            {survey.status === "published" && (
              <Link href={`/vi/survey/${survey.slug}`} target="_blank" className="btn btn-outline btn-sm">
                Xem trang công khai
              </Link>
            )}
            <Link href={`/admin/surveys/${survey.id}/responses`} className="btn btn-outline btn-sm">
              Xem kết quả
            </Link>
          </>
        }
      />

      {query.saved && <Flash message="Đã lưu khảo sát." />}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <StatusBadge status={survey.status} />
        {survey.status === "archived" && (
          <span className="text-[12px] text-muted">
            Khảo sát đã lưu trữ — không nhận thêm câu trả lời. Mở lại nháp từ danh sách khảo sát để chỉnh sửa tiếp.
          </span>
        )}
        {survey.status === "published" && !hasEn && (
          <span className="border border-warning/30 bg-warning-soft px-2.5 py-1 text-[11.5px] text-warning">
            Chưa có bản dịch tiếng Anh — trang khảo sát bản EN sẽ bị ẩn thay vì hiển thị sai ngôn ngữ.
          </span>
        )}
      </div>

      <div className="mb-8">
        <h2 className="mb-3 text-[13px] font-medium uppercase tracking-[0.14em] text-muted">
          Nhóm &amp; câu hỏi
        </h2>
        <SurveyBuilder survey={survey} />
      </div>

      <div>
        <h2 className="mb-3 text-[13px] font-medium uppercase tracking-[0.14em] text-muted">
          Cài đặt &amp; giao diện
        </h2>
        <SurveyForm initial={initial} library={library} />
      </div>
    </>
  );
}
