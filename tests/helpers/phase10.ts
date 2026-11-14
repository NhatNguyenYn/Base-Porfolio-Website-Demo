// Shared fixtures for the Phase 10 vitest suites (Agent G).
//
// DB-backed helpers only — no HTTP here. The HTTP route handlers are
// exercised through the real handlers in the *_flow / *_anon suites, with
// `next/headers` mocked per file (see the vi.mock block at the top of those
// files). Fixture slugs are unique per call so files can share one test DB
// sequentially without colliding.
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/server/db";
import { FLOWERS } from "@/lib/flowers";

export function uid(): string {
  return randomBytes(6).toString("hex");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Reference-code shape: `BK-` + 6 unambiguous chars (no 0/O, 1/I/l). */
export const REFERENCE_CODE_RE = /^BK-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/;

export type FixtureOption = { value: string; labelVi: string; labelEn?: string };
export type FixtureQuestionSpec = {
  type: string;
  required?: boolean;
  order?: number;
  minRating?: number | null;
  maxRating?: number | null;
  options?: FixtureOption[];
};
export type FixtureQuestion = {
  id: string;
  type: string;
  required: boolean;
  minRating: number | null;
  maxRating: number | null;
  options: { id: string; value: string }[];
};

const DEFAULT_QUESTIONS: FixtureQuestionSpec[] = [
  { type: "short_text", required: true, order: 0 },
  {
    type: "single_choice",
    required: true,
    order: 1,
    options: [
      { value: "red", labelVi: "Đỏ", labelEn: "Red" },
      { value: "blue", labelVi: "Xanh", labelEn: "Blue" },
    ],
  },
  {
    type: "multiple_choice",
    required: false,
    order: 2,
    options: [
      { value: "red", labelVi: "Đỏ", labelEn: "Red" },
      { value: "blue", labelVi: "Xanh", labelEn: "Blue" },
    ],
  },
  { type: "rating", required: false, order: 3, minRating: 1, maxRating: 5 },
  { type: "nps", required: false, order: 4 },
  { type: "yes_no", required: false, order: 5 },
];

export type FixtureSurvey = {
  survey: { id: string; slug: string };
  questions: FixtureQuestion[];
};

/** Creates a draft survey (VI + EN translations) with the default 6 questions. */
export async function createSurveyFixture(opts: {
  slug?: string;
  titleVi?: string;
  questions?: FixtureQuestionSpec[];
  themePreset?: string;
  isBookingIntake?: boolean;
} = {}): Promise<FixtureSurvey> {
  const slug = opts.slug ?? `p10-${uid()}`;
  const specs = opts.questions ?? DEFAULT_QUESTIONS;
  const survey = await prisma.survey.create({
    data: {
      slug,
      status: "draft",
      themePreset: opts.themePreset ?? "minimal",
      isBookingIntake: opts.isBookingIntake ?? false,
      translations: {
        create: [
          {
            locale: "vi",
            title: opts.titleVi ?? "Khảo sát kiểm thử — tiếng Việt có dấu",
            subtitle: "Phụ đề kiểm thử",
            description: "Mô tả khảo sát kiểm thử.",
            introduction: "Giới thiệu khảo sát kiểm thử.",
            completionMessage: "Cảm ơn bạn đã hoàn thành khảo sát kiểm thử.",
            privacyNotice: "Khảo sát ẩn danh.",
          },
          {
            locale: "en",
            title: "Test survey",
            subtitle: "Test subtitle",
            description: "Test survey description.",
            introduction: "Test survey introduction.",
            completionMessage: "Thank you for completing the test survey.",
            privacyNotice: "Anonymous survey.",
          },
        ],
      },
    },
    select: { id: true, slug: true },
  });

  const questions: FixtureQuestion[] = [];
  for (const spec of specs) {
    const question = await prisma.surveyQuestion.create({
      data: {
        surveyId: survey.id,
        type: spec.type,
        order: spec.order ?? 0,
        required: spec.required ?? false,
        minRating: spec.minRating ?? null,
        maxRating: spec.maxRating ?? null,
        translations: {
          create: [
            { locale: "vi", title: `Câu hỏi kiểm thử ${spec.type}`, description: "", placeholder: "" },
            { locale: "en", title: `Test question ${spec.type}`, description: "", placeholder: "" },
          ],
        },
        options: spec.options
          ? {
              create: spec.options.map((option, index) => ({
                value: option.value,
                order: index,
                translations: {
                  create: [
                    { locale: "vi", label: option.labelVi },
                    { locale: "en", label: option.labelEn ?? option.labelVi },
                  ],
                },
              })),
            }
          : undefined,
      },
      include: { options: { select: { id: true, value: true }, orderBy: { order: "asc" } } },
    });
    questions.push({
      id: question.id,
      type: question.type,
      required: question.required,
      minRating: question.minRating,
      maxRating: question.maxRating,
      options: question.options,
    });
  }
  return { survey, questions };
}

export async function setSurveyStatus(id: string, status: string, publishedAt?: Date | null): Promise<void> {
  await prisma.survey.update({
    where: { id },
    data: { status, ...(publishedAt !== undefined ? { publishedAt } : {}) },
  });
}

export async function publishSurvey(id: string): Promise<void> {
  await setSurveyStatus(id, "published", new Date(Date.now() - 60_000));
}

/** A valid answers payload for the default fixture questions. */
export function validAnswers(questions: FixtureQuestion[]): { questionId: string; type: string; value: string; optionValues: string[] }[] {
  return questions.map((question) => {
    switch (question.type) {
      case "short_text":
        return { questionId: question.id, type: question.type, value: "Câu trả lời kiểm thử — tiếng Việt", optionValues: [] };
      case "long_text":
        return { questionId: question.id, type: question.type, value: "Câu trả lời dài kiểm thử.", optionValues: [] };
      case "single_choice":
      case "dropdown":
        return { questionId: question.id, type: question.type, value: "", optionValues: ["red"] };
      case "multiple_choice":
        return { questionId: question.id, type: question.type, value: "", optionValues: ["red", "blue"] };
      case "rating":
        return { questionId: question.id, type: question.type, value: "4", optionValues: [] };
      case "nps":
        return { questionId: question.id, type: question.type, value: "9", optionValues: [] };
      case "yes_no":
        return { questionId: question.id, type: question.type, value: "yes", optionValues: [] };
      default:
        return { questionId: question.id, type: question.type, value: "", optionValues: [] };
    }
  });
}

export async function createServiceFixture(opts: {
  slug?: string;
  durationMinutes?: number;
  intakeSurveyId?: string | null;
} = {}): Promise<{ id: string; slug: string }> {
  const slug = opts.slug ?? `svc-${uid()}`;
  const service = await prisma.bookingService.create({
    data: {
      slug,
      durationMinutes: opts.durationMinutes ?? 30,
      active: true,
      intakeSurveyId: opts.intakeSurveyId ?? null,
      translations: {
        create: [
          { locale: "vi", name: "Tư vấn kiểm thử", description: "Dịch vụ kiểm thử." },
          { locale: "en", name: "Test consultation", description: "Test service." },
        ],
      },
    },
    select: { id: true, slug: true },
  });
  return service;
}

/** A future slot start (UTC). Defaults to +2 days at 02:00 UTC (= 09:00 VN). */
export function futureStart(daysAhead = 2, utcHour = 2): Date {
  const start = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  start.setUTCHours(utcHour, 0, 0, 0);
  return start;
}

export async function createSlotFixture(
  serviceId: string,
  startsAt: Date,
  durationMinutes = 30,
): Promise<{ id: string; startsAt: Date; endsAt: Date }> {
  const slot = await prisma.bookingSlot.create({
    data: {
      serviceId,
      startsAt,
      endsAt: new Date(startsAt.getTime() + durationMinutes * 60_000),
      status: "available",
    },
    select: { id: true, startsAt: true, endsAt: true },
  });
  return slot;
}

/** Flower codes currently held by active (pending/confirmed) bookings. */
export async function activeFlowerCodes(): Promise<Set<string>> {
  const rows = await prisma.booking.findMany({
    where: { status: { in: ["pending", "confirmed"] } },
    select: { flowerCode: true },
  });
  return new Set(rows.map((row) => row.flowerCode));
}

export function freeFlowerCodes(used: Set<string>): string[] {
  return FLOWERS.map((flower) => flower.code).filter((code) => !used.has(code));
}

export async function countBookings(): Promise<number> {
  return prisma.booking.count();
}

export async function countResponses(surveyId?: string): Promise<number> {
  return prisma.surveyResponse.count({ where: surveyId ? { surveyId } : {} });
}
