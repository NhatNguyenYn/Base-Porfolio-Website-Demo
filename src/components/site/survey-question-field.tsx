// Per-question field renderers for the public survey wizard (Phase 10, Agent C).
// One renderer per question type; all inputs are native, keyboard-navigable,
// labelled, and carry aria-invalid / aria-describedby for errors.
"use client";

import type { PublicSurveyQuestion } from "@/data/surveys";
import { interpolate } from "@/lib/utils";
import type { SurveyMessages } from "@/i18n/messages/vi";
import { MAX_LONG_TEXT_ANSWER, MAX_RATING, MAX_SHORT_TEXT_ANSWER, NPS_MAX, NPS_MIN } from "@/lib/survey-limits";

export type SurveyAnswerValue = {
  value: string;
  optionValues: string[];
};

export const emptyAnswerValue = (): SurveyAnswerValue => ({ value: "", optionValues: [] });

function isAnswered(value: SurveyAnswerValue): boolean {
  return value.value.trim() !== "" || value.optionValues.length > 0;
}

export function answerValueToPayload(
  question: PublicSurveyQuestion,
  value: SurveyAnswerValue,
): { questionId: string; type: string; value: string; optionValues: string[] } | null {
  if (!isAnswered(value)) return null;
  return {
    questionId: question.id,
    type: question.type,
    value: value.value,
    optionValues: value.optionValues,
  };
}

function FieldError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-[12px] font-medium text-danger">
      {message}
    </p>
  );
}

function QuestionHeader({
  question,
  messages,
}: {
  question: PublicSurveyQuestion;
  messages: SurveyMessages;
}) {
  return (
    <div>
      <p className="text-[15px] font-medium leading-snug text-[var(--survey-text)]">
        {question.title}{" "}
        <span className={question.required ? "text-[var(--survey-accent)]" : "text-muted"}>
          {question.required ? `· ${messages.required}` : `· ${messages.optional}`}
        </span>
      </p>
      {question.description && (
        <p className="mt-1 text-[13px] leading-relaxed text-muted">{question.description}</p>
      )}
    </div>
  );
}

export function SurveyQuestionField({
  question,
  value,
  onChange,
  error,
  messages,
  disabled,
}: {
  question: PublicSurveyQuestion;
  value: SurveyAnswerValue;
  onChange: (next: SurveyAnswerValue) => void;
  error: string | null;
  messages: SurveyMessages;
  disabled: boolean;
}) {
  const errorId = `survey-q-${question.id}-error`;
  const describedBy = error ? errorId : undefined;
  const fieldClass = "field w-full min-w-0";
  const choiceInput = "h-4 w-4 shrink-0 accent-[var(--survey-primary)]";

  return (
    <div className="min-w-0">
      <QuestionHeader question={question} messages={messages} />

      <div className="mt-3 min-w-0">
        {(question.type === "short_text" || question.type === "long_text") && (
          <>
            {question.type === "short_text" ? (
              <input
                type="text"
                value={value.value}
                maxLength={question.maxLength ?? MAX_SHORT_TEXT_ANSWER}
                placeholder={question.placeholder || undefined}
                disabled={disabled}
                aria-invalid={Boolean(error)}
                aria-describedby={describedBy}
                onChange={(event) => onChange({ value: event.target.value, optionValues: [] })}
                className={fieldClass}
              />
            ) : (
              <textarea
                value={value.value}
                rows={5}
                maxLength={question.maxLength ?? MAX_LONG_TEXT_ANSWER}
                placeholder={question.placeholder || undefined}
                disabled={disabled}
                aria-invalid={Boolean(error)}
                aria-describedby={describedBy}
                onChange={(event) => onChange({ value: event.target.value, optionValues: [] })}
                className={`${fieldClass} resize-y`}
              />
            )}
            {(question.maxLength ?? null) !== null && (
              <p className="mt-1.5 text-right text-[11px] tabular-nums text-muted">
                {interpolate(messages.charactersLeft, {
                  count: Math.max(
                    0,
                    (question.maxLength ?? MAX_LONG_TEXT_ANSWER) - value.value.length,
                  ),
                })}
              </p>
            )}
          </>
        )}

        {(question.type === "single_choice" || question.type === "multiple_choice") && (
          <fieldset>
            <legend className="sr-only">
              {question.title} — {messages.chooseOne}
            </legend>
            <p className="mb-2 text-[12px] text-muted">
              {question.type === "single_choice" ? messages.chooseOne : messages.chooseMultiple}
            </p>
            <div className="grid gap-2">
              {question.options.map((option) => {
                const checked = value.optionValues.includes(option.value);
                const inputId = `survey-q-${question.id}-opt-${option.id}`;
                return (
                  <label
                    key={option.id}
                    htmlFor={inputId}
                    className={`flex min-w-0 cursor-pointer items-start gap-3 border px-3 py-2.5 text-[14px] leading-snug ${
                      checked
                        ? "border-[var(--survey-primary)] bg-[var(--survey-surface)]"
                        : "border-line bg-[var(--survey-surface)]"
                    }`}
                    style={{ borderRadius: "var(--survey-radius)" }}
                  >
                    <input
                      id={inputId}
                      type={question.type === "single_choice" ? "radio" : "checkbox"}
                      name={`survey-q-${question.id}`}
                      value={option.value}
                      checked={checked}
                      disabled={disabled}
                      aria-invalid={Boolean(error)}
                      onChange={() => {
                        if (question.type === "single_choice") {
                          onChange({ value: "", optionValues: [option.value] });
                        } else {
                          onChange({
                            value: "",
                            optionValues: checked
                              ? value.optionValues.filter((item) => item !== option.value)
                              : [...value.optionValues, option.value],
                          });
                        }
                      }}
                      className={`${choiceInput} mt-0.5`}
                    />
                    <span className="min-w-0 break-words text-[var(--survey-text)]">{option.label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        {question.type === "dropdown" && (
          <select
            value={value.optionValues[0] ?? ""}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            aria-label={question.title}
            onChange={(event) =>
              onChange({ value: "", optionValues: event.target.value ? [event.target.value] : [] })
            }
            className={fieldClass}
          >
            <option value="">{messages.selectPlaceholder}</option>
            {question.options.map((option) => (
              <option key={option.id} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}

        {question.type === "rating" && (
          <RatingScale
            question={question}
            value={value}
            onChange={onChange}
            disabled={disabled}
            error={Boolean(error)}
            min={question.minRating ?? 1}
            max={question.maxRating ?? MAX_RATING}
            lowLabel={String(question.minRating ?? 1)}
            highLabel={String(question.maxRating ?? MAX_RATING)}
            hint={interpolate(messages.ratingHint, {
              min: question.minRating ?? 1,
              max: question.maxRating ?? MAX_RATING,
            })}
          />
        )}

        {question.type === "nps" && (
          <RatingScale
            question={question}
            value={value}
            onChange={onChange}
            disabled={disabled}
            error={Boolean(error)}
            min={NPS_MIN}
            max={NPS_MAX}
            lowLabel={messages.npsLow}
            highLabel={messages.npsHigh}
            hint={messages.npsHint}
          />
        )}

        {question.type === "yes_no" && (
          <div className="flex flex-wrap gap-2" role="group" aria-label={question.title}>
            {(["yes", "no"] as const).map((choice) => {
              const selected = value.value === choice;
              return (
                <button
                  key={choice}
                  type="button"
                  disabled={disabled}
                  aria-pressed={selected}
                  onClick={() => onChange({ value: choice, optionValues: [] })}
                  className={`min-h-11 flex-1 border px-4 py-2.5 text-[14px] font-medium sm:flex-none sm:px-6 ${
                    selected
                      ? "border-[var(--survey-primary)] bg-[var(--survey-primary)] text-white"
                      : "border-line bg-[var(--survey-surface)] text-[var(--survey-text)]"
                  }`}
                  style={{ borderRadius: "var(--survey-radius)" }}
                >
                  {choice === "yes" ? messages.yes : messages.no}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <FieldError id={errorId} message={error} />
    </div>
  );
}

function RatingScale({
  question,
  value,
  onChange,
  disabled,
  error,
  min,
  max,
  lowLabel,
  highLabel,
  hint,
}: {
  question: PublicSurveyQuestion;
  value: SurveyAnswerValue;
  onChange: (next: SurveyAnswerValue) => void;
  disabled: boolean;
  error: boolean;
  min: number;
  max: number;
  lowLabel: string;
  highLabel: string;
  hint: string;
}) {
  const numbers: number[] = [];
  for (let n = min; n <= max; n++) numbers.push(n);
  return (
    <div>
      <p className="mb-2 text-[12px] text-muted">{hint}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={question.title}>
        {numbers.map((n) => {
          const selected = value.value === String(n);
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              aria-label={String(n)}
              onClick={() => onChange({ value: String(n), optionValues: [] })}
              className={`grid h-11 min-w-11 shrink-0 place-items-center border px-2 text-[14px] font-medium tabular-nums ${
                selected
                  ? "border-[var(--survey-primary)] bg-[var(--survey-primary)] text-white"
                  : "border-line bg-[var(--survey-surface)] text-[var(--survey-text)]"
              }`}
              style={{ borderRadius: "var(--survey-radius)" }}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between gap-4 text-[11px] text-muted">
        <span>{lowLabel}</span>
        <span className="text-right">{highLabel}</span>
      </div>
    </div>
  );
}
