// Pure, dependency-free validation of a submitted answers payload against the
// STORED question definitions (Phase 10, Agent C).
//
// Used by the public survey submit handler
// (src/app/api/surveys/[slug]/responses/route.ts) and reusable by the booking
// agent's intake flow — both must re-check answers server-side, because the
// zod schema alone cannot know the stored questions (required flags,
// per-question bounds, declared options).
//
// Rules, per question type:
// - short_text / long_text: required + per-question min/max length, capped by
//   the global answer ceilings.
// - single_choice / dropdown: exactly one option, and it must be one of the
//   question's declared option values.
// - multiple_choice: at least one option when required; every selected value
//   must be declared; duplicate selections are rejected.
// - rating: whole number within the question's min/max rating (defaults
//   1–MAX_RATING).
// - nps: whole number 0–10.
// - yes_no: exactly "yes" or "no".
// - A question absent from the payload counts as unanswered: an error only
//   when it is required. Unknown question ids and duplicate question ids in
//   the payload are rejected. A submitted `type` that disagrees with the
//   stored type is rejected (clients must send the stored type).
//
// The caller must omit unanswered questions from the payload (do not send an
// empty answer object for them): the zod answer schema rejects an empty
// single/multiple-choice answer even for optional questions.
import {
  MAX_LONG_TEXT_ANSWER,
  MAX_RATING,
  MAX_SHORT_TEXT_ANSWER,
  NPS_MAX,
  NPS_MIN,
} from "@/lib/survey-limits";

/** The 8 question types (kept as a literal union: the zod enum lives in
 * src/lib/validation.ts, but this module stays dependency-free of it). */
export type SurveyQuestionType =
  | "short_text"
  | "long_text"
  | "single_choice"
  | "multiple_choice"
  | "dropdown"
  | "rating"
  | "nps"
  | "yes_no";

export type StoredQuestionOption = {
  id: string;
  value: string;
};

export type StoredQuestion = {
  id: string;
  type: SurveyQuestionType;
  required: boolean;
  minLength: number | null;
  maxLength: number | null;
  minRating: number | null;
  maxRating: number | null;
  options: StoredQuestionOption[];
};

export type SubmittedAnswer = {
  questionId: string;
  /** Must match the stored question type when present. */
  type?: string;
  /** Text answer, or the rating/NPS number as text, or "yes"/"no". */
  value?: string;
  /** Selected option values (one for single_choice/dropdown, several for multiple_choice). */
  optionValues?: string[];
};

export type AnswerValidationError = {
  questionId: string;
  message: string;
};

export type ValidatedAnswerRow = {
  questionId: string;
  /** The selected option, for choice questions; null otherwise. */
  optionId: string | null;
  /** Text itself, the rating/NPS number as text, "yes"/"no", or the selected option value. */
  value: string;
};

export type AnswerValidationResult = {
  ok: boolean;
  errors: AnswerValidationError[];
  /** One row per answer (one row per selected option for multiple_choice). Empty when invalid. */
  rows: ValidatedAnswerRow[];
};

function isUnanswered(answer: SubmittedAnswer | undefined): boolean {
  if (!answer) return true;
  const value = (answer.value ?? "").trim();
  const options = answer.optionValues ?? [];
  return value === "" && options.length === 0;
}

export function validateSurveyAnswers(
  questions: StoredQuestion[],
  answers: SubmittedAnswer[],
): AnswerValidationResult {
  const errors: AnswerValidationError[] = [];
  const rows: ValidatedAnswerRow[] = [];
  const byId = new Map(questions.map((question) => [question.id, question]));

  const seen = new Set<string>();
  for (const answer of answers) {
    if (!answer.questionId) {
      errors.push({ questionId: "", message: "Question is required." });
      continue;
    }
    if (seen.has(answer.questionId)) {
      errors.push({ questionId: answer.questionId, message: "Duplicate answer for this question." });
      continue;
    }
    seen.add(answer.questionId);
    const stored = byId.get(answer.questionId);
    if (!stored) {
      errors.push({ questionId: answer.questionId, message: "Unknown question." });
      continue;
    }
    if (answer.type !== undefined && answer.type !== stored.type) {
      errors.push({ questionId: answer.questionId, message: "Answer type does not match the question." });
    }
  }
  // Bail early: per-question checks below assume each id maps to a stored question.
  if (errors.length > 0) return { ok: false, errors, rows: [] };

  const submitted = new Map(answers.map((answer) => [answer.questionId, answer]));

  for (const question of questions) {
    const answer = submitted.get(question.id);
    if (isUnanswered(answer)) {
      if (question.required) {
        errors.push({ questionId: question.id, message: "This question is required." });
      }
      continue;
    }
    const value = (answer?.value ?? "").trim();
    const optionValues = answer?.optionValues ?? [];

    switch (question.type) {
      case "short_text":
      case "long_text": {
        const cap = question.type === "short_text" ? MAX_SHORT_TEXT_ANSWER : MAX_LONG_TEXT_ANSWER;
        const max = Math.min(question.maxLength ?? cap, cap);
        const min = question.minLength ?? 0;
        if (value.length < min) {
          errors.push({ questionId: question.id, message: `Answer must be at least ${min} characters.` });
        } else if (value.length > max) {
          errors.push({ questionId: question.id, message: `Answer must be at most ${max} characters.` });
        } else {
          rows.push({ questionId: question.id, optionId: null, value });
        }
        break;
      }
      case "single_choice":
      case "dropdown": {
        if (optionValues.length !== 1) {
          errors.push({ questionId: question.id, message: "Choose exactly one option." });
          break;
        }
        const option = question.options.find((item) => item.value === optionValues[0]);
        if (!option) {
          errors.push({ questionId: question.id, message: "Selected option is not valid for this question." });
          break;
        }
        rows.push({ questionId: question.id, optionId: option.id, value: option.value });
        break;
      }
      case "multiple_choice": {
        if (new Set(optionValues).size !== optionValues.length) {
          errors.push({ questionId: question.id, message: "Duplicate options are not allowed." });
          break;
        }
        const invalid = optionValues.some(
          (selected) => !question.options.some((item) => item.value === selected),
        );
        if (invalid) {
          errors.push({ questionId: question.id, message: "Selected option is not valid for this question." });
          break;
        }
        for (const selected of optionValues) {
          const option = question.options.find((item) => item.value === selected);
          if (option) rows.push({ questionId: question.id, optionId: option.id, value: option.value });
        }
        break;
      }
      case "rating": {
        const min = Math.max(1, question.minRating ?? 1);
        const max = Math.min(MAX_RATING, question.maxRating ?? MAX_RATING);
        const n = Number(value);
        if (!Number.isInteger(n) || n < min || n > max) {
          errors.push({ questionId: question.id, message: `Rating must be a whole number from ${min} to ${max}.` });
        } else {
          rows.push({ questionId: question.id, optionId: null, value: String(n) });
        }
        break;
      }
      case "nps": {
        const n = Number(value);
        if (!Number.isInteger(n) || n < NPS_MIN || n > NPS_MAX) {
          errors.push({ questionId: question.id, message: `NPS must be a whole number from ${NPS_MIN} to ${NPS_MAX}.` });
        } else {
          rows.push({ questionId: question.id, optionId: null, value: String(n) });
        }
        break;
      }
      case "yes_no": {
        if (value !== "yes" && value !== "no") {
          errors.push({ questionId: question.id, message: "Answer must be yes or no." });
        } else {
          rows.push({ questionId: question.id, optionId: null, value });
        }
        break;
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors, rows: [] };
  return { ok: true, errors: [], rows };
}
