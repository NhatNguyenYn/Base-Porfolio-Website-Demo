import "server-only";
import type { Locale } from "@/i18n/config";
import { FLOWERS, flowerNameFor } from "@/lib/flowers";
import { prisma } from "../db";
import { pickTranslation } from "./types";
import type { PublicSurveyQuestion } from "@/data/surveys";
import type { SurveyQuestionType } from "@/lib/survey-response-validation";

/** Stored question types are plain strings; only the 8 known types render. */
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

export const ACTIVE_BOOKING_STATUSES = ["pending", "confirmed"] as const;

/**
 * Theme + brand data for the public booking intro (15:14 photo reference).
 * Read from the intake survey; null colours/brand fall back to the preset
 * defaults / site brand in the intro component. `preset` may be
 * "editorial-vn" (the reference-inspired preset); the intro maps it onto
 * C's editorial palette via resolveSurveyTheme.
 */
export type BookingThemeData = {
  preset: string;
  layout: string;
  progressStyle: string;
  buttonStyle: string;
  borderRadius: string;
  primaryColor: string | null;
  accentColor: string | null;
  backgroundColor: string | null;
  surfaceColor: string | null;
  textColor: string | null;
  badgeFromColor: string | null;
  badgeToColor: string | null;
  brandName: string | null;
  brandLogoUrl: string | null;
};

/** Portfolio defaults when a service has no intake survey to take a theme from. */
export const DEFAULT_BOOKING_THEME: BookingThemeData = {
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
  brandName: null,
  brandLogoUrl: null,
};

export type PublicSlotDto = {
  slotId: string;
  serviceSlug: string;
  startsAt: string;
  endsAt: string;
  status: "available" | "booked" | "blocked";
  flower: { code: string; name: string } | null;
};

export type ServiceCardData = {
  id: string;
  slug: string;
  name: string;
  description: string;
  durationMinutes: number;
  active: boolean;
  order: number;
  intakeSurveyId: string | null;
  intakeSurveyTitle: string | null;
};

export type BookingListItem = {
  id: string;
  referenceCode: string;
  name: string;
  email: string;
  flowerCode: string;
  flowerName: string;
  status: string;
  serviceSlug: string;
  serviceName: string;
  startsAt: Date;
  endsAt: Date;
  createdAt: Date;
};

export type IntakeQuestion = PublicSurveyQuestion;

export type IntakeSurveyData = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  introduction: string;
  completionMessage: string;
  privacyNotice: string;
  /** Admin-configured bullet lines (one per line); empty = generated bullets. */
  highlights: string[];
  estimatedMinutes: number | null;
  open: boolean;
  theme: BookingThemeData;
  questions: IntakeQuestion[];
};

function serviceCard(
  row: {
    id: string;
    slug: string;
    durationMinutes: number;
    active: boolean;
    order: number;
    intakeSurveyId: string | null;
    translations: { locale: string; name: string; description: string }[];
    intakeSurvey: { translations: { locale: string; title: string }[] } | null;
  },
  locale: Locale,
): ServiceCardData | null {
  const { row: translation } = pickTranslation(row.translations, locale);
  if (!translation) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: translation.name,
    description: translation.description ?? "",
    durationMinutes: row.durationMinutes,
    active: row.active,
    order: row.order,
    intakeSurveyId: row.intakeSurveyId,
    intakeSurveyTitle:
      row.intakeSurvey?.translations.find((item) => item.locale === "vi")?.title ?? null,
  };
}

/** Public: active services only, in the requested locale. */
export async function listServices(locale: Locale): Promise<ServiceCardData[]> {
  const rows = await prisma.bookingService.findMany({
    where: { active: true },
    include: {
      translations: { where: { locale } },
      intakeSurvey: { select: { translations: { where: { locale: "vi" }, select: { locale: true, title: true } } } },
    },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  return rows
    .map((row) => serviceCard(row, locale))
    .filter((row): row is ServiceCardData => Boolean(row));
}

export async function getServiceBySlug(slug: string, locale: Locale): Promise<ServiceCardData | null> {
  const row = await prisma.bookingService.findUnique({
    where: { slug },
    include: {
      translations: { where: { locale } },
      intakeSurvey: { select: { translations: { where: { locale: "vi" }, select: { locale: true, title: true } } } },
    },
  });
  if (!row || !row.active) return null;
  return serviceCard(row, locale);
}

/** Admin: every service with translations, intake survey and counts. */
export async function listServicesForAdmin() {
  return prisma.bookingService.findMany({
    include: {
      translations: true,
      intakeSurvey: { select: { id: true, slug: true, status: true, translations: true } },
      _count: { select: { slots: true, bookings: true } },
    },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
}

export async function getServiceForAdmin(id: string) {
  return prisma.bookingService.findUnique({
    where: { id },
    include: { translations: true, intakeSurvey: { select: { id: true, slug: true, status: true } } },
  });
}

/** Admin: slots for one service (or all), newest first, with the active flower if booked. */
export async function listSlotsForAdmin(serviceId?: string) {
  const rows = await prisma.bookingSlot.findMany({
    where: serviceId ? { serviceId } : {},
    include: {
      service: { select: { slug: true, translations: { where: { locale: "vi" }, select: { name: true } } } },
      bookings: {
        where: { status: { in: [...ACTIVE_BOOKING_STATUSES] } },
        select: { flowerCode: true },
        take: 1,
      },
    },
    orderBy: { startsAt: "desc" },
    take: 500,
  });
  return rows.map((row) => ({
    id: row.id,
    serviceId: row.serviceId,
    serviceSlug: row.service.slug,
    serviceName: row.service.translations[0]?.name ?? row.service.slug,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    status: row.status,
    flowerCode: row.bookings[0]?.flowerCode ?? null,
  }));
}

/**
 * THE SAFE-DTO query for the public availability endpoint.
 *
 * Returns ONLY slot columns + the active booking's flower code (localized to a
 * name). The backing query selects slot columns + flowerCode ONLY — visitor
 * identity fields are never selected here, so they cannot leak.
 */
export async function listAvailableSlots(
  serviceSlug: string,
  from: Date,
  to: Date,
  locale: Locale,
): Promise<PublicSlotDto[]> {
  const service = await prisma.bookingService.findUnique({
    where: { slug: serviceSlug },
    select: { id: true, active: true },
  });
  if (!service || !service.active) return [];

  const slots = await prisma.bookingSlot.findMany({
    where: { serviceId: service.id, startsAt: { gte: from, lte: to } },
    select: { id: true, startsAt: true, endsAt: true, status: true },
    orderBy: { startsAt: "asc" },
    take: 500,
  });

  const result: PublicSlotDto[] = [];
  for (const slot of slots) {
    let flower: PublicSlotDto["flower"] = null;
    if (slot.status === "booked") {
      // Active booking on this slot: flower code ONLY.
      const active = await prisma.booking.findFirst({
        where: { slotId: slot.id, status: { in: [...ACTIVE_BOOKING_STATUSES] } },
        select: { flowerCode: true },
      });
      if (active) flower = { code: active.flowerCode, name: flowerNameFor(active.flowerCode, locale) };
    }
    result.push({
      slotId: slot.id,
      serviceSlug,
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
      status: slot.status === "booked" ? "booked" : slot.status === "blocked" ? "blocked" : "available",
      flower,
    });
  }
  return result;
}

export type BookingFilters = {
  status?: string;
  serviceId?: string;
  from?: string;
  to?: string;
};

/** Admin bookings list, filtered by status / service / slot date (VN calendar day). */
export async function listBookingsForAdmin(filters: BookingFilters = {}): Promise<BookingListItem[]> {
  const where: {
    status?: string;
    serviceId?: string;
    slot?: { startsAt: { gte?: Date; lte?: Date } };
  } = {};
  if (filters.status) where.status = filters.status;
  if (filters.serviceId) where.serviceId = filters.serviceId;
  if (filters.from || filters.to) {
    const range: { gte?: Date; lte?: Date } = {};
    if (filters.from) range.gte = new Date(`${filters.from}T00:00:00Z`);
    if (filters.to) range.lte = new Date(`${filters.to}T23:59:59.999Z`);
    where.slot = { startsAt: range };
  }

  const rows = await prisma.booking.findMany({
    where,
    include: {
      service: { select: { slug: true, translations: { where: { locale: "vi" }, select: { name: true } } } },
      slot: { select: { startsAt: true, endsAt: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return rows.map((row) => ({
    id: row.id,
    referenceCode: row.referenceCode,
    // Contact is required in the final schema (15:17 correction); the
    // `?? ""` keeps this compiling while A2's nullable revert is in flight.
    name: row.name ?? "",
    email: row.email ?? "",
    flowerCode: row.flowerCode,
    flowerName: flowerNameFor(row.flowerCode, "vi"),
    status: row.status,
    serviceSlug: row.service.slug,
    serviceName: row.service.translations[0]?.name ?? row.service.slug,
    startsAt: row.slot.startsAt,
    endsAt: row.slot.endsAt,
    createdAt: row.createdAt,
  }));
}

/** How many of the 30 flowers are currently held by active bookings. */
export async function countActiveFlowerUsage(): Promise<number> {
  return prisma.booking.count({ where: { status: { in: [...ACTIVE_BOOKING_STATUSES] } } });
}

export function flowerPoolSize(): number {
  return FLOWERS.length;
}

/** Admin booking detail: contact + slot + flower + linked survey answers, read-only. */
export async function getBookingDetail(id: string) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      service: { include: { translations: true } },
      slot: true,
      surveyResponse: {
        include: {
          survey: { select: { id: true, slug: true, translations: true } },
          answers: {
            include: {
              question: { include: { translations: true } },
              option: { include: { translations: true } },
            },
          },
        },
      },
    },
  });
  if (!booking) return null;
  const answers = (booking.surveyResponse?.answers ?? [])
    .slice()
    .sort((a, b) => (a.question.order ?? 0) - (b.question.order ?? 0))
    .map((answer) => ({
      id: answer.id,
      questionId: answer.questionId,
      questionTitle: answer.question.translations.find((t) => t.locale === "vi")?.title ?? "",
      questionType: answer.question.type,
      value: answer.value,
      optionLabel: answer.option?.translations.find((t) => t.locale === "vi")?.label ?? null,
    }));
  return {
    id: booking.id,
    referenceCode: booking.referenceCode,
    // See listBookingsForAdmin: contact is required in the final schema.
    name: booking.name ?? "",
    email: booking.email ?? "",
    phone: booking.phone ?? "",
    notes: booking.notes,
    flowerCode: booking.flowerCode,
    flowerName: flowerNameFor(booking.flowerCode, "vi"),
    status: booking.status,
    createdAt: booking.createdAt,
    cancelledAt: booking.cancelledAt,
    service: {
      id: booking.service.id,
      slug: booking.service.slug,
      name: booking.service.translations.find((t) => t.locale === "vi")?.name ?? booking.service.slug,
    },
    slot: { id: booking.slot.id, startsAt: booking.slot.startsAt, endsAt: booking.slot.endsAt, status: booking.slot.status },
    survey: booking.surveyResponse
      ? {
          responseId: booking.surveyResponse.id,
          slug: booking.surveyResponse.survey.slug,
          title:
            booking.surveyResponse.survey.translations.find((t) => t.locale === "vi")?.title ??
            booking.surveyResponse.survey.slug,
          submittedAt: booking.surveyResponse.submittedAt,
          answers,
        }
      : null,
  };
}

/** Published surveys an admin may pick as a service's intake survey. */
export async function listPublishedSurveysForIntake() {
  const rows = await prisma.survey.findMany({
    where: { status: "published", deletedAt: null },
    select: {
      id: true,
      slug: true,
      status: true,
      isBookingIntake: true,
      translations: { select: { locale: true, title: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    status: row.status,
    isBookingIntake: row.isBookingIntake,
    title: row.translations.find((t) => t.locale === "vi")?.title ?? row.slug,
  }));
}

/** Is a survey open for new responses right now (published + inside its window)? */
export function isSurveyOpen(
  survey: { status: string; deletedAt: Date | null; startsAt: Date | null; endsAt: Date | null },
  now = new Date(),
): boolean {
  if (survey.status !== "published" || survey.deletedAt) return false;
  if (survey.startsAt && survey.startsAt.getTime() > now.getTime()) return false;
  if (survey.endsAt && survey.endsAt.getTime() < now.getTime()) return false;
  return true;
}

/**
 * Intake survey for a public booking page: the service's linked survey with
 * its questions + options in the visitor's locale, plus the theme/brand copy
 * the booking intro renders (15:14 photo reference). `open` is false when
 * the survey is missing, unpublished, closed/archived or out of its window —
 * the page then shows "booking unavailable" instead of a broken form.
 * Questions are returned in C's PublicSurveyQuestion shape so the booking
 * intake step reuses C's SurveyQuestionField renderer read-only.
 */
export async function getIntakeSurvey(
  serviceSlug: string,
  locale: Locale,
): Promise<{ service: ServiceCardData; survey: IntakeSurveyData | null } | null> {
  const service = await getServiceBySlug(serviceSlug, locale);
  if (!service) return null;
  if (!service.intakeSurveyId) return { service, survey: null };

  const survey = await prisma.survey.findUnique({
    where: { id: service.intakeSurveyId },
    include: {
      translations: { where: { locale } },
      brandLogoMedia: { select: { url: true } },
      questions: {
        include: {
          translations: { where: { locale } },
          options: { include: { translations: { where: { locale } } }, orderBy: { order: "asc" } },
        },
        orderBy: { order: "asc" },
      },
    },
  });
  if (!survey) return { service, survey: null };
  const { row: translation } = pickTranslation(survey.translations, locale);
  if (!translation) return { service, survey: null };

  return {
    service,
    survey: {
      id: survey.id,
      slug: survey.slug,
      title: translation.title,
      subtitle: translation.subtitle ?? "",
      description: translation.description ?? "",
      introduction: translation.introduction ?? "",
      completionMessage: translation.completionMessage ?? "",
      privacyNotice: translation.privacyNotice ?? "",
      highlights: (translation.highlights ?? "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
      estimatedMinutes: survey.estimatedMinutes,
      open: isSurveyOpen(survey),
      theme: {
        preset: survey.themePreset,
        layout: survey.layout,
        progressStyle: survey.progressStyle,
        buttonStyle: survey.buttonStyle,
        borderRadius: survey.borderRadius,
        primaryColor: survey.primaryColor,
        accentColor: survey.accentColor,
        backgroundColor: survey.backgroundColor,
        surfaceColor: survey.surfaceColor,
        textColor: survey.textColor,
        badgeFromColor: survey.badgeFromColor,
        badgeToColor: survey.badgeToColor,
        brandName: survey.brandName,
        brandLogoUrl: survey.brandLogoMedia?.url ?? null,
      },
      questions: survey.questions
        .map((question) => {
          const { row: q } = pickTranslation(question.translations, locale);
          if (!q || !isQuestionType(question.type)) return null;
          return {
            id: question.id,
            sectionId: question.sectionId,
            type: question.type,
            order: question.order,
            required: question.required,
            minLength: question.minLength,
            maxLength: question.maxLength,
            minRating: question.minRating,
            maxRating: question.maxRating,
            title: q.title,
            description: q.description ?? "",
            placeholder: q.placeholder ?? "",
            options: question.options
              .map((option) => {
                const { row: o } = pickTranslation(option.translations, locale);
                if (!o) return null;
                return { id: option.id, value: option.value, label: o.label, order: option.order };
              })
              .filter((o): o is { id: string; value: string; label: string; order: number } => Boolean(o)),
          } satisfies IntakeQuestion;
        })
        .filter((q): q is IntakeQuestion => Boolean(q)),
    },
  };
}
