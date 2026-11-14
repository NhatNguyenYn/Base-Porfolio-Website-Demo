"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "../db";
import { requireUser } from "../auth";
import { logActivity } from "../audit";
import {
  surveyOptionSchema,
  surveyQuestionSchema,
  surveySchema,
  zodFieldErrors,
} from "@/lib/validation";
import {
  MAX_OPTIONS_PER_QUESTION,
  MAX_QUESTIONS_PER_SURVEY,
  MAX_SECTIONS_PER_SURVEY,
} from "@/lib/survey-limits";
import { slugify } from "@/lib/utils";
import { getBool, getString, parseDateValue, readLocaleBlock, uniqueSlug } from "./helpers";
import type { ActionState } from "@/lib/action-state";

const SURVEY_TRANSLATION_FIELDS = [
  "title",
  "subtitle",
  "description",
  "introduction",
  "completionMessage",
  "privacyNotice",
  // BỔ SUNG 15:14 (A2): one bullet per line, shown on the survey intro page.
  "highlights",
];

const QUESTION_TRANSLATION_FIELDS = ["title", "description", "placeholder"];
const SECTION_TRANSLATION_FIELDS = ["title", "description"];
const CHOICE_TYPES = ["single_choice", "multiple_choice", "dropdown"] as const;
const SURVEY_STATUSES = ["draft", "published", "closed", "archived"] as const;

function isRedirectError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "digest" in error;
}

/** Empty string in FormData means "not set" — zod's coerce would turn it into NaN. */
function optionalNumber(formData: FormData, key: string): number | undefined {
  const raw = getString(formData, key);
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function optionalText(formData: FormData, key: string): string | undefined {
  return getString(formData, key) || undefined;
}

function revalidateSurvey(id: string): void {
  revalidatePath("/", "layout");
  revalidatePath("/admin/surveys");
  revalidatePath(`/admin/surveys/${id}`);
}

// ---------------------------------------------------------------------------
// Survey settings (create / edit)
// ---------------------------------------------------------------------------

export async function saveSurveyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = getString(formData, "id") || undefined;

  const parsed = surveySchema.safeParse({
    id,
    slug: optionalText(formData, "slug"),
    status: getString(formData, "status") || "draft",
    coverMediaId: optionalText(formData, "coverMediaId"),
    // BỔ SUNG 15:14 (A2): brand band + completion badge gradient. Coded
    // as-if the schema/zod columns exist; see the Agent B report if
    // typecheck flags these before A2 lands.
    brandName: optionalText(formData, "brandName"),
    brandLogoMediaId: optionalText(formData, "brandLogoMediaId"),
    badgeFromColor: optionalText(formData, "badgeFromColor"),
    badgeToColor: optionalText(formData, "badgeToColor"),
    themePreset: getString(formData, "themePreset") || "minimal",
    layout: getString(formData, "layout") || "centered",
    progressStyle: getString(formData, "progressStyle") || "bar",
    primaryColor: optionalText(formData, "primaryColor"),
    accentColor: optionalText(formData, "accentColor"),
    backgroundColor: optionalText(formData, "backgroundColor"),
    surfaceColor: optionalText(formData, "surfaceColor"),
    textColor: optionalText(formData, "textColor"),
    buttonStyle: getString(formData, "buttonStyle") || "solid",
    borderRadius: getString(formData, "borderRadius") || "md",
    estimatedMinutes: optionalNumber(formData, "estimatedMinutes"),
    startsAt: optionalText(formData, "startsAt"),
    endsAt: optionalText(formData, "endsAt"),
    isBookingIntake: getBool(formData, "isBookingIntake"),
    vi: readLocaleBlock(formData, "vi", SURVEY_TRANSLATION_FIELDS),
    en: readLocaleBlock(formData, "en", SURVEY_TRANSLATION_FIELDS),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Vui lòng kiểm tra các trường được đánh dấu.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const data = parsed.data;
  const startsAt = parseDateValue(data.startsAt);
  const endsAt = parseDateValue(data.endsAt);
  if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
    return {
      ok: false,
      message: "Ngày kết thúc phải sau ngày bắt đầu.",
      fieldErrors: { endsAt: ["Ngày kết thúc phải sau ngày bắt đầu."] },
    };
  }

  const exists = async (candidate: string) => {
    const found = await prisma.survey.findFirst({
      where: { slug: candidate, ...(id ? { NOT: { id } } : {}) },
      select: { id: true },
    });
    return Boolean(found);
  };
  const slug = id
    ? data.slug
      ? await uniqueSlug(slugify(data.slug), exists)
      : (await prisma.survey.findUnique({ where: { id }, select: { slug: true } }))?.slug ??
        slugify(data.vi.title || data.en.title)
    : await uniqueSlug(slugify(data.slug || data.vi.title || data.en.title) || "survey", exists);

  try {
    const survey = await prisma.$transaction(async (tx) => {
      const existing = id
        ? await tx.survey.findUnique({ where: { id }, select: { publishedAt: true } })
        : null;

      // First publish stamps publishedAt; later status changes keep it as history.
      const publishedAt =
        data.status === "published" ? existing?.publishedAt ?? new Date() : (existing?.publishedAt ?? null);

      const common = {
        slug,
        status: data.status,
        coverMediaId: data.coverMediaId ?? null,
        // BỔ SUNG 15:14 (A2 columns).
        brandName: data.brandName ?? null,
        brandLogoMediaId: data.brandLogoMediaId ?? null,
        badgeFromColor: data.badgeFromColor ?? null,
        badgeToColor: data.badgeToColor ?? null,
        themePreset: data.themePreset,
        layout: data.layout,
        progressStyle: data.progressStyle,
        primaryColor: data.primaryColor ?? null,
        accentColor: data.accentColor ?? null,
        backgroundColor: data.backgroundColor ?? null,
        surfaceColor: data.surfaceColor ?? null,
        textColor: data.textColor ?? null,
        buttonStyle: data.buttonStyle,
        borderRadius: data.borderRadius,
        estimatedMinutes: data.estimatedMinutes ?? null,
        startsAt,
        endsAt,
        publishedAt,
        isBookingIntake: data.isBookingIntake,
      };

      const record = id
        ? await tx.survey.update({ where: { id }, data: common })
        : await tx.survey.create({ data: common });

      for (const locale of ["vi", "en"] as const) {
        const block = data[locale];
        await tx.surveyTranslation.upsert({
          where: { surveyId_locale: { surveyId: record.id, locale } },
          update: {
            title: block.title,
            subtitle: block.subtitle,
            description: block.description,
            introduction: block.introduction,
            completionMessage: block.completionMessage,
            privacyNotice: block.privacyNotice,
            highlights: block.highlights,
          },
          create: {
            surveyId: record.id,
            locale,
            title: block.title,
            subtitle: block.subtitle,
            description: block.description,
            introduction: block.introduction,
            completionMessage: block.completionMessage,
            privacyNotice: block.privacyNotice,
            highlights: block.highlights,
          },
        });
      }
      return record;
    });

    await logActivity({
      userId: user.id,
      action: id ? "update" : "create",
      entityType: "survey",
      entityId: survey.id,
      summary: `${id ? "Updated" : "Created"} survey “${data.vi.title || data.en.title}” (${data.status})`,
    });

    revalidateSurvey(survey.id);
    redirect(`/admin/surveys/${survey.id}?saved=1`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error("[survey] save failed", error);
    return { ok: false, message: "Không thể lưu khảo sát. Vui lòng thử lại." };
  }
}

// ---------------------------------------------------------------------------
// Lifecycle: publish / close / archive / reopen as draft
// ---------------------------------------------------------------------------

export async function setSurveyStatusAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = getString(formData, "id");
  const status = getString(formData, "status");
  if (!id || !(SURVEY_STATUSES as readonly string[]).includes(status)) return;

  const survey = await prisma.survey.findFirst({ where: { id, deletedAt: null } });
  if (!survey) return;

  // Publish requires a slug (DB-unique) and at least one titled translation;
  // the slug is guaranteed unique by the column, this is the pre-publish check.
  if (status === "published") {
    const titled = await prisma.surveyTranslation.findFirst({
      where: { surveyId: id, title: { not: "" } },
      select: { id: true },
    });
    if (!survey.slug || !titled) return;
  }

  await prisma.survey.update({
    where: { id },
    data: {
      status,
      publishedAt: status === "published" ? (survey.publishedAt ?? new Date()) : survey.publishedAt,
    },
  });
  await logActivity({
    userId: user.id,
    action: "update",
    entityType: "survey",
    entityId: id,
    summary: `Set survey ${survey.slug} status to ${status}`,
  });
  revalidateSurvey(id);
}

export async function duplicateSurveyAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = getString(formData, "id");
  if (!id) return;

  const original = await prisma.survey.findFirst({
    where: { id, deletedAt: null },
    include: {
      translations: true,
      sections: { include: { translations: true }, orderBy: { order: "asc" } },
      questions: {
        include: { translations: true, options: { include: { translations: true }, orderBy: { order: "asc" } } },
        orderBy: { order: "asc" },
      },
    },
  });
  if (!original) return;

  const exists = async (candidate: string) => {
    const found = await prisma.survey.findFirst({ where: { slug: candidate }, select: { id: true } });
    return Boolean(found);
  };
  const slug = await uniqueSlug(slugify(`${original.slug}-ban-sao`), exists);

  const copy = await prisma.$transaction(async (tx) => {
    // A duplicate always starts as a draft with no publish date, so it can
    // never accidentally go live or accept responses before review.
    const record = await tx.survey.create({
      data: {
        slug,
        status: "draft",
        coverMediaId: original.coverMediaId,
        // BỔ SUNG 15:14 (A2 columns).
        brandName: original.brandName,
        brandLogoMediaId: original.brandLogoMediaId,
        badgeFromColor: original.badgeFromColor,
        badgeToColor: original.badgeToColor,
        themePreset: original.themePreset,
        layout: original.layout,
        progressStyle: original.progressStyle,
        primaryColor: original.primaryColor,
        accentColor: original.accentColor,
        backgroundColor: original.backgroundColor,
        surfaceColor: original.surfaceColor,
        textColor: original.textColor,
        buttonStyle: original.buttonStyle,
        borderRadius: original.borderRadius,
        estimatedMinutes: original.estimatedMinutes,
        startsAt: original.startsAt,
        endsAt: original.endsAt,
        publishedAt: null,
        isBookingIntake: original.isBookingIntake,
      },
    });

    for (const translation of original.translations) {
      await tx.surveyTranslation.create({
        data: {
          surveyId: record.id,
          locale: translation.locale,
          title: translation.title,
          subtitle: translation.subtitle,
          description: translation.description,
          introduction: translation.introduction,
          completionMessage: translation.completionMessage,
          privacyNotice: translation.privacyNotice,
          highlights: translation.highlights,
        },
      });
    }

    const sectionMap = new Map<string, string>();
    for (const section of original.sections) {
      const created = await tx.surveySection.create({
        data: { surveyId: record.id, order: section.order },
      });
      sectionMap.set(section.id, created.id);
      for (const translation of section.translations) {
        await tx.surveySectionTranslation.create({
          data: {
            sectionId: created.id,
            locale: translation.locale,
            title: translation.title,
            description: translation.description,
          },
        });
      }
    }

    for (const question of original.questions) {
      const created = await tx.surveyQuestion.create({
        data: {
          surveyId: record.id,
          sectionId: question.sectionId ? sectionMap.get(question.sectionId) ?? null : null,
          type: question.type,
          order: question.order,
          required: question.required,
          minLength: question.minLength,
          maxLength: question.maxLength,
          minRating: question.minRating,
          maxRating: question.maxRating,
        },
      });
      for (const translation of question.translations) {
        await tx.surveyQuestionTranslation.create({
          data: {
            questionId: created.id,
            locale: translation.locale,
            title: translation.title,
            description: translation.description,
            placeholder: translation.placeholder,
          },
        });
      }
      for (const option of question.options) {
        const createdOption = await tx.surveyQuestionOption.create({
          data: { questionId: created.id, value: option.value, order: option.order },
        });
        for (const translation of option.translations) {
          await tx.surveyQuestionOptionTranslation.create({
            data: { optionId: createdOption.id, locale: translation.locale, label: translation.label },
          });
        }
      }
    }
    return record;
  });

  await logActivity({
    userId: user.id,
    action: "create",
    entityType: "survey",
    entityId: copy.id,
    summary: `Duplicated survey “${original.slug}” as “${slug}” (draft)`,
  });
  revalidateSurvey(copy.id);
  redirect(`/admin/surveys/${copy.id}?saved=1`);
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

export async function saveSectionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = getString(formData, "id") || undefined;
  const surveyId = getString(formData, "surveyId");
  if (!surveyId) return { ok: false, message: "Thiếu khảo sát." };

  const survey = await prisma.survey.findFirst({ where: { id: surveyId, deletedAt: null } });
  if (!survey) return { ok: false, message: "Không tìm thấy khảo sát." };

  const vi = readLocaleBlock(formData, "vi", SECTION_TRANSLATION_FIELDS);
  const en = readLocaleBlock(formData, "en", SECTION_TRANSLATION_FIELDS);
  const titleVi = (vi.title ?? "").trim();
  const titleEn = (en.title ?? "").trim();
  if (!titleVi && !titleEn) {
    return { ok: false, message: "Nhập tên nhóm ở ít nhất một ngôn ngữ.", fieldErrors: { "vi.title": ["Tên nhóm là bắt buộc"] } };
  }
  if (titleVi.length > 200 || titleEn.length > 200) {
    return { ok: false, message: "Tên nhóm tối đa 200 ký tự." };
  }

  if (!id) {
    const count = await prisma.surveySection.count({ where: { surveyId } });
    if (count >= MAX_SECTIONS_PER_SURVEY) {
      return { ok: false, message: `Mỗi khảo sát tối đa ${MAX_SECTIONS_PER_SURVEY} nhóm.` };
    }
  }

  const orderRaw = optionalNumber(formData, "order");

  try {
    const section = await prisma.$transaction(async (tx) => {
      const record = id
        ? await tx.surveySection.update({
            where: { id },
            data: { order: orderRaw ?? undefined },
          })
        : await tx.surveySection.create({
            data: {
              surveyId,
              order:
                ((await tx.surveySection.aggregate({ where: { surveyId }, _max: { order: true } }))._max.order ??
                  -1) + 1,
            },
          });
      for (const [locale, block] of [
        ["vi", vi],
        ["en", en],
      ] as const) {
        const title = (block.title ?? "").trim();
        if (title) {
          await tx.surveySectionTranslation.upsert({
            where: { sectionId_locale: { sectionId: record.id, locale } },
            update: { title, description: block.description ?? "" },
            create: { sectionId: record.id, locale, title, description: block.description ?? "" },
          });
        } else if (id) {
          await tx.surveySectionTranslation.deleteMany({ where: { sectionId: record.id, locale } });
        }
      }
      return record;
    });

    await logActivity({
      userId: user.id,
      action: id ? "update" : "create",
      entityType: "survey_section",
      entityId: section.id,
      summary: `${id ? "Updated" : "Created"} section “${titleVi || titleEn}” in survey ${survey.slug}`,
    });
    revalidateSurvey(surveyId);
    return { ok: true, message: "Đã lưu nhóm câu hỏi." };
  } catch (error) {
    console.error("[survey] save section failed", error);
    return { ok: false, message: "Không thể lưu nhóm câu hỏi." };
  }
}

export async function deleteSectionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = getString(formData, "id");
  const surveyId = getString(formData, "surveyId");
  if (!id || !surveyId) return;

  const section = await prisma.surveySection.findFirst({
    where: { id, surveyId },
    include: { translations: true },
  });
  if (!section) return;

  // Questions in the section are kept, unsectioned (FK is SetNull) — only
  // the grouping is removed, never the questions or their answers.
  await prisma.surveySection.delete({ where: { id } });
  await logActivity({
    userId: user.id,
    action: "delete",
    entityType: "survey_section",
    entityId: id,
    summary: `Deleted section “${section.translations[0]?.title ?? id}” (questions kept, unsectioned)`,
  });
  revalidateSurvey(surveyId);
}

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

type ParsedOption = {
  id?: string;
  value: string;
  order: number;
  vi: { label: string };
  en: { label: string };
};

function parseOptions(raw: string): { options?: ParsedOption[]; error?: string } {
  if (!raw.trim()) return { options: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "Danh sách lựa chọn không hợp lệ." };
  }
  if (!Array.isArray(parsed)) return { error: "Danh sách lựa chọn không hợp lệ." };
  if (parsed.length > MAX_OPTIONS_PER_QUESTION) {
    return { error: `Mỗi câu hỏi tối đa ${MAX_OPTIONS_PER_QUESTION} lựa chọn.` };
  }
  const options: ParsedOption[] = [];
  const seen = new Set<string>();
  for (const item of parsed) {
    const result = surveyOptionSchema.safeParse(item);
    if (!result.success) {
      return { error: "Mỗi lựa chọn cần nhãn tiếng Việt và tiếng Anh, mã (value) dạng slug viết thường." };
    }
    if (seen.has(result.data.value)) {
      return { error: `Lựa chọn “${result.data.value}” bị trùng mã.` };
    }
    seen.add(result.data.value);
    options.push({
      id: result.data.id,
      value: result.data.value,
      order: result.data.order,
      vi: { label: result.data.vi.label },
      en: { label: result.data.en.label },
    });
  }
  return { options };
}

export async function saveQuestionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = getString(formData, "id") || undefined;
  const surveyId = getString(formData, "surveyId");
  if (!surveyId) return { ok: false, message: "Thiếu khảo sát." };

  const survey = await prisma.survey.findFirst({ where: { id: surveyId, deletedAt: null } });
  if (!survey) return { ok: false, message: "Không tìm thấy khảo sát." };

  const sectionId = getString(formData, "sectionId") || undefined;
  if (sectionId) {
    const section = await prisma.surveySection.findFirst({ where: { id: sectionId, surveyId } });
    if (!section) return { ok: false, message: "Nhóm câu hỏi không thuộc khảo sát này." };
  }

  const parsed = surveyQuestionSchema.safeParse({
    id,
    surveyId,
    sectionId,
    type: getString(formData, "type") || "short_text",
    order: optionalNumber(formData, "order") ?? 0,
    required: getBool(formData, "required"),
    minLength: optionalNumber(formData, "minLength"),
    maxLength: optionalNumber(formData, "maxLength"),
    minRating: optionalNumber(formData, "minRating"),
    maxRating: optionalNumber(formData, "maxRating"),
    vi: readLocaleBlock(formData, "vi", QUESTION_TRANSLATION_FIELDS),
    en: readLocaleBlock(formData, "en", QUESTION_TRANSLATION_FIELDS),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Vui lòng kiểm tra các trường được đánh dấu.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const data = parsed.data;
  if (
    data.minLength !== undefined &&
    data.maxLength !== undefined &&
    data.minLength > data.maxLength
  ) {
    return { ok: false, message: "Độ dài tối thiểu không được lớn hơn độ dài tối đa." };
  }
  if (
    data.minRating !== undefined &&
    data.maxRating !== undefined &&
    data.minRating > data.maxRating
  ) {
    return { ok: false, message: "Điểm tối thiểu không được lớn hơn điểm tối đa." };
  }

  const isChoice = (CHOICE_TYPES as readonly string[]).includes(data.type);
  const { options, error: optionsError } = parseOptions(getString(formData, "options"));
  if (optionsError) return { ok: false, message: optionsError };
  if (isChoice && (!options || options.length === 0)) {
    return { ok: false, message: "Câu hỏi lựa chọn cần ít nhất một lựa chọn." };
  }

  if (!id) {
    const count = await prisma.surveyQuestion.count({ where: { surveyId } });
    if (count >= MAX_QUESTIONS_PER_SURVEY) {
      return { ok: false, message: `Mỗi khảo sát tối đa ${MAX_QUESTIONS_PER_SURVEY} câu hỏi.` };
    }
  }

  // Editing a question on a survey that already has responses is an explicit
  // save (this action), never a silent live mutation — but the UI also warns
  // before the editor is opened. Answers keep referencing the same questionId.
  try {
    const question = await prisma.$transaction(async (tx) => {
      const maxOrder = (await tx.surveyQuestion.aggregate({ where: { surveyId }, _max: { order: true } }))._max.order;
      const record = id
        ? await tx.surveyQuestion.update({
            where: { id },
            data: {
              sectionId: sectionId ?? null,
              type: data.type,
              required: data.required,
              minLength: data.minLength ?? null,
              maxLength: data.maxLength ?? null,
              minRating: data.type === "rating" ? (data.minRating ?? null) : null,
              maxRating: data.type === "rating" ? (data.maxRating ?? null) : null,
            },
          })
        : await tx.surveyQuestion.create({
            data: {
              surveyId,
              sectionId: sectionId ?? null,
              type: data.type,
              order: (maxOrder ?? -1) + 1,
              required: data.required,
              minLength: data.minLength ?? null,
              maxLength: data.maxLength ?? null,
              minRating: data.type === "rating" ? (data.minRating ?? null) : null,
              maxRating: data.type === "rating" ? (data.maxRating ?? null) : null,
            },
          });

      for (const locale of ["vi", "en"] as const) {
        const block = data[locale];
        await tx.surveyQuestionTranslation.upsert({
          where: { questionId_locale: { questionId: record.id, locale } },
          update: { title: block.title, description: block.description, placeholder: block.placeholder },
          create: {
            questionId: record.id,
            locale,
            title: block.title,
            description: block.description,
            placeholder: block.placeholder,
          },
        });
      }

      if (!isChoice) {
        // A type change away from choices drops the old options; answers
        // that referenced them keep their rows (option FK is SetNull).
        await tx.surveyQuestionOption.deleteMany({ where: { questionId: record.id } });
      } else {
        const keptIds = new Set((options ?? []).map((option) => option.id).filter((value): value is string => Boolean(value)));
        await tx.surveyQuestionOption.deleteMany({
          where: { questionId: record.id, ...(keptIds.size > 0 ? { id: { notIn: [...keptIds] } } : {}) },
        });
        for (const [index, option] of (options ?? []).entries()) {
          const optionRecord = option.id
            ? await tx.surveyQuestionOption.update({
                where: { id: option.id },
                data: { value: option.value, order: index },
              })
            : await tx.surveyQuestionOption.create({
                data: { questionId: record.id, value: option.value, order: index },
              });
          for (const locale of ["vi", "en"] as const) {
            await tx.surveyQuestionOptionTranslation.upsert({
              where: { optionId_locale: { optionId: optionRecord.id, locale } },
              update: { label: option[locale].label },
              create: { optionId: optionRecord.id, locale, label: option[locale].label },
            });
          }
        }
      }
      return record;
    });

    await logActivity({
      userId: user.id,
      action: id ? "update" : "create",
      entityType: "survey_question",
      entityId: question.id,
      summary: `${id ? "Updated" : "Created"} question “${data.vi.title}” (${data.type}) in survey ${survey.slug}`,
    });
    revalidateSurvey(surveyId);
    return { ok: true, message: "Đã lưu câu hỏi." };
  } catch (error) {
    console.error("[survey] save question failed", error);
    return { ok: false, message: "Không thể lưu câu hỏi. Vui lòng thử lại." };
  }
}

export async function deleteQuestionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = getString(formData, "id");
  const surveyId = getString(formData, "surveyId");
  if (!id || !surveyId) return { ok: false, message: "Thiếu câu hỏi." };

  const question = await prisma.surveyQuestion.findFirst({
    where: { id, surveyId },
    include: { translations: true },
  });
  if (!question) return { ok: false, message: "Không tìm thấy câu hỏi." };

  // Answers reference questionId with Restrict: a question with answers can
  // never be deleted (no cascade, ever). Return a clear error instead.
  const answerCount = await prisma.surveyAnswer.count({ where: { questionId: id } });
  if (answerCount > 0) {
    return {
      ok: false,
      message: `Không thể xoá câu hỏi “${question.translations.find((t) => t.locale === "vi")?.title ?? question.translations[0]?.title ?? ""}” vì đã có ${answerCount} câu trả lời tham chiếu tới nó. Hãy đóng khảo sát và nhân bản thành bản nháp mới nếu cần thay đổi cấu trúc.`,
    };
  }

  try {
    await prisma.surveyQuestion.delete({ where: { id } });
  } catch (error) {
    // P2003 Restrict from the DB is the same situation (a race with a new
    // response arriving between the count and the delete).
    console.error("[survey] delete question failed", error);
    return {
      ok: false,
      message: "Không thể xoá câu hỏi vì đã có câu trả lời tham chiếu tới nó.",
    };
  }

  await logActivity({
    userId: user.id,
    action: "delete",
    entityType: "survey_question",
    entityId: id,
    summary: `Deleted question “${question.translations[0]?.title ?? id}” from survey ${surveyId}`,
  });
  revalidateSurvey(surveyId);
  return { ok: true, message: "Đã xoá câu hỏi." };
}

export async function duplicateQuestionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = getString(formData, "id");
  const surveyId = getString(formData, "surveyId");
  if (!id || !surveyId) return { ok: false, message: "Thiếu câu hỏi." };

  const original = await prisma.surveyQuestion.findFirst({
    where: { id, surveyId },
    include: { translations: true, options: { include: { translations: true }, orderBy: { order: "asc" } } },
  });
  if (!original) return { ok: false, message: "Không tìm thấy câu hỏi." };

  const count = await prisma.surveyQuestion.count({ where: { surveyId } });
  if (count >= MAX_QUESTIONS_PER_SURVEY) {
    return { ok: false, message: `Mỗi khảo sát tối đa ${MAX_QUESTIONS_PER_SURVEY} câu hỏi.` };
  }

  try {
    const copy = await prisma.$transaction(async (tx) => {
      const maxOrder = (await tx.surveyQuestion.aggregate({ where: { surveyId }, _max: { order: true } }))._max.order;
      const record = await tx.surveyQuestion.create({
        data: {
          surveyId,
          sectionId: original.sectionId,
          type: original.type,
          order: (maxOrder ?? -1) + 1,
          required: original.required,
          minLength: original.minLength,
          maxLength: original.maxLength,
          minRating: original.minRating,
          maxRating: original.maxRating,
        },
      });
      for (const translation of original.translations) {
        await tx.surveyQuestionTranslation.create({
          data: {
            questionId: record.id,
            locale: translation.locale,
            title: translation.title,
            description: translation.description,
            placeholder: translation.placeholder,
          },
        });
      }
      for (const option of original.options) {
        const created = await tx.surveyQuestionOption.create({
          data: { questionId: record.id, value: option.value, order: option.order },
        });
        for (const translation of option.translations) {
          await tx.surveyQuestionOptionTranslation.create({
            data: { optionId: created.id, locale: translation.locale, label: translation.label },
          });
        }
      }
      return record;
    });

    await logActivity({
      userId: user.id,
      action: "create",
      entityType: "survey_question",
      entityId: copy.id,
      summary: `Duplicated question “${original.translations[0]?.title ?? id}” in survey ${surveyId}`,
    });
    revalidateSurvey(surveyId);
    return { ok: true, message: "Đã nhân bản câu hỏi." };
  } catch (error) {
    console.error("[survey] duplicate question failed", error);
    return { ok: false, message: "Không thể nhân bản câu hỏi." };
  }
}

export async function reorderQuestionsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const surveyId = getString(formData, "surveyId");
  const ids = getString(formData, "questionIds")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!surveyId || ids.length === 0) return { ok: false, message: "Thiếu danh sách câu hỏi." };
  if (new Set(ids).size !== ids.length) return { ok: false, message: "Danh sách câu hỏi bị trùng." };

  const existing = await prisma.surveyQuestion.findMany({
    where: { surveyId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((item) => item.id));
  if (ids.length !== existing.length || ids.some((item) => !existingIds.has(item))) {
    return { ok: false, message: "Thứ tự câu hỏi không khớp với khảo sát hiện tại. Hãy tải lại trang." };
  }

  await prisma.$transaction(
    ids.map((questionId, index) =>
      prisma.surveyQuestion.update({ where: { id: questionId }, data: { order: index } }),
    ),
  );
  await logActivity({
    userId: user.id,
    action: "update",
    entityType: "survey_question",
    entityId: surveyId,
    summary: `Reordered ${ids.length} questions in survey ${surveyId}`,
  });
  revalidateSurvey(surveyId);
  return { ok: true, message: "Đã đổi thứ tự câu hỏi." };
}
