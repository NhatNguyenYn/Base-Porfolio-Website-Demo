"use client";

import { useActionState, useEffect, useState } from "react";
import { saveQuestionAction } from "@/server/actions/surveys";
import { initialActionState } from "@/lib/action-state";
import { slugify } from "@/lib/utils";
import { LocaleTabs } from "./locale-tabs";

export type QuestionOptionFormValue = {
  id?: string;
  value: string;
  order: number;
  vi: { label: string };
  en: { label: string };
};

export type QuestionFormInitial = {
  id?: string;
  type: string;
  required: boolean;
  minLength: string;
  maxLength: string;
  minRating: string;
  maxRating: string;
  vi: { title: string; description: string; placeholder: string };
  en: { title: string; description: string; placeholder: string };
  options: QuestionOptionFormValue[];
};

export const emptyQuestion: QuestionFormInitial = {
  type: "short_text",
  required: false,
  minLength: "",
  maxLength: "",
  minRating: "",
  maxRating: "",
  vi: { title: "", description: "", placeholder: "" },
  en: { title: "", description: "", placeholder: "" },
  options: [],
};

const QUESTION_TYPES = [
  { value: "short_text", label: "Văn bản ngắn" },
  { value: "long_text", label: "Văn bản dài" },
  { value: "single_choice", label: "Chọn một" },
  { value: "multiple_choice", label: "Chọn nhiều" },
  { value: "dropdown", label: "Danh sách chọn" },
  { value: "rating", label: "Đánh giá (1–10)" },
  { value: "nps", label: "NPS (0–10)" },
  { value: "yes_no", label: "Có / Không" },
] as const;

function localeFields(
  locale: "vi" | "en",
  initial: QuestionFormInitial["vi"],
  labels: { title: string; description: string; placeholder: string },
) {
  return (
    <div className="space-y-3">
      <div>
        <label className="field-label" htmlFor={`q-${locale}-title`}>
          {labels.title}
        </label>
        <input
          id={`q-${locale}-title`}
          name={`${locale}.title`}
          defaultValue={initial.title}
          maxLength={300}
          required
          className="field text-[14px]"
        />
      </div>
      <div>
        <label className="field-label" htmlFor={`q-${locale}-description`}>
          {labels.description}
        </label>
        <textarea
          id={`q-${locale}-description`}
          name={`${locale}.description`}
          defaultValue={initial.description}
          rows={2}
          maxLength={2000}
          className="field"
        />
      </div>
      <div>
        <label className="field-label" htmlFor={`q-${locale}-placeholder`}>
          {labels.placeholder}
        </label>
        <input
          id={`q-${locale}-placeholder`}
          name={`${locale}.placeholder`}
          defaultValue={initial.placeholder}
          maxLength={200}
          className="field"
        />
      </div>
    </div>
  );
}

/**
 * Inline question editor used inside the builder. Options are kept in local
 * state and submitted as one JSON hidden field ("options") — the server
 * re-validates every option with surveyOptionSchema, so a crafted request
 * cannot bypass the limits.
 */
export function SurveyQuestionForm({
  surveyId,
  sectionId,
  initial,
  onSaved,
  onCancel,
}: {
  surveyId: string;
  sectionId: string | null;
  initial: QuestionFormInitial;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveQuestionAction, initialActionState);
  const [type, setType] = useState(initial.type);
  const [options, setOptions] = useState<QuestionOptionFormValue[]>(initial.options);

  useEffect(() => {
    if (state.ok) onSaved();
  }, [state.ok, onSaved]);

  const isChoice = type === "single_choice" || type === "multiple_choice" || type === "dropdown";
  const isText = type === "short_text" || type === "long_text";
  const isRating = type === "rating";

  function updateOption(index: number, patch: Partial<QuestionOptionFormValue>) {
    setOptions((previous) => previous.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function updateOptionLabel(index: number, locale: "vi" | "en", label: string) {
    setOptions((previous) =>
      previous.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, [locale]: { label } };
        // Auto-derive the machine value from the VI label until the admin
        // edits the value by hand (value is the stable stored key).
        if (locale === "vi" && (!item.value || item.value === slugify(item.vi.label))) {
          next.value = slugify(label) || item.value;
        }
        return next;
      }),
    );
  }

  function moveOption(index: number, direction: -1 | 1) {
    setOptions((previous) => {
      const next = [...previous];
      const target = index + direction;
      if (target < 0 || target >= next.length) return previous;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((item, i) => ({ ...item, order: i }));
    });
  }

  return (
    <form action={formAction} className="border border-accent/40 bg-surface p-4">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="surveyId" value={surveyId} />
      <input type="hidden" name="sectionId" value={sectionId ?? ""} />
      <input type="hidden" name="options" value={JSON.stringify(options.map((item, i) => ({ ...item, order: i })))} />

      {!state.ok && state.message && (
        <div role="alert" className="mb-4 border-l-2 border-danger bg-danger-soft px-3 py-2 text-[12px] text-danger">
          {state.message}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        <div className="space-y-3">
          <div>
            <label className="field-label" htmlFor="q-type">
              Loại câu hỏi
            </label>
            <select id="q-type" name="type" value={type} onChange={(event) => setType(event.target.value)} className="field">
              {QUESTION_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2.5 text-[12px]">
            <input type="checkbox" name="required" defaultChecked={initial.required} className="h-3.5 w-3.5 accent-[var(--accent)]" />
            Bắt buộc trả lời
          </label>
          {isText && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="field-label" htmlFor="q-minLength">
                  Dài tối thiểu
                </label>
                <input id="q-minLength" name="minLength" type="number" min={0} max={5000} defaultValue={initial.minLength} className="field" />
              </div>
              <div>
                <label className="field-label" htmlFor="q-maxLength">
                  Dài tối đa
                </label>
                <input id="q-maxLength" name="maxLength" type="number" min={0} max={5000} defaultValue={initial.maxLength} className="field" />
              </div>
            </div>
          )}
          {isRating && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="field-label" htmlFor="q-minRating">
                  Điểm tối thiểu
                </label>
                <input id="q-minRating" name="minRating" type="number" min={1} max={10} defaultValue={initial.minRating || "1"} className="field" />
              </div>
              <div>
                <label className="field-label" htmlFor="q-maxRating">
                  Điểm tối đa
                </label>
                <input id="q-maxRating" name="maxRating" type="number" min={1} max={10} defaultValue={initial.maxRating || "5"} className="field" />
              </div>
            </div>
          )}
          {type === "nps" && <p className="text-[10.5px] text-muted">NPS luôn dùng thang 0–10.</p>}
          {type === "yes_no" && <p className="text-[10.5px] text-muted">Người dùng chỉ chọn Có hoặc Không.</p>}
        </div>

        <LocaleTabs
          vi={localeFields("vi", initial.vi, {
            title: "Câu hỏi (VI) *",
            description: "Mô tả hướng dẫn (VI)",
            placeholder: "Placeholder (VI)",
          })}
          en={localeFields("en", initial.en, {
            title: "Question (EN) *",
            description: "Description (EN)",
            placeholder: "Placeholder (EN)",
          })}
        />
      </div>

      {isChoice && (
        <div className="mt-4">
          <p className="field-label">Lựa chọn ({options.length}/20)</p>
          {options.length === 0 && (
            <p className="mb-2 text-[11.5px] text-danger">Câu hỏi lựa chọn cần ít nhất một lựa chọn.</p>
          )}
          <div className="space-y-2">
            {options.map((option, index) => (
              <div key={option.id ?? `new-${index}`} className="flex flex-wrap items-start gap-2 border border-line bg-surface-muted/40 p-2.5">
                <span className="mt-2 w-5 text-center text-[11px] text-muted">{index + 1}</span>
                <div className="min-w-40 flex-1 space-y-2">
                  <input
                    value={option.vi.label}
                    onChange={(event) => updateOptionLabel(index, "vi", event.target.value)}
                    maxLength={200}
                    placeholder="Nhãn tiếng Việt *"
                    className="field"
                    aria-label={`Lựa chọn ${index + 1} — tiếng Việt`}
                  />
                  <input
                    value={option.en.label}
                    onChange={(event) => updateOptionLabel(index, "en", event.target.value)}
                    maxLength={200}
                    placeholder="Label in English *"
                    className="field"
                    aria-label={`Lựa chọn ${index + 1} — tiếng Anh`}
                  />
                </div>
                <div className="w-36">
                  <input
                    value={option.value}
                    onChange={(event) => updateOption(index, { value: event.target.value })}
                    maxLength={90}
                    placeholder="ma-lua-chon"
                    className="field font-mono text-[11px]"
                    aria-label={`Lựa chọn ${index + 1} — mã (value)`}
                  />
                  <p className="mt-1 text-[9.5px] text-muted">Mã duy nhất, slug viết thường.</p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => moveOption(index, -1)} disabled={index === 0} className="rounded-full border border-line px-2 py-1 text-[11px] disabled:opacity-40" aria-label="Đưa lựa chọn lên trên">
                    ↑
                  </button>
                  <button type="button" onClick={() => moveOption(index, 1)} disabled={index === options.length - 1} className="rounded-full border border-line px-2 py-1 text-[11px] disabled:opacity-40" aria-label="Đưa lựa chọn xuống dưới">
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => setOptions((previous) => previous.filter((_, i) => i !== index))}
                    className="rounded-full border border-danger/30 px-2 py-1 text-[11px] text-danger"
                  >
                    Xoá
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              setOptions((previous) => [
                ...previous,
                { value: "", order: previous.length, vi: { label: "" }, en: { label: "" } },
              ])
            }
            disabled={options.length >= 20}
            className="btn btn-outline btn-sm mt-2"
          >
            + Thêm lựa chọn
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-line pt-3">
        <button type="button" onClick={onCancel} className="btn btn-outline btn-sm">
          Huỷ
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? "Đang lưu…" : initial.id ? "Lưu câu hỏi" : "Thêm câu hỏi"}
        </button>
      </div>
    </form>
  );
}
