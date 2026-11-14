import Link from "next/link";
import { notFound } from "next/navigation";
import { getResponseDetail, questionTypeLabel } from "@/server/queries/survey-responses";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatDate } from "@/lib/utils";

export default async function SurveyResponseDetailPage({
  params,
}: {
  params: Promise<{ id: string; responseId: string }>;
}) {
  const { id, responseId } = await params;
  const detail = await getResponseDetail(responseId);
  // The response must belong to the survey in the URL; otherwise it is not found.
  if (!detail || detail.surveyId !== id) notFound();

  return (
    <>
      <PageHeader
        title="Chi tiết phản hồi"
        description={`Khảo sát “${detail.surveyTitle}” — gửi lúc ${formatDate(detail.submittedAt, "vi", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })} · Ngôn ngữ: ${detail.locale.toUpperCase()}`}
        back={{ href: `/admin/surveys/${id}/responses`, label: "Danh sách phản hồi" }}
        actions={
          <StatusBadge
            status={detail.surveyStatus}
            label={detail.surveyStatus === "closed" ? "Đã đóng" : undefined}
          />
        }
      />

      <div className="mb-7 border border-line bg-surface px-4 py-3 text-[12.5px]">
        <p>
          <span className="text-muted">Mã phản hồi: </span>
          <span className="font-mono text-[11.5px]">{detail.id}</span>
        </p>
        <p className="mt-1">
          <span className="text-muted">Trạng thái hợp lệ: </span>
          {detail.complete ? (
            <span className="text-success">Hợp lệ — đã trả lời đủ các câu bắt buộc.</span>
          ) : (
            <span className="text-warning">
              Chưa đầy đủ — thiếu: {detail.missingRequired.join("; ")}.
            </span>
          )}
        </p>
        <p className="mt-1 text-muted">
          Chỉ hiển thị những gì người trả lời đã nhập. Không có thông tin nhận diện nào khác được lưu
          cho phản hồi này.
        </p>
      </div>

      {detail.answers.length === 0 ? (
        <p className="border border-line bg-surface px-4 py-12 text-center text-[13px] text-muted">
          Phản hồi này không có câu trả lời nào.
        </p>
      ) : (
        <ol className="space-y-4">
          {detail.answers.map((answer, index) => (
            <li key={answer.questionId} className="border border-line bg-surface px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-[11px] tabular-nums text-muted">Câu {index + 1}</span>
                <h2 className="text-[13.5px] font-medium">{answer.questionTitle}</h2>
                <span className="text-[11px] text-muted">
                  {questionTypeLabel(answer.questionType)}
                  {answer.required ? " · Bắt buộc" : ""}
                </span>
              </div>
              <ul className="mt-2 space-y-1">
                {answer.values.map((value, valueIndex) => (
                  <li
                    key={valueIndex}
                    className="whitespace-pre-wrap break-words text-[13px] leading-relaxed"
                  >
                    {value === "" ? <span className="text-muted">(để trống)</span> : value}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-6">
        <Link href={`/admin/surveys/${id}/responses`} className="link-arrow text-[12.5px] text-muted hover:text-ink">
          ← Quay lại danh sách phản hồi
        </Link>
      </p>
    </>
  );
}
