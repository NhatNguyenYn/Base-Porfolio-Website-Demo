// Public survey data access (Phase 10, Agent C).
//
// NOTE ON OWNERSHIP: the audit assigns src/server/queries/surveys.ts to
// Agent B (survey admin). B's file now exists but holds admin-only queries
// (listSurveysForAdmin / getSurveyForAdmin) — no public getPublishedSurvey —
// so this barrel implements the public read itself. If B later adds a public
// query there, this file should become a thin re-export of it (following
// src/data/articles.ts) and the implementation here deleted; the DTO shapes
// below are the contract both sides share.
//
// Public-safety rules enforced here:
// - Only status "published", deletedAt null, publishedAt in the past, and
//   inside the optional startsAt/endsAt window is visible. Anything else is
//   "not_found" (draft) or "closed" (closed/archived/out of window) — the
//   caller decides which HTTP status that maps to.
// - No translation in the requested locale — for the survey itself OR for any
//   section/question/option it contains — is "not_translated". Content is
//   never rendered in the other language (existing pickTranslation
//   convention), and a partially-translated survey must not render with a
//   required question silently missing: the submit handler validates against
//   the stored questions, so a hidden required question could never be
//   answered.
// - The DTO contains public content + theme only. It NEVER contains
//   responses, respondent keys, or admin fields.
import "server-only";
import type { Locale } from "@/i18n/config";
import { prisma } from "@/server/db";
import { toMediaView } from "@/server/queries/media";
import { pickTranslation, type MediaView } from "@/server/queries/types";
import type { SurveyQuestionType } from "@/lib/survey-response-validation";
import type {
  PublicSurveyBorderRadius,
  PublicSurveyButtonStyle,
  PublicSurveyLayout,
  PublicSurveyProgressStyle,
  PublicSurveyThemePreset,
} from "@/lib/survey-theme";

// Theme types live in the pure helper module; re-exported here so existing
// imports from "@/data/surveys" keep working.
export type {
  PublicSurveyBorderRadius,
  PublicSurveyButtonStyle,
  PublicSurveyLayout,
  PublicSurveyProgressStyle,
  PublicSurveyTheme,
  PublicSurveyThemePreset,
} from "@/lib/survey-theme";
import type { PublicSurveyTheme } from "@/lib/survey-theme";

export type PublicSurveyOption = {
  id: string;
  value: string;
  label: string;
  order: number;
};

export type PublicSurveyQuestion = {
  id: string;
  sectionId: string | null;
  type: SurveyQuestionType;
  order: number;
  required: boolean;
  minLength: number | null;
  maxLength: number | null;
  minRating: number | null;
  maxRating: number | null;
  title: string;
  description: string;
  placeholder: string;
  options: PublicSurveyOption[];
};

export type PublicSurveyStep = {
  id: string;
  title: string;
  description: string;
  questions: PublicSurveyQuestion[];
};

export type PublicSurvey = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  introduction: string;
  completionMessage: string;
  privacyNotice: string;
  estimatedMinutes: number | null;
  cover: MediaView | null;
  /** Brand header (15:14 photo reference). Nulls = fall back to the site brand. */
  brandName: string | null;
  brandLogo: MediaView | null;
  /** Custom intro bullets from the survey translation (one line each). */
  highlights: string[];
  theme: PublicSurveyTheme;
  /** Wizard steps: one per section, in order, plus a trailing step for any unsectioned questions. */
  steps: PublicSurveyStep[];
  /** All questions, in display order (sections first, then unsectioned). */
  questions: PublicSurveyQuestion[];
  totalQuestions: number;
};

export type PublishedSurveyStatus = "ok" | "not_found" | "not_translated" | "closed";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Defence in depth: admin input was zod-validated, but never trust a stored colour blindly. */
function validHex(value: string | null | undefined): string | null {
  if (!value) return null;
  return HEX_COLOR.test(value.trim()) ? value.trim() : null;
}

function asPreset(value: string): PublicSurveyThemePreset {
  return value === "editorial" ||
    value === "modern" ||
    value === "premium" ||
    value === "editorial-vn"
    ? value
    : "minimal";
}
function asLayout(value: string): PublicSurveyLayout {
  return value === "split" || value === "editorial" ? value : "centered";
}
function asProgressStyle(value: string): PublicSurveyProgressStyle {
  return value === "dots" || value === "steps" ? value : "bar";
}
function asButtonStyle(value: string): PublicSurveyButtonStyle {
  return value === "outline" ? "outline" : "solid";
}
function asBorderRadius(value: string): PublicSurveyBorderRadius {
  return value === "sm" || value === "lg" || value === "full" ? value : "md";
}

function isQuestionType(value: string): value is SurveyQuestionType {
  return (
    value === "short_text" ||
    value === "long_text" ||
    value === "single_choice" ||
    value === "multiple_choice" ||
    value === "dropdown" ||
    value === "rating" ||
    value === "nps" ||
    value === "yes_no"
  );
}

type LoadedSurvey = NonNullable<
  Awaited<ReturnType<typeof loadSurveyRow>>
>;

async function loadSurveyRow(slug: string) {
  return prisma.survey.findUnique({
    where: { slug },
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
          options: { include: { translations: true }, orderBy: { order: "asc" } },
        },
        orderBy: { order: "asc" },
      },
    },
  });
}

/**
 * Maps a loaded survey row to the public DTO. Returns "not_translated" when
 * the survey — or any section/question/option it contains — lacks a
 * translation in this locale (content is never rendered in the other
 * language, and a partially-translated survey must not render with a
 * required question silently missing). Returns "not_found" for an unknown
 * stored question type.
 */
function mapLoadedSurvey(
  survey: LoadedSurvey,
  locale: Locale,
): { status: "ok" | "not_translated" | "not_found"; survey: PublicSurvey | null } {
  const { row: translation } = pickTranslation(survey.translations, locale);
  if (!translation) return { status: "not_translated", survey: null };

  const sectionRows = new Map(
    survey.sections.map((section) => {
      const { row } = pickTranslation(section.translations, locale);
      return [section.id, row] as const;
    }),
  );
  if ([...sectionRows.values()].some((row) => !row)) {
    return { status: "not_translated", survey: null };
  }

  const questions: PublicSurveyQuestion[] = [];
  for (const question of survey.questions) {
    if (!isQuestionType(question.type)) return { status: "not_found", survey: null };
    const { row: questionRow } = pickTranslation(question.translations, locale);
    if (!questionRow) return { status: "not_translated", survey: null };
    const options: PublicSurveyOption[] = [];
    for (const option of question.options) {
      const { row: optionRow } = pickTranslation(option.translations, locale);
      if (!optionRow) return { status: "not_translated", survey: null };
      options.push({ id: option.id, value: option.value, label: optionRow.label, order: option.order });
    }
    questions.push({
      id: question.id,
      sectionId: question.sectionId,
      type: question.type,
      order: question.order,
      required: question.required,
      minLength: question.minLength,
      maxLength: question.maxLength,
      minRating: question.minRating,
      maxRating: question.maxRating,
      title: questionRow.title,
      description: questionRow.description ?? "",
      placeholder: questionRow.placeholder ?? "",
      options,
    });
  }

  const steps: PublicSurveyStep[] = survey.sections.map((section) => {
    const row = sectionRows.get(section.id);
    return {
      id: section.id,
      title: row?.title ?? "",
      description: row?.description ?? "",
      questions: questions.filter((question) => question.sectionId === section.id),
    };
  });
  const unsectioned = questions.filter((question) => question.sectionId === null);
  if (unsectioned.length > 0) {
    steps.push({ id: "unsectioned", title: "", description: "", questions: unsectioned });
  }
  // A survey with no sections at all is a single step with every question.
  const visibleSteps = steps.filter((step) => step.questions.length > 0);

  return {
    status: "ok",
    survey: {
      id: survey.id,
      slug: survey.slug,
      title: translation.title,
      subtitle: translation.subtitle ?? "",
      description: translation.description ?? "",
      introduction: translation.introduction ?? "",
      completionMessage: translation.completionMessage ?? "",
      privacyNotice: translation.privacyNotice ?? "",
      estimatedMinutes: survey.estimatedMinutes,
      cover: toMediaView(survey.coverMedia),
      brandName: survey.brandName ?? null,
      brandLogo: toMediaView(survey.brandLogoMedia),
      highlights: (translation.highlights ?? "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
      theme: {
        preset: asPreset(survey.themePreset),
        layout: asLayout(survey.layout),
        progressStyle: asProgressStyle(survey.progressStyle),
        buttonStyle: asButtonStyle(survey.buttonStyle),
        borderRadius: asBorderRadius(survey.borderRadius),
        primaryColor: validHex(survey.primaryColor),
        accentColor: validHex(survey.accentColor),
        backgroundColor: validHex(survey.backgroundColor),
        surfaceColor: validHex(survey.surfaceColor),
        textColor: validHex(survey.textColor),
        badgeFromColor: validHex(survey.badgeFromColor),
        badgeToColor: validHex(survey.badgeToColor),
      },
      steps: visibleSteps,
      questions,
      totalQuestions: questions.length,
    },
  };
}

export async function getPublishedSurvey(
  slug: string,
  locale: Locale,
): Promise<{ status: PublishedSurveyStatus; survey: PublicSurvey | null }> {
  const now = new Date();
  const survey = await loadSurveyRow(slug);

  if (!survey || survey.deletedAt) return { status: "not_found", survey: null };
  if (survey.status === "closed" || survey.status === "archived") {
    return { status: "closed", survey: null };
  }
  if (
    survey.status !== "published" ||
    !survey.publishedAt ||
    survey.publishedAt.getTime() > now.getTime() ||
    (survey.startsAt && survey.startsAt.getTime() > now.getTime()) ||
    (survey.endsAt && survey.endsAt.getTime() < now.getTime())
  ) {
    // Drafts, scheduled-for-later and out-of-window surveys are
    // indistinguishable from missing — except closed/archived above, which
    // the submit handler reports as SURVEY_CLOSED.
    return { status: survey.status === "published" ? "closed" : "not_found", survey: null };
  }

  const mapped = mapLoadedSurvey(survey, locale);
  if (mapped.status === "not_translated") return { status: "not_translated", survey: null };
  if (mapped.status !== "ok" || !mapped.survey) return { status: "not_found", survey: null };
  return { status: "ok", survey: mapped.survey };
}

/**
 * Public display data for a CLOSED survey (closed / archived / expired).
 * The public page shows the intro + a pink "survey ended" status card
 * (15:14 photo reference) instead of a bare 404, so visitors who open an
 * old share link understand what happened. Drafts, not-yet-started surveys,
 * deleted surveys and surveys without a translation in this locale still
 * 404 — a closed survey must not leak a draft's content.
 */
export async function getClosedSurveyDisplay(
  slug: string,
  locale: Locale,
): Promise<{ survey: PublicSurvey | null }> {
  const now = new Date();
  const survey = await loadSurveyRow(slug);
  if (!survey || survey.deletedAt) return { survey: null };
  const isClosed =
    survey.status === "closed" ||
    survey.status === "archived" ||
    (survey.status === "published" &&
      survey.publishedAt &&
      survey.publishedAt.getTime() <= now.getTime() &&
      survey.endsAt &&
      survey.endsAt.getTime() < now.getTime());
  if (!isClosed) return { survey: null };
  const mapped = mapLoadedSurvey(survey, locale);
  if (mapped.status !== "ok" || !mapped.survey) return { survey: null };
  return { survey: mapped.survey };
}

/**
 * Locales that actually have a published translation of this survey.
 * Used for hreflang in generateMetadata so unpublished or missing languages
 * are not advertised to crawlers.
 */
export async function getSurveyLocales(slug: string): Promise<Locale[]> {
  const now = new Date();
  const row = await prisma.survey.findUnique({
    where: { slug },
    select: {
      status: true,
      deletedAt: true,
      publishedAt: true,
      startsAt: true,
      endsAt: true,
      translations: { select: { locale: true } },
    },
  });
  if (
    !row ||
    row.deletedAt ||
    row.status !== "published" ||
    !row.publishedAt ||
    row.publishedAt.getTime() > now.getTime() ||
    (row.startsAt && row.startsAt.getTime() > now.getTime()) ||
    (row.endsAt && row.endsAt.getTime() < now.getTime())
  ) {
    return [];
  }
  return row.translations
    .map((item) => item.locale)
    .filter((item): item is Locale => item === "vi" || item === "en");
}
