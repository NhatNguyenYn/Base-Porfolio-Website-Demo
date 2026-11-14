// Unit tests for the public survey validation (Phase 10, Agent C).
// Pure helpers only — no database. Run with:
//   npx vitest run tests/survey-validation.test.ts
import { describe, expect, it } from "vitest";
import {
  validateSurveyAnswers,
  type StoredQuestion,
} from "@/lib/survey-response-validation";
import { getDictionary } from "@/i18n";
import { interpolate } from "@/lib/utils";
import type { SurveyMessages } from "@/i18n/messages/vi";
import {
  hexToRgba,
  isValidHexColor,
  parseAccentedTitle,
  resolveSurveyTheme,
  SURVEY_THEME_PRESETS,
} from "@/lib/survey-theme";
import type { PublicSurveyTheme } from "@/lib/survey-theme";

const theme = (overrides: Partial<PublicSurveyTheme> = {}): PublicSurveyTheme => ({
  preset: "minimal",
  layout: "centered",
  progressStyle: "bar",
  buttonStyle: "solid",
  borderRadius: "md",
  primaryColor: null,
  accentColor: null,
  backgroundColor: null,
  surfaceColor: null,
  textColor: null,
  badgeFromColor: null,
  badgeToColor: null,
  ...overrides,
});

const baseQuestion = (overrides: Partial<StoredQuestion> = {}): StoredQuestion => ({
  id: "q1",
  type: "short_text",
  required: false,
  minLength: null,
  maxLength: null,
  minRating: null,
  maxRating: null,
  options: [],
  ...overrides,
});

const choiceQuestion = (type: StoredQuestion["type"] = "single_choice"): StoredQuestion =>
  baseQuestion({
    id: "q-choice",
    type,
    required: true,
    options: [
      { id: "o1", value: "red" },
      { id: "o2", value: "blue" },
    ],
  });

describe("validateSurveyAnswers", () => {
  it("accepts a valid answer set for every question type", () => {
    const questions: StoredQuestion[] = [
      baseQuestion({ id: "t1", type: "short_text", required: true }),
      baseQuestion({ id: "t2", type: "long_text" }),
      choiceQuestion("single_choice"),
      choiceQuestion("multiple_choice"),
      baseQuestion({
        id: "q-drop",
        type: "dropdown",
        options: [
          { id: "o1", value: "a" },
          { id: "o2", value: "b" },
        ],
      }),
      baseQuestion({ id: "q-rate", type: "rating", minRating: 1, maxRating: 5 }),
      baseQuestion({ id: "q-nps", type: "nps" }),
      baseQuestion({ id: "q-yn", type: "yes_no" }),
    ];
    // multiple_choice needs its own id for the map below.
    questions[3] = { ...questions[3], id: "q-multi" };
    const result = validateSurveyAnswers(questions, [
      { questionId: "t1", type: "short_text", value: "hello", optionValues: [] },
      { questionId: "t2", type: "long_text", value: "a longer answer", optionValues: [] },
      { questionId: "q-choice", type: "single_choice", value: "", optionValues: ["red"] },
      { questionId: "q-multi", type: "multiple_choice", value: "", optionValues: ["red", "blue"] },
      { questionId: "q-drop", type: "dropdown", value: "", optionValues: ["b"] },
      { questionId: "q-rate", type: "rating", value: "4", optionValues: [] },
      { questionId: "q-nps", type: "nps", value: "9", optionValues: [] },
      { questionId: "q-yn", type: "yes_no", value: "yes", optionValues: [] },
    ]);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    // multiple_choice produces one row per selected option.
    expect(result.rows.filter((row) => row.questionId === "q-multi")).toHaveLength(2);
    expect(result.rows.find((row) => row.questionId === "q-choice")).toMatchObject({
      optionId: "o1",
      value: "red",
    });
    expect(result.rows.find((row) => row.questionId === "q-rate")).toMatchObject({ value: "4" });
  });

  it("rejects a missing required answer and accepts a missing optional one", () => {
    const questions = [
      baseQuestion({ id: "req", required: true }),
      baseQuestion({ id: "opt", required: false }),
    ];
    const result = validateSurveyAnswers(questions, []);
    expect(result.ok).toBe(false);
    expect(result.errors.map((error) => error.questionId)).toEqual(["req"]);
  });

  it("rejects unknown and duplicate question ids, and type mismatches", () => {
    const questions = [baseQuestion({ id: "q1", type: "short_text" })];
    expect(
      validateSurveyAnswers(questions, [{ questionId: "nope", type: "short_text", value: "x" }]).ok,
    ).toBe(false);
    expect(
      validateSurveyAnswers(questions, [
        { questionId: "q1", type: "short_text", value: "x" },
        { questionId: "q1", type: "short_text", value: "y" },
      ]).ok,
    ).toBe(false);
    expect(
      validateSurveyAnswers(questions, [{ questionId: "q1", type: "nps", value: "5" }]).ok,
    ).toBe(false);
  });

  it("enforces text length ceilings and per-question bounds", () => {
    const short = baseQuestion({ id: "s", type: "short_text", maxLength: 5 });
    expect(validateSurveyAnswers([short], [{ questionId: "s", value: "toolong" }]).ok).toBe(false);
    expect(validateSurveyAnswers([short], [{ questionId: "s", value: "ok" }]).ok).toBe(true);
    const capped = baseQuestion({ id: "c", type: "short_text" });
    expect(
      validateSurveyAnswers([capped], [{ questionId: "c", value: "x".repeat(501) }]).ok,
    ).toBe(false);
    const min = baseQuestion({ id: "m", type: "long_text", minLength: 10 });
    expect(validateSurveyAnswers([min], [{ questionId: "m", value: "short" }]).ok).toBe(false);
  });

  it("rejects choice values outside the declared options and duplicate selections", () => {
    const single = choiceQuestion("single_choice");
    expect(
      validateSurveyAnswers([single], [{ questionId: "q-choice", optionValues: ["green"] }]).ok,
    ).toBe(false);
    expect(
      validateSurveyAnswers([single], [{ questionId: "q-choice", optionValues: [] }]).ok,
    ).toBe(false);
    const multi = choiceQuestion("multiple_choice");
    expect(
      validateSurveyAnswers(
        [multi],
        [{ questionId: "q-choice", optionValues: ["red", "red"] }],
      ).ok,
    ).toBe(false);
    expect(
      validateSurveyAnswers(
        [multi],
        [{ questionId: "q-choice", optionValues: ["red", "green"] }],
      ).ok,
    ).toBe(false);
  });

  it("enforces rating and NPS bounds, including per-question rating ranges", () => {
    const rating = baseQuestion({ id: "r", type: "rating", minRating: 1, maxRating: 5 });
    expect(validateSurveyAnswers([rating], [{ questionId: "r", value: "0" }]).ok).toBe(false);
    expect(validateSurveyAnswers([rating], [{ questionId: "r", value: "6" }]).ok).toBe(false);
    expect(validateSurveyAnswers([rating], [{ questionId: "r", value: "5" }]).ok).toBe(true);
    expect(validateSurveyAnswers([rating], [{ questionId: "r", value: "3.5" }]).ok).toBe(false);
    const nps = baseQuestion({ id: "n", type: "nps" });
    expect(validateSurveyAnswers([nps], [{ questionId: "n", value: "-1" }]).ok).toBe(false);
    expect(validateSurveyAnswers([nps], [{ questionId: "n", value: "11" }]).ok).toBe(false);
    expect(validateSurveyAnswers([nps], [{ questionId: "n", value: "0" }]).ok).toBe(true);
    expect(validateSurveyAnswers([nps], [{ questionId: "n", value: "10" }]).ok).toBe(true);
  });

  it("accepts only yes/no for yes_no questions", () => {
    const question = baseQuestion({ id: "y", type: "yes_no", required: true });
    expect(validateSurveyAnswers([question], [{ questionId: "y", value: "maybe" }]).ok).toBe(false);
    expect(validateSurveyAnswers([question], [{ questionId: "y", value: "no" }]).ok).toBe(true);
  });
});

describe("survey theme (15:14 editorial-vn)", () => {
  it("has an editorial-vn preset using the portfolio palette, not the reference brand colours", () => {
    expect(SURVEY_THEME_PRESETS["editorial-vn"]).toEqual({
      primary: "#17233a",
      accent: "#9b1c31",
      background: "#f8f8f6",
      surface: "#ffffff",
      text: "#20242c",
    });
    const resolved = resolveSurveyTheme(theme({ preset: "editorial-vn" }));
    expect(resolved.preset).toBe("editorial-vn");
    // Badge gradient defaults to the configured accent → primary.
    expect(resolved.badgeFrom).toBe("#9b1c31");
    expect(resolved.badgeTo).toBe("#17233a");
  });

  it("uses validated badge colours when configured, and rejects non-hex values", () => {
    const resolved = resolveSurveyTheme(
      theme({ badgeFromColor: "#7c3aed", badgeToColor: "#4f46e5" }),
    );
    expect(resolved.badgeFrom).toBe("#7c3aed");
    expect(resolved.badgeTo).toBe("#4f46e5");
    expect(isValidHexColor("#ff0000")).toBe(true);
    expect(isValidHexColor("red")).toBe(false);
    expect(isValidHexColor("javascript:alert(1)")).toBe(false);
    expect(isValidHexColor(null)).toBe(false);
    const fallback = resolveSurveyTheme(theme({ badgeFromColor: "red" }));
    expect(fallback.badgeFrom).toBe("#9b1c31");
  });

  it("converts hex to rgba for the dot pattern", () => {
    expect(hexToRgba("#9b1c31", 0.1)).toBe("rgba(155, 28, 49, 0.1)");
    expect(hexToRgba("not-a-colour", 0.1)).toBeNull();
  });

  it("splits **accent** spans in titles and keeps unmatched markers literal", () => {
    expect(parseAccentedTitle("Thực trạng sử dụng **AI** trong đào tạo")).toEqual([
      { text: "Thực trạng sử dụng ", accent: false },
      { text: "AI", accent: true },
      { text: " trong đào tạo", accent: false },
    ]);
    expect(parseAccentedTitle("No markers here")).toEqual([
      { text: "No markers here", accent: false },
    ]);
    expect(parseAccentedTitle("Unclosed **marker")).toEqual([
      { text: "Unclosed **marker", accent: false },
    ]);
    expect(parseAccentedTitle("**AI**")).toEqual([{ text: "AI", accent: true }]);
  });
});

describe("survey messages", () => {
  it("has identical keys in vi and en, with no empty strings", () => {
    const vi = getDictionary("vi").survey;
    const en = getDictionary("en").survey;
    const keys = Object.keys(vi) as (keyof SurveyMessages)[];
    expect(Object.keys(en).sort()).toEqual([...keys].sort());
    for (const key of keys) {
      expect(vi[key].trim().length).toBeGreaterThan(0);
      expect(en[key].trim().length).toBeGreaterThan(0);
    }
  });

  it("interpolates {placeholders}", () => {
    expect(interpolate("Bước {current} trên {total}", { current: 2, total: 5 })).toBe(
      "Bước 2 trên 5",
    );
    expect(interpolate("No placeholders", { current: 1 })).toBe("No placeholders");
  });
});

// ---------------------------------------------------------------------------
// Additions by Agent G (Phase 10J gaps): zod-level slug / theme / rating /
// NPS / option-dedupe checks. Appended, not a rewrite of Agent C's tests.
// ---------------------------------------------------------------------------
import {
  bookingServiceSchema,
  surveyAnswerSchema,
  surveyOptionSchema,
  surveyQuestionSchema,
  surveySchema,
} from "@/lib/validation";

const validSurveyInput = (overrides: Record<string, unknown> = {}) => ({
  slug: "khao-sat-kiem-thu",
  status: "draft",
  themePreset: "minimal",
  layout: "centered",
  progressStyle: "bar",
  buttonStyle: "solid",
  borderRadius: "md",
  isBookingIntake: false,
  vi: {
    title: "Khảo sát kiểm thử",
    subtitle: "",
    description: "",
    introduction: "",
    completionMessage: "",
    privacyNotice: "",
    highlights: "",
  },
  en: {
    title: "Test survey",
    subtitle: "",
    description: "",
    introduction: "",
    completionMessage: "",
    privacyNotice: "",
    highlights: "",
  },
  ...overrides,
});

describe("surveySchema (zod)", () => {
  it("accepts a minimal valid survey", () => {
    expect(surveySchema.safeParse(validSurveyInput()).success).toBe(true);
  });

  it("accepts every theme preset including editorial-vn, and rejects unknown presets", () => {
    for (const preset of ["minimal", "editorial", "modern", "premium", "editorial-vn"]) {
      expect(surveySchema.safeParse(validSurveyInput({ themePreset: preset })).success).toBe(true);
    }
    for (const preset of ["neon", "dark", "EDITORIAL-VN", "", "typeform"]) {
      expect(surveySchema.safeParse(validSurveyInput({ themePreset: preset })).success).toBe(false);
    }
  });

  it("accepts valid hex colours and rejects arbitrary CSS / non-hex values", () => {
    expect(
      surveySchema.safeParse(validSurveyInput({ primaryColor: "#17233a", accentColor: "#9b1c31" })).success,
    ).toBe(true);
    for (const bad of [
      "red",
      "#zzz",
      "#12345",
      "#1234567",
      "rgb(1,2,3)",
      "javascript:alert(1)",
      "red; background: url(evil)",
      "#17233a; color: red",
    ]) {
      expect(surveySchema.safeParse(validSurveyInput({ primaryColor: bad })).success).toBe(false);
    }
  });

  it("rejects invalid layout / progress / button / radius enums", () => {
    expect(surveySchema.safeParse(validSurveyInput({ layout: "masonry" })).success).toBe(false);
    expect(surveySchema.safeParse(validSurveyInput({ progressStyle: "circle" })).success).toBe(false);
    expect(surveySchema.safeParse(validSurveyInput({ buttonStyle: "ghost" })).success).toBe(false);
    expect(surveySchema.safeParse(validSurveyInput({ borderRadius: "xl" })).success).toBe(false);
    expect(surveySchema.safeParse(validSurveyInput({ status: "deleted" })).success).toBe(false);
  });

  it("rejects an over-long slug and an over-long title", () => {
    expect(surveySchema.safeParse(validSurveyInput({ slug: "a".repeat(91) })).success).toBe(false);
    expect(
      surveySchema.safeParse(
        validSurveyInput({ vi: { ...validSurveyInput().vi, title: "T".repeat(181) } }),
      ).success,
    ).toBe(false);
  });

  it("rejects estimatedMinutes outside 1–600", () => {
    expect(surveySchema.safeParse(validSurveyInput({ estimatedMinutes: 0 })).success).toBe(false);
    expect(surveySchema.safeParse(validSurveyInput({ estimatedMinutes: 601 })).success).toBe(false);
    expect(surveySchema.safeParse(validSurveyInput({ estimatedMinutes: 5 })).success).toBe(true);
  });
});

describe("surveyQuestionSchema / surveyOptionSchema (zod)", () => {
  const validQuestion = (overrides: Record<string, unknown> = {}) => ({
    type: "short_text",
    order: 0,
    required: false,
    vi: { title: "Câu hỏi?", description: "", placeholder: "" },
    en: { title: "Question?", description: "", placeholder: "" },
    ...overrides,
  });

  it("rejects an unknown question type and out-of-range rating bounds", () => {
    expect(surveyQuestionSchema.safeParse(validQuestion({ type: "matrix" })).success).toBe(false);
    expect(surveyQuestionSchema.safeParse(validQuestion({ type: "rating", minRating: 0 })).success).toBe(
      false,
    );
    expect(surveyQuestionSchema.safeParse(validQuestion({ type: "rating", maxRating: 11 })).success).toBe(
      false,
    );
    expect(
      surveyQuestionSchema.safeParse(validQuestion({ type: "rating", minRating: 1, maxRating: 5 }))
        .success,
    ).toBe(true);
  });

  it("rejects a question title over 300 chars", () => {
    expect(
      surveyQuestionSchema.safeParse(
        validQuestion({ vi: { title: "Q".repeat(301), description: "", placeholder: "" } }),
      ).success,
    ).toBe(false);
  });

  it("requires option values to be lowercase slugs and labels to be non-empty", () => {
    const base = {
      value: "red",
      order: 0,
      vi: { label: "Đỏ" },
      en: { label: "Red" },
    };
    expect(surveyOptionSchema.safeParse(base).success).toBe(true);
    expect(surveyOptionSchema.safeParse({ ...base, value: "Red" }).success).toBe(false);
    expect(surveyOptionSchema.safeParse({ ...base, value: "red blue" }).success).toBe(false);
    expect(surveyOptionSchema.safeParse({ ...base, value: "red_blue" }).success).toBe(false);
    expect(surveyOptionSchema.safeParse({ ...base, vi: { label: "" } }).success).toBe(false);
    expect(
      surveyOptionSchema.safeParse({ ...base, vi: { label: "L".repeat(201) } }).success,
    ).toBe(false);
  });
});

describe("surveyAnswerSchema (zod, per-answer bounds)", () => {
  it("enforces rating 1–10 and NPS 0–10 at the zod layer", () => {
    const rating = (value: string) => ({ questionId: "q1", type: "rating", value, optionValues: [] });
    expect(surveyAnswerSchema.safeParse(rating("1")).success).toBe(true);
    expect(surveyAnswerSchema.safeParse(rating("10")).success).toBe(true);
    expect(surveyAnswerSchema.safeParse(rating("0")).success).toBe(false);
    expect(surveyAnswerSchema.safeParse(rating("11")).success).toBe(false);
    expect(surveyAnswerSchema.safeParse(rating("3.5")).success).toBe(false);
    const nps = (value: string) => ({ questionId: "q1", type: "nps", value, optionValues: [] });
    expect(surveyAnswerSchema.safeParse(nps("0")).success).toBe(true);
    expect(surveyAnswerSchema.safeParse(nps("10")).success).toBe(true);
    expect(surveyAnswerSchema.safeParse(nps("-1")).success).toBe(false);
    expect(surveyAnswerSchema.safeParse(nps("11")).success).toBe(false);
  });

  it("rejects duplicate option selections and wrong choice cardinalities", () => {
    const multi = (optionValues: string[]) => ({
      questionId: "q1",
      type: "multiple_choice",
      value: "",
      optionValues,
    });
    expect(surveyAnswerSchema.safeParse(multi(["red", "red"])).success).toBe(false);
    expect(surveyAnswerSchema.safeParse(multi([])).success).toBe(false);
    expect(surveyAnswerSchema.safeParse(multi(["red", "blue"])).success).toBe(true);
    const single = (optionValues: string[]) => ({
      questionId: "q1",
      type: "single_choice",
      value: "",
      optionValues,
    });
    expect(surveyAnswerSchema.safeParse(single([])).success).toBe(false);
    expect(surveyAnswerSchema.safeParse(single(["red", "blue"])).success).toBe(false);
    expect(surveyAnswerSchema.safeParse(single(["red"])).success).toBe(true);
  });

  it("rejects yes_no answers other than yes/no and over-long short text", () => {
    expect(
      surveyAnswerSchema.safeParse({ questionId: "q1", type: "yes_no", value: "maybe", optionValues: [] })
        .success,
    ).toBe(false);
    expect(
      surveyAnswerSchema.safeParse({ questionId: "q1", type: "yes_no", value: "no", optionValues: [] })
        .success,
    ).toBe(true);
    expect(
      surveyAnswerSchema.safeParse({
        questionId: "q1",
        type: "short_text",
        value: "x".repeat(501),
        optionValues: [],
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown answer type", () => {
    expect(
      surveyAnswerSchema.safeParse({ questionId: "q1", type: "matrix", value: "x", optionValues: [] })
        .success,
    ).toBe(false);
  });
});

describe("bookingServiceSchema slug/duration (cross-check)", () => {
  it("rejects a service slug over 90 chars", () => {
    expect(
      bookingServiceSchema.safeParse({
        slug: "s".repeat(91),
        durationMinutes: 30,
        active: true,
        order: 0,
        vi: { name: "Tư vấn", description: "" },
        en: { name: "Consulting", description: "" },
      }).success,
    ).toBe(false);
  });
});
