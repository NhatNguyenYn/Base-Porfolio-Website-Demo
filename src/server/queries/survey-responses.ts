import "server-only";
import { prisma } from "../db";

/**
 * Response management queries (Phase 10F).
 *
 * Lives in its own file (not queries/surveys.ts) because Agent B owns that
 * file concurrently; the audit's response-listing, response-detail and
 * stats functions are implemented here instead. Nothing in this file mutates
 * data, and no response is ever deleted in Phase 10.
 *
 * Privacy: SurveyResponse has no name/email/phone/ip columns by design
 * (prompt §10.1). `respondentKey` is a hash, never raw identity — it is
 * never selected for display anywhere in this file.
 */

export type ResponseTimeFilter = {
  from?: Date;
  to?: Date;
};

export type SurveyResponseHeader = {
  id: string;
  slug: string;
  status: string;
  title: string;
  deletedAt: Date | null;
};

function titleOf(
  translations: { locale: string; title: string }[],
  fallback: string,
): string {
  return (
    translations.find((item) => item.locale === "vi")?.title ||
    translations.find((item) => item.locale === "en")?.title ||
    fallback
  );
}

export function questionTitleOf(
  translations: { locale: string; title: string }[],
  fallback: string,
): string {
  return titleOf(translations, fallback);
}

export function optionLabelOf(
  translations: { locale: string; label: string }[],
  fallback: string,
): string {
  return (
    translations.find((item) => item.locale === "vi")?.label ||
    translations.find((item) => item.locale === "en")?.label ||
    fallback
  );
}

/** Vietnamese label for a question type (admin UI is VI-only). */
export function questionTypeLabel(type: string): string {
  switch (type) {
    case "short_text":
      return "Văn bản ngắn";
    case "long_text":
      return "Văn bản dài";
    case "single_choice":
      return "Chọn một đáp án";
    case "multiple_choice":
      return "Chọn nhiều đáp án";
    case "dropdown":
      return "Danh sách chọn";
    case "rating":
      return "Thang đánh giá";
    case "nps":
      return "NPS";
    case "yes_no":
      return "Có / Không";
    default:
      return type;
  }
}

/**
 * Human-readable display text for one stored answer row. For choice answers
 * pass the resolved option label; for yes/no the value maps to Có/Không.
 * Pure text/rating/NPS answers pass through unchanged.
 */
export function displayAnswerValue(input: {
  type: string;
  value: string;
  optionLabel?: string | null;
}): string {
  if (input.type === "yes_no") {
    if (input.value === "yes") return "Có";
    if (input.value === "no") return "Không";
    return input.value;
  }
  if (input.optionLabel) return input.optionLabel;
  return input.value;
}

/** Survey header for the responses screens. Queried here (not via surveys.ts). */
export async function getSurveyForResponses(
  surveyId: string,
): Promise<SurveyResponseHeader | null> {
  const survey = await prisma.survey.findFirst({
    where: { id: surveyId },
    select: { id: true, slug: true, status: true, deletedAt: true, translations: true },
  });
  if (!survey) return null;
  return {
    id: survey.id,
    slug: survey.slug,
    status: survey.status,
    title: titleOf(survey.translations, survey.slug),
    deletedAt: survey.deletedAt,
  };
}

function submittedAtWhere(filter: ResponseTimeFilter) {
  if (!filter.from && !filter.to) return undefined;
  return {
    ...(filter.from ? { gte: filter.from } : {}),
    ...(filter.to ? { lte: filter.to } : {}),
  };
}

export type ResponseRow = {
  id: string;
  locale: string;
  submittedAt: Date;
  answerCount: number;
  /** True when every required question of the survey was answered. */
  complete: boolean;
};

export async function listResponsesForAdmin(
  surveyId: string,
  opts: { page?: number; perPage?: number } & ResponseTimeFilter = {},
): Promise<{ items: ResponseRow[]; total: number; page: number; pages: number; perPage: number }> {
  const perPage = Math.min(Math.max(1, opts.perPage ?? 20), 100);
  const submittedAt = submittedAtWhere(opts);
  const where = { surveyId, ...(submittedAt ? { submittedAt } : {}) };

  const total = await prisma.surveyResponse.count({ where });
  const pages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(1, opts.page ?? 1), pages);

  const rows = await prisma.surveyResponse.findMany({
    where,
    orderBy: { submittedAt: "desc" },
    skip: (page - 1) * perPage,
    take: perPage,
    select: {
      id: true,
      locale: true,
      submittedAt: true,
      _count: { select: { answers: true } },
    },
  });

  // Validity for this page only: required questions vs. answered questions.
  let completeById = new Map<string, boolean>();
  if (rows.length > 0) {
    const required = await prisma.surveyQuestion.findMany({
      where: { surveyId },
      select: { id: true, required: true },
    });
    const requiredIds = required.filter((item) => item.required).map((item) => item.id);
    if (requiredIds.length === 0) {
      completeById = new Map(rows.map((row) => [row.id, true]));
    } else {
      const pairs = await prisma.surveyAnswer.groupBy({
        by: ["responseId", "questionId"],
        where: { responseId: { in: rows.map((row) => row.id) } },
        _count: true,
      });
      const answeredByResponse = new Map<string, Set<string>>();
      for (const pair of pairs) {
        const set = answeredByResponse.get(pair.responseId) ?? new Set<string>();
        set.add(pair.questionId);
        answeredByResponse.set(pair.responseId, set);
      }
      completeById = new Map(
        rows.map((row) => [
          row.id,
          requiredIds.every((questionId) => answeredByResponse.get(row.id)?.has(questionId)),
        ]),
      );
    }
  }

  return {
    items: rows.map((row) => ({
      id: row.id,
      locale: row.locale,
      submittedAt: row.submittedAt,
      answerCount: row._count.answers,
      complete: completeById.get(row.id) ?? true,
    })),
    total,
    page,
    pages,
    perPage,
  };
}

export type ResponseAnswerDetail = {
  questionId: string;
  questionTitle: string;
  questionType: string;
  required: boolean;
  /** One display string per answer row (multiple_choice yields several). */
  values: string[];
};

export type ResponseDetail = {
  id: string;
  surveyId: string;
  surveySlug: string;
  surveyTitle: string;
  surveyStatus: string;
  locale: string;
  submittedAt: Date;
  complete: boolean;
  /** Required questions left unanswered, by title. */
  missingRequired: string[];
  answers: ResponseAnswerDetail[];
};

/** Single response with per-question answers, in question order. */
export async function getResponseDetail(responseId: string): Promise<ResponseDetail | null> {
  const response = await prisma.surveyResponse.findUnique({
    where: { id: responseId },
    include: {
      survey: {
        select: {
          id: true,
          slug: true,
          status: true,
          translations: true,
          questions: {
            select: { id: true, required: true },
            orderBy: { order: "asc" },
          },
        },
      },
      answers: {
        include: {
          question: {
            select: {
              id: true,
              type: true,
              order: true,
              required: true,
              translations: true,
            },
          },
          option: {
            select: { value: true, translations: true },
          },
        },
      },
    },
  });
  if (!response) return null;

  const requiredIds = response.survey.questions.filter((item) => item.required).map((item) => item.id);
  const answeredIds = new Set(response.answers.map((answer) => answer.questionId));

  // Group answer rows by question, preserving question order.
  const byQuestion = new Map<string, ResponseAnswerDetail>();
  for (const answer of response.answers) {
    const question = answer.question;
    const existing = byQuestion.get(question.id);
    const text = displayAnswerValue({
      type: question.type,
      value: answer.value,
      optionLabel: answer.option
        ? optionLabelOf(answer.option.translations, answer.option.value)
        : null,
    });
    if (existing) {
      existing.values.push(text);
    } else {
      byQuestion.set(question.id, {
        questionId: question.id,
        questionTitle: questionTitleOf(question.translations, question.id),
        questionType: question.type,
        required: question.required,
        values: [text],
      });
    }
  }
  const answers = [...byQuestion.values()].sort((a, b) => {
    const orderA = response.answers.find((item) => item.questionId === a.questionId)?.question.order ?? 0;
    const orderB = response.answers.find((item) => item.questionId === b.questionId)?.question.order ?? 0;
    return orderA - orderB;
  });

  // Required questions with no answer row at all.
  const questionTitles = new Map(
    response.answers.map((answer) => [
      answer.questionId,
      questionTitleOf(answer.question.translations, answer.questionId),
    ]),
  );
  const missingRequired: string[] = [];
  for (const questionId of requiredIds) {
    if (!answeredIds.has(questionId)) {
      // Title may not be among the answered questions; look it up directly.
      const title =
        questionTitles.get(questionId) ??
        (await prisma.surveyQuestion
          .findUnique({ where: { id: questionId }, select: { translations: true } })
          .then((row) => (row ? questionTitleOf(row.translations, questionId) : questionId)));
      missingRequired.push(title ?? questionId);
    }
  }

  return {
    id: response.id,
    surveyId: response.survey.id,
    surveySlug: response.survey.slug,
    surveyTitle: titleOf(response.survey.translations, response.survey.slug),
    surveyStatus: response.survey.status,
    locale: response.locale,
    submittedAt: response.submittedAt,
    complete: missingRequired.length === 0,
    missingRequired,
    answers,
  };
}

export type SurveyStats = {
  total: number;
  completed: number;
  timeline: { date: string; count: number }[];
  rating: {
    questionId: string;
    title: string;
    average: number | null;
    count: number;
    distribution: { value: number; count: number }[];
  }[];
  nps: {
    questionId: string;
    title: string;
    average: number | null;
    count: number;
    promoters: number;
    passives: number;
    detractors: number;
    /** NPS score = %promoters − %detractors, range −100…100. */
    score: number | null;
  }[];
  distributions: {
    questionId: string;
    title: string;
    type: string;
    options: { optionId: string; label: string; count: number }[];
    answered: number;
    unanswered: number;
  }[];
  textCounts: { questionId: string; title: string; count: number }[];
};

/**
 * Aggregates computed from SurveyAnswer rows only — never fabricated.
 * Rating/NPS averages appear only when a question of that type exists.
 */
export async function surveyStats(
  surveyId: string,
  filter: ResponseTimeFilter = {},
): Promise<SurveyStats> {
  const submittedAt = submittedAtWhere(filter);
  const responseWhere = { surveyId, ...(submittedAt ? { submittedAt } : {}) };
  const answerWhere = {
    response: { surveyId, ...(submittedAt ? { submittedAt } : {}) },
  };

  const questions = await prisma.surveyQuestion.findMany({
    where: { surveyId },
    include: { translations: true, options: { include: { translations: true }, orderBy: { order: "asc" } } },
    orderBy: { order: "asc" },
  });

  const [total, submittedRows, pairs] = await Promise.all([
    prisma.surveyResponse.count({ where: responseWhere }),
    prisma.surveyResponse.findMany({
      where: responseWhere,
      select: { id: true, submittedAt: true },
    }),
    prisma.surveyAnswer.groupBy({
      by: ["responseId", "questionId"],
      where: answerWhere,
      _count: true,
    }),
  ]);

  // Completion: a response is complete when it answered every required question.
  const requiredIds = questions.filter((item) => item.required).map((item) => item.id);
  const answeredByResponse = new Map<string, Set<string>>();
  for (const pair of pairs) {
    const set = answeredByResponse.get(pair.responseId) ?? new Set<string>();
    set.add(pair.questionId);
    answeredByResponse.set(pair.responseId, set);
  }
  const completed =
    requiredIds.length === 0
      ? total
      : submittedRows.filter((row) =>
          requiredIds.every((questionId) => answeredByResponse.get(row.id)?.has(questionId)),
        ).length;

  // Timeline: submissions grouped by day (Asia/Ho_Chi_Minh).
  const dayFormat = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timelineMap = new Map<string, number>();
  for (const row of submittedRows) {
    const day = dayFormat.format(row.submittedAt);
    timelineMap.set(day, (timelineMap.get(day) ?? 0) + 1);
  }
  const timeline = [...timelineMap.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const answeredCountByQuestion = new Map<string, number>();
  for (const pair of pairs) {
    answeredCountByQuestion.set(pair.questionId, (answeredCountByQuestion.get(pair.questionId) ?? 0) + 1);
  }

  // Numeric answers (rating / NPS): group by question + value, then average.
  const numericByQuestion = new Map<string, Map<number, number>>();
  const ratingQuestions = questions.filter((item) => item.type === "rating" || item.type === "nps");
  if (ratingQuestions.length > 0) {
    const groups = await prisma.surveyAnswer.groupBy({
      by: ["questionId", "value"],
      where: { ...answerWhere, questionId: { in: ratingQuestions.map((item) => item.id) } },
      _count: true,
    });
    for (const group of groups) {
      const n = Number(group.value);
      if (!Number.isInteger(n)) continue;
      const byValue = numericByQuestion.get(group.questionId) ?? new Map<number, number>();
      byValue.set(n, (byValue.get(n) ?? 0) + group._count);
      numericByQuestion.set(group.questionId, byValue);
    }
  }

  const rating = questions
    .filter((item) => item.type === "rating")
    .map((question) => {
      const byValue = numericByQuestion.get(question.id) ?? new Map<number, number>();
      const min = question.minRating ?? 1;
      const max = question.maxRating ?? 10;
      let sum = 0;
      let count = 0;
      const distribution: { value: number; count: number }[] = [];
      for (let value = min; value <= max; value += 1) {
        const c = byValue.get(value) ?? 0;
        distribution.push({ value, count: c });
        sum += value * c;
        count += c;
      }
      return {
        questionId: question.id,
        title: questionTitleOf(question.translations, question.id),
        average: count > 0 ? sum / count : null,
        count,
        distribution,
      };
    });

  const nps = questions
    .filter((item) => item.type === "nps")
    .map((question) => {
      const byValue = numericByQuestion.get(question.id) ?? new Map<number, number>();
      let sum = 0;
      let count = 0;
      let promoters = 0;
      let passives = 0;
      let detractors = 0;
      for (let value = 0; value <= 10; value += 1) {
        const c = byValue.get(value) ?? 0;
        sum += value * c;
        count += c;
        if (value >= 9) promoters += c;
        else if (value >= 7) passives += c;
        else detractors += c;
      }
      return {
        questionId: question.id,
        title: questionTitleOf(question.translations, question.id),
        average: count > 0 ? sum / count : null,
        count,
        promoters,
        passives,
        detractors,
        score: count > 0 ? Math.round(((promoters - detractors) / count) * 100) : null,
      };
    });

  // Choice distributions: count per option (options with zero answers included).
  const distributions: SurveyStats["distributions"] = [];
  const choiceQuestions = questions.filter((item) =>
    ["single_choice", "multiple_choice", "dropdown"].includes(item.type),
  );
  if (choiceQuestions.length > 0) {
    const groups = await prisma.surveyAnswer.groupBy({
      by: ["questionId", "optionId"],
      where: { ...answerWhere, questionId: { in: choiceQuestions.map((item) => item.id) } },
      _count: true,
    });
    const countByKey = new Map<string, number>();
    for (const group of groups) {
      if (!group.optionId) continue;
      countByKey.set(`${group.questionId}:${group.optionId}`, group._count);
    }
    for (const question of choiceQuestions) {
      const answered = answeredCountByQuestion.get(question.id) ?? 0;
      distributions.push({
        questionId: question.id,
        title: questionTitleOf(question.translations, question.id),
        type: question.type,
        options: question.options.map((option) => ({
          optionId: option.id,
          label: optionLabelOf(option.translations, option.value),
          count: countByKey.get(`${question.id}:${option.id}`) ?? 0,
        })),
        answered,
        unanswered: Math.max(0, total - answered),
      });
    }
  }

  const textCounts = questions
    .filter((item) => item.type === "short_text" || item.type === "long_text")
    .map((question) => ({
      questionId: question.id,
      title: questionTitleOf(question.translations, question.id),
      count: answeredCountByQuestion.get(question.id) ?? 0,
    }));

  return { total, completed, timeline, rating, nps, distributions, textCounts };
}

// ---------------------------------------------------------------------------
// CSV helpers (RFC 4180 + formula-injection guard, audit §11.7 risk #17)
// ---------------------------------------------------------------------------

/**
 * Escapes one CSV cell: prefixes a single quote when the cell starts with a
 * formula trigger (`=`, `+`, `-`, `@`, tab, CR) so spreadsheet apps never
 * evaluate respondent input as a formula, then applies RFC 4180 quoting.
 */
export function escapeCsvCell(raw: string): string {
  let value = raw;
  if (value.length > 0 && ["=", "+", "-", "@", "\t", "\r"].includes(value[0])) {
    value = `'${value}`;
  }
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsvRow(cells: string[]): string {
  return cells.map(escapeCsvCell).join(",");
}
