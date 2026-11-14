"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import {
  deleteQuestionAction,
  deleteSectionAction,
  duplicateQuestionAction,
  reorderQuestionsAction,
  saveSectionAction,
} from "@/server/actions/surveys";
import { initialActionState } from "@/lib/action-state";
import type { SurveyForAdmin } from "@/server/queries/surveys";
import { ConfirmSubmit } from "./confirm-submit";
import { QUESTION_TYPE_LABELS } from "./status-badge";
import {
  SurveyQuestionForm,
  emptyQuestion,
  type QuestionFormInitial,
} from "./survey-question-form";

type BuilderQuestion = SurveyForAdmin["questions"][number];
type BuilderSection = SurveyForAdmin["sections"][number];

function toQuestionInitial(question: BuilderQuestion): QuestionFormInitial {
  const vi = question.translations.find((item) => item.locale === "vi");
  const en = question.translations.find((item) => item.locale === "en");
  return {
    id: question.id,
    type: question.type,
    required: question.required,
    minLength: question.minLength?.toString() ?? "",
    maxLength: question.maxLength?.toString() ?? "",
    minRating: question.minRating?.toString() ?? "",
    maxRating: question.maxRating?.toString() ?? "",
    vi: { title: vi?.title ?? "", description: vi?.description ?? "", placeholder: vi?.placeholder ?? "" },
    en: { title: en?.title ?? "", description: en?.description ?? "", placeholder: en?.placeholder ?? "" },
    options: question.options.map((option) => {
      const ovi = option.translations.find((item) => item.locale === "vi");
      const oen = option.translations.find((item) => item.locale === "en");
      return {
        id: option.id,
        value: option.value,
        order: option.order,
        vi: { label: ovi?.label ?? "" },
        en: { label: oen?.label ?? "" },
      };
    }),
  };
}

function questionSummary(question: BuilderQuestion): string {
  const parts: string[] = [QUESTION_TYPE_LABELS[question.type] ?? question.type];
  if (question.required) parts.push("bắt buộc");
  if (question.options.length > 0) parts.push(`${question.options.length} lựa chọn`);
  if (question.type === "rating" && (question.minRating !== null || question.maxRating !== null)) {
    parts.push(`thang ${question.minRating ?? 1}–${question.maxRating ?? 10}`);
  }
  if ((question.type === "short_text" || question.type === "long_text") && question.maxLength !== null) {
    parts.push(`tối đa ${question.maxLength} ký tự`);
  }
  return parts.join(" · ");
}

/**
 * Survey builder: sections + questions. Reordering is up/down buttons only
 * (no drag-and-drop dependency, per the brief). Every change is an explicit
 * server-action save — nothing auto-mutates a published survey, and deleting
 * a question that already has answers is refused server-side with a clear
 * error (see deleteQuestionAction).
 */
export function SurveyBuilder({ survey }: { survey: SurveyForAdmin }) {
  const responseCount = survey._count.responses;
  const [editing, setEditing] = useState<{ sectionId: string | null; initial: QuestionFormInitial } | null>(null);
  const [sectionForm, setSectionForm] = useState<{
    id?: string;
    viTitle: string;
    viDescription: string;
    enTitle: string;
    enDescription: string;
  } | null>(null);

  const [deleteState, deleteAction] = useActionState(deleteQuestionAction, initialActionState);
  const [duplicateState, duplicateAction] = useActionState(duplicateQuestionAction, initialActionState);
  const [reorderState, reorderAction] = useActionState(reorderQuestionsAction, initialActionState);
  const [sectionState, sectionAction] = useActionState(saveSectionAction, initialActionState);

  useEffect(() => {
    if (sectionState.ok) setSectionForm(null);
  }, [sectionState.ok]);

  const questionsOf = (sectionId: string | null) =>
    survey.questions.filter((question) => (question.sectionId ?? null) === sectionId);

  // Display order: sections in order (their questions in order), then
  // unsectioned questions. Reorder submits this full flat list so the
  // single global `order` column stays consistent.
  const flatIds = [
    ...survey.sections.flatMap((section) => questionsOf(section.id).map((question) => question.id)),
    ...questionsOf(null).map((question) => question.id),
  ];

  function moveQuestion(questionId: string, direction: -1 | 1) {
    const question = survey.questions.find((item) => item.id === questionId);
    if (!question) return;
    const group = questionsOf(question.sectionId ?? null).map((item) => item.id);
    const index = group.indexOf(questionId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= group.length) return;
    [group[index], group[target]] = [group[target], group[index]];
    // Rebuild: replace the group's ids in flat order with the swapped group.
    const groupSet = new Set(questionsOf(question.sectionId ?? null).map((item) => item.id));
    let cursor = 0;
    const ordered = flatIds.map((id) => (groupSet.has(id) ? group[cursor++] : id));
    const formData = new FormData();
    formData.set("surveyId", survey.id);
    formData.set("questionIds", ordered.join(","));
    reorderAction(formData);
  }

  function questionCard(question: BuilderQuestion, group: BuilderQuestion[]) {
    const index = group.indexOf(question);
    const vi = question.translations.find((item) => item.locale === "vi");
    const en = question.translations.find((item) => item.locale === "en");
    const isEditing = editing?.initial.id === question.id;
    return (
      <li key={question.id} className="border border-line bg-surface">
        <div className="flex flex-wrap items-start justify-between gap-3 p-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium leading-snug">
              <span className="mr-2 text-muted">{group.indexOf(question) + 1}.</span>
              {vi?.title ?? en?.title ?? "(chưa có tiêu đề)"}
            </p>
            {en?.title && vi?.title && <p className="mt-0.5 truncate text-[11.5px] text-muted">{en.title}</p>}
            <p className="mt-1 text-[11px] text-muted">{questionSummary(question)}</p>
            {vi?.description && <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{vi.description}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => moveQuestion(question.id, -1)}
              disabled={index === 0}
              className="rounded-full border border-line px-2 py-1 text-[11px] disabled:opacity-40"
              aria-label="Đưa câu hỏi lên trên"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => moveQuestion(question.id, 1)}
              disabled={index === group.length - 1}
              className="rounded-full border border-line px-2 py-1 text-[11px] disabled:opacity-40"
              aria-label="Đưa câu hỏi xuống dưới"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => setEditing({ sectionId: question.sectionId ?? null, initial: toQuestionInitial(question) })}
              className="rounded-full border border-line px-2.5 py-1 text-[10.5px] text-muted transition-colors hover:border-ink hover:text-ink"
            >
              Sửa
            </button>
            <form action={duplicateAction}>
              <input type="hidden" name="id" value={question.id} />
              <input type="hidden" name="surveyId" value={survey.id} />
              <button
                type="submit"
                className="rounded-full border border-line px-2.5 py-1 text-[10.5px] text-muted transition-colors hover:border-ink hover:text-ink"
              >
                Nhân bản
              </button>
            </form>
            <form action={deleteAction}>
              <input type="hidden" name="id" value={question.id} />
              <input type="hidden" name="surveyId" value={survey.id} />
              <ConfirmSubmit
                title={`Xoá câu hỏi “${vi?.title ?? en?.title ?? ""}”?`}
                description={
                  responseCount > 0
                    ? "Khảo sát đã có câu trả lời. Nếu câu hỏi này đã được trả lời, hệ thống sẽ từ chối xoá để bảo vệ dữ liệu."
                    : "Câu hỏi sẽ bị xoá khỏi khảo sát."
                }
                triggerLabel="Xoá"
                confirmLabel="Xoá câu hỏi"
              />
            </form>
          </div>
        </div>
        {isEditing && editing && (
          <div className="border-t border-line p-3.5">
            <SurveyQuestionForm
              surveyId={survey.id}
              sectionId={editing.sectionId}
              initial={editing.initial}
              onSaved={() => setEditing(null)}
              onCancel={() => setEditing(null)}
            />
          </div>
        )}
      </li>
    );
  }

  function sectionBlock(section: BuilderSection | null, title: string, description: string) {
    const group = questionsOf(section?.id ?? null);
    const isEditingSection = sectionForm?.id === (section?.id ?? undefined) && section !== null;
    return (
      <section key={section?.id ?? "unsectioned"} className="border border-line bg-surface-muted/30 p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-medium tracking-tight">{title}</h3>
            {description && <p className="mt-0.5 text-[12px] text-muted">{description}</p>}
            <p className="mt-1 text-[10.5px] text-muted">
              {group.length} câu hỏi
              {section ? ` · thứ tự ${survey.sections.indexOf(section) + 1}/${survey.sections.length}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setEditing({ sectionId: section?.id ?? null, initial: emptyQuestion })}
              className="btn btn-outline btn-sm"
            >
              + Thêm câu hỏi
            </button>
            {section && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setSectionForm({
                      id: section.id,
                      viTitle: section.translations.find((item) => item.locale === "vi")?.title ?? "",
                      viDescription: section.translations.find((item) => item.locale === "vi")?.description ?? "",
                      enTitle: section.translations.find((item) => item.locale === "en")?.title ?? "",
                      enDescription: section.translations.find((item) => item.locale === "en")?.description ?? "",
                    })
                  }
                  className="btn btn-outline btn-sm"
                >
                  Sửa nhóm
                </button>
                <form action={deleteSectionAction}>
                  <input type="hidden" name="id" value={section.id} />
                  <input type="hidden" name="surveyId" value={survey.id} />
                  <ConfirmSubmit
                    title={`Xoá nhóm “${title}”?`}
                    description="Các câu hỏi trong nhóm được giữ lại và chuyển thành chưa xếp nhóm. Câu trả lời không bị ảnh hưởng."
                    triggerLabel="Xoá nhóm"
                    confirmLabel="Xoá nhóm"
                    tone="neutral"
                  />
                </form>
              </>
            )}
          </div>
        </div>

        {isEditingSection && sectionForm && (
          <form action={sectionAction} className="mb-3 border border-line bg-surface p-3.5">
            <input type="hidden" name="id" value={sectionForm.id} />
            <input type="hidden" name="surveyId" value={survey.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="field-label" htmlFor={`section-vi-title-${section?.id}`}>
                  Tên nhóm (VI)
                </label>
                <input
                  id={`section-vi-title-${section?.id}`}
                  name="vi.title"
                  defaultValue={sectionForm.viTitle}
                  maxLength={200}
                  className="field"
                />
                <label className="field-label mt-3" htmlFor={`section-vi-desc-${section?.id}`}>
                  Mô tả (VI)
                </label>
                <textarea
                  id={`section-vi-desc-${section?.id}`}
                  name="vi.description"
                  defaultValue={sectionForm.viDescription}
                  rows={2}
                  className="field"
                />
              </div>
              <div>
                <label className="field-label" htmlFor={`section-en-title-${section?.id}`}>
                  Tên nhóm (EN)
                </label>
                <input
                  id={`section-en-title-${section?.id}`}
                  name="en.title"
                  defaultValue={sectionForm.enTitle}
                  maxLength={200}
                  className="field"
                />
                <label className="field-label mt-3" htmlFor={`section-en-desc-${section?.id}`}>
                  Mô tả (EN)
                </label>
                <textarea
                  id={`section-en-desc-${section?.id}`}
                  name="en.description"
                  defaultValue={sectionForm.enDescription}
                  rows={2}
                  className="field"
                />
              </div>
            </div>
            {!sectionState.ok && sectionState.message && (
              <p role="alert" className="mt-2 text-[12px] text-danger">
                {sectionState.message}
              </p>
            )}
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setSectionForm(null)} className="btn btn-outline btn-sm">
                Huỷ
              </button>
              <button type="submit" className="btn btn-primary btn-sm">
                Lưu nhóm
              </button>
            </div>
          </form>
        )}

        {group.length === 0 ? (
          <p className="border border-dashed border-line bg-surface px-4 py-6 text-center text-[12px] text-muted">
            Chưa có câu hỏi trong nhóm này.
          </p>
        ) : (
          <ul className="space-y-2.5">{group.map((question) => questionCard(question, group))}</ul>
        )}

        {editing && editing.sectionId === (section?.id ?? null) && !editing.initial.id && (
          <div className="mt-3">
            <SurveyQuestionForm
              surveyId={survey.id}
              sectionId={editing.sectionId}
              initial={editing.initial}
              onSaved={() => setEditing(null)}
              onCancel={() => setEditing(null)}
            />
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {responseCount > 0 && (
        <div role="alert" className="border-l-2 border-warning bg-warning-soft px-4 py-3">
          <p className="text-[13px] font-medium text-warning">
            Khảo sát đã có {responseCount} câu trả lời.
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-warning">
            Sửa hoặc xoá câu hỏi có thể làm thay đổi ý nghĩa của câu trả lời đã lưu. Câu hỏi đã được trả lời sẽ
            không xoá được. Nếu cần thay đổi cấu trúc lớn, hãy nhân bản khảo sát thành bản nháp mới thay vì sửa
            trực tiếp bản đang chạy.
          </p>
        </div>
      )}
      {survey.status === "published" && (
        <p className="border border-line bg-surface px-4 py-3 text-[12px] leading-relaxed text-muted">
          Khảo sát đang xuất bản. Mọi thay đổi ở đây chỉ áp dụng sau khi bấm Lưu ở từng biểu mẫu — không có thay đổi
          nào tự động áp dụng lên bản đang chạy. Xem trước bằng nút “Xem trước” ở đầu trang trước khi thay đổi lớn.
        </p>
      )}
      {!deleteState.ok && deleteState.message && (
        <div role="alert" className="border-l-2 border-danger bg-danger-soft px-4 py-3 text-[12.5px] text-danger">
          {deleteState.message}
        </div>
      )}
      {!duplicateState.ok && duplicateState.message && (
        <div role="alert" className="border-l-2 border-danger bg-danger-soft px-4 py-3 text-[12.5px] text-danger">
          {duplicateState.message}
        </div>
      )}
      {!reorderState.ok && reorderState.message && (
        <div role="alert" className="border-l-2 border-danger bg-danger-soft px-4 py-3 text-[12.5px] text-danger">
          {reorderState.message}
        </div>
      )}
      {duplicateState.ok && duplicateState.message && (
        <div role="status" className="border-l-2 border-success bg-success-soft px-4 py-3 text-[12.5px] text-success">
          {duplicateState.message}
        </div>
      )}

      {survey.sections.map((section) =>
        sectionBlock(
          section,
          section.translations.find((item) => item.locale === "vi")?.title ??
            section.translations.find((item) => item.locale === "en")?.title ??
            "(nhóm chưa đặt tên)",
          section.translations.find((item) => item.locale === "vi")?.description ?? "",
        ),
      )}
      {sectionBlock(null, "Câu hỏi chưa xếp nhóm", "Các câu hỏi không thuộc nhóm nào — hiển thị thành một bước riêng.")}

      {sectionForm && !sectionForm.id ? (
        <form action={sectionAction} className="border border-line bg-surface p-4">
          <input type="hidden" name="surveyId" value={survey.id} />
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Nhóm mới</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="section-new-vi-title">
                Tên nhóm (VI) *
              </label>
              <input id="section-new-vi-title" name="vi.title" maxLength={200} className="field" />
              <label className="field-label mt-3" htmlFor="section-new-vi-desc">
                Mô tả (VI)
              </label>
              <textarea id="section-new-vi-desc" name="vi.description" rows={2} className="field" />
            </div>
            <div>
              <label className="field-label" htmlFor="section-new-en-title">
                Tên nhóm (EN)
              </label>
              <input id="section-new-en-title" name="en.title" maxLength={200} className="field" />
              <label className="field-label mt-3" htmlFor="section-new-en-desc">
                Mô tả (EN)
              </label>
              <textarea id="section-new-en-desc" name="en.description" rows={2} className="field" />
            </div>
          </div>
          {!sectionState.ok && sectionState.message && (
            <p role="alert" className="mt-2 text-[12px] text-danger">
              {sectionState.message}
            </p>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setSectionForm(null)} className="btn btn-outline btn-sm">
              Huỷ
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Tạo nhóm
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setSectionForm({ viTitle: "", viDescription: "", enTitle: "", enDescription: "" })}
          className="btn btn-outline btn-sm"
        >
          + Thêm nhóm câu hỏi
        </button>
      )}

      <p className="text-[11px] text-muted">
        Tối đa 10 nhóm và 100 câu hỏi mỗi khảo sát. Câu hỏi trong cùng một nhóm hiển thị thành một bước khi người dùng
        trả lời.{" "}
        <Link href={`/admin/surveys/${survey.id}/responses`} className="underline underline-offset-2">
          Xem kết quả ({responseCount} phản hồi)
        </Link>
        .
      </p>
    </div>
  );
}
