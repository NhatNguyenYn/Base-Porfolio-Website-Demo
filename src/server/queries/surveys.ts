import "server-only";

import { prisma } from "../db";
import { toMediaView } from "./media";
import type { MediaView } from "./types";

export type SurveyStatus = "draft" | "published" | "closed" | "archived";

export const SURVEY_STATUSES: SurveyStatus[] = ["draft", "published", "closed", "archived"];

export type SurveyListItem = {
  id: string;
  slug: string;
  status: string;
  titleVi: string;
  titleEn: string;
  cover: MediaView | null;
  themePreset: string;
  isBookingIntake: boolean;
  responseCount: number;
  lastResponseAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  startsAt: Date | null;
  endsAt: Date | null;
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();
}

export type SurveyAdminFilters = {
  q?: string;
  status?: string;
  sort?: string;
};

/**
 * Admin survey list. Response counts + last-response dates come from one
 * `groupBy` aggregation, never an N+1 per-survey query. Search / sort are
 * applied in memory (diacritic-folded, like the article list) because
 * titles live in translation rows.
 */
export async function listSurveysForAdmin(filters: SurveyAdminFilters = {}): Promise<SurveyListItem[]> {
  const [rows, stats] = await Promise.all([
    prisma.survey.findMany({
      where: { deletedAt: null },
      include: {
        coverMedia: true,
        translations: true,
        _count: { select: { responses: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.surveyResponse.groupBy({
      by: ["surveyId"],
      _count: { _all: true },
      _max: { submittedAt: true },
    }),
  ]);

  const lastBySurvey = new Map(stats.map((item) => [item.surveyId, item._max.submittedAt]));

  let items: SurveyListItem[] = rows.map((row) => {
    const vi = row.translations.find((item) => item.locale === "vi");
    const en = row.translations.find((item) => item.locale === "en");
    return {
      id: row.id,
      slug: row.slug,
      status: row.status,
      titleVi: vi?.title ?? "",
      titleEn: en?.title ?? "",
      cover: toMediaView(row.coverMedia),
      themePreset: row.themePreset,
      isBookingIntake: row.isBookingIntake,
      responseCount: row._count.responses,
      lastResponseAt: lastBySurvey.get(row.id) ?? null,
      publishedAt: row.publishedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
    };
  });

  if (filters.status && SURVEY_STATUSES.includes(filters.status as SurveyStatus)) {
    items = items.filter((item) => item.status === filters.status);
  }

  if (filters.q?.trim()) {
    const needle = normalize(filters.q.trim());
    items = items.filter(
      (item) =>
        normalize(item.titleVi).includes(needle) ||
        normalize(item.titleEn).includes(needle) ||
        normalize(item.slug).includes(needle),
    );
  }

  switch (filters.sort) {
    case "oldest":
      items.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      break;
    case "updated":
      items.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      break;
    case "title":
      items.sort((a, b) => (a.titleVi || a.titleEn).localeCompare(b.titleVi || b.titleEn, "vi"));
      break;
    case "responses":
      items.sort((a, b) => b.responseCount - a.responseCount || b.updatedAt.getTime() - a.updatedAt.getTime());
      break;
    case "newest":
    default:
      items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      break;
  }

  return items;
}

/**
 * Full survey for the admin builder: settings + translations + sections +
 * questions + options, all ordered. Response stats / response lists live in
 * Agent D's functions (separate file) — this query deliberately returns only
 * the response count, so the builder can warn about existing answers.
 */
export async function getSurveyForAdmin(id: string) {
  return prisma.survey.findFirst({
    where: { id, deletedAt: null },
    include: {
      coverMedia: true,
      brandLogoMedia: true,
      translations: true,
      sections: {
        include: { translations: true },
        orderBy: { order: "asc" },
      },
      questions: {
        include: {
          translations: true,
          options: {
            include: { translations: true },
            orderBy: { order: "asc" },
          },
        },
        orderBy: { order: "asc" },
      },
      _count: { select: { responses: true } },
    },
  });
}

export type SurveyForAdmin = NonNullable<Awaited<ReturnType<typeof getSurveyForAdmin>>>;
