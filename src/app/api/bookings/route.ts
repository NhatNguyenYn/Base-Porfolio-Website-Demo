import { randomInt } from "node:crypto";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { isSurveyOpen } from "@/server/queries/bookings";
import { bookingCreateSchema } from "@/lib/validation";
import { FLOWERS, flowerNameFor } from "@/lib/flowers";
import {
  BOOKING_CREATE_LIMIT,
  BOOKING_REFERENCE_CODE_PREFIX,
  BOOKING_REFERENCE_CODE_RANDOM_LENGTH,
  FLOWER_ALLOC_RETRIES,
} from "@/lib/booking-limits";
import { MAX_SURVEY_RESPONSE_JSON_BYTES } from "@/lib/survey-limits";
import { validateSurveyAnswers, type StoredQuestion, type ValidatedAnswerRow } from "@/lib/survey-response-validation";
import type { SurveyQuestionType } from "@/lib/survey-response-validation";
import { fail, ok, readJson, requireSameOrigin, resolveLocale, withApi } from "@/lib/api";
import { getDictionary } from "@/i18n";
import { clientIp, hashedKey, rateLimit } from "@/lib/rate-limit";
import { formatVnDateTime } from "@/lib/booking-time";
import {
  CONFIRMATION_TTL_MS,
  issueConfirmationToken,
  releaseExpiredConfirmations,
} from "@/lib/booking-confirmation";
import { confirmationEmailConfigured, sendBookingConfirmationEmail } from "@/lib/email";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

// Public booking code: `BK-` + 6 unambiguous chars (no 0/O, 1/I/l), e.g.
// BK-7K2M9Q. Generated server-side inside the creation transaction; the
// @unique column + P2002 retry below guarantee uniqueness.
const REFERENCE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function generateReferenceCode(): string {
  let code = BOOKING_REFERENCE_CODE_PREFIX;
  for (let i = 0; i < BOOKING_REFERENCE_CODE_RANDOM_LENGTH; i++) code += REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)];
  return code;
}

class BookingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "BookingError";
  }
}

function isPrismaUniqueViolation(error: unknown): boolean {
  return (error as { code?: string })?.code === "P2002";
}

/** Stored question types are plain strings; only the 8 known types validate. */
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

export async function POST(request: Request) {
  return withApi(request, async () => {
    const originError = requireSameOrigin(request);
    if (originError) return originError;

    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > MAX_SURVEY_RESPONSE_JSON_BYTES) {
      return fail("PAYLOAD_TOO_LARGE", "Request body is too large.", 413);
    }

    const body = await readJson(request);
    if (!body) return fail("INVALID_JSON", "Request body must be a JSON object.", 400);
    const locale: Locale = resolveLocale(typeof body.locale === "string" ? body.locale : null) ?? "vi";

    // Honeypot + submit-timing checks (contact pattern). Bots get a silent
    // fake success so they do not learn; nothing is written.
    const honeypot = typeof body.website === "string" ? body.website : "";
    const startedAt = Number(body.startedAt ?? 0);
    const elapsed = Number.isFinite(startedAt) && startedAt > 0 ? Date.now() - startedAt : null;
    const tooFast = elapsed !== null && elapsed >= 0 && elapsed < 1800;
    if (honeypot.length > 0 || tooFast) {
      const slot =
        typeof body.slotId === "string"
          ? await prisma.bookingSlot.findUnique({
              where: { id: body.slotId },
              select: { startsAt: true, endsAt: true },
            })
          : null;
      const flower = FLOWERS[randomInt(FLOWERS.length)];
      return ok({
        referenceCode: generateReferenceCode(),
        flowerCode: flower.code,
        flowerName: flowerNameFor(flower.code, locale),
        service: typeof body.serviceSlug === "string" ? body.serviceSlug : "",
        startsAt: slot?.startsAt.toISOString() ?? null,
        endsAt: slot?.endsAt.toISOString() ?? null,
      });
    }

    const ip = clientIp(await headers());
    const limit = rateLimit(
      `booking-create:${hashedKey(ip)}`,
      BOOKING_CREATE_LIMIT.limit,
      BOOKING_CREATE_LIMIT.windowMs,
    );
    if (!limit.ok) {
      return fail("RATE_LIMITED", "Too many booking attempts. Please try again shortly.", 429);
    }

    const parsed = bookingCreateSchema.safeParse(body);
    if (!parsed.success) {
      return fail("INVALID", "Please check the submitted information.", 400, {
        fieldErrors: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    const data = parsed.data;

    // One transaction per attempt: slot guard + flower allocation + intake
    // response + answers + booking — or none of them. A P2002 (two concurrent
    // requests picked the same flower/slot/code) is retried with a fresh read.
    for (let attempt = 0; attempt < FLOWER_ALLOC_RETRIES; attempt++) {
      const referenceCode = generateReferenceCode();
      try {
        const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          // Lazy expiry: a ghost booking whose confirmation lapsed must not
          // hold this slot (or its flower) against a new visitor.
          await releaseExpiredConfirmations(tx);

          const service = await tx.bookingService.findUnique({
            where: { slug: data.serviceSlug },
            include: { translations: { where: { locale }, select: { name: true } } },
          });
          if (!service || !service.active) {
            throw new BookingError("SERVICE_NOT_FOUND", "Service not found.");
          }

          const slot = await tx.bookingSlot.findUnique({ where: { id: data.slotId } });
          if (
            !slot ||
            slot.serviceId !== service.id ||
            slot.status !== "available" ||
            slot.startsAt.getTime() <= Date.now()
          ) {
            throw new BookingError("SLOT_TAKEN", "This slot is no longer available.");
          }

          let storedQuestions: StoredQuestion[] = [];
          let answerRows: ValidatedAnswerRow[] = [];
          if (service.intakeSurveyId) {
            const survey = await tx.survey.findUnique({
              where: { id: service.intakeSurveyId },
              include: {
                questions: {
                  include: { options: { orderBy: { order: "asc" } } },
                  orderBy: { order: "asc" },
                },
              },
            });
            if (!survey || !isSurveyOpen(survey)) {
              throw new BookingError("SURVEY_CLOSED", "The intake survey for this service is closed.");
            }
            storedQuestions = survey.questions
              .map((question) => {
                if (!isQuestionType(question.type)) return null;
                return {
                  id: question.id,
                  type: question.type,
                  required: question.required,
                  minLength: question.minLength,
                  maxLength: question.maxLength,
                  minRating: question.minRating,
                  maxRating: question.maxRating,
                  options: question.options.map((option) => ({ id: option.id, value: option.value })),
                };
              })
              .filter((question): question is StoredQuestion => question !== null);
            // Shared validator with the standalone survey (C): re-checks the
            // answers against the STORED questions (required, type match,
            // choice membership, per-question bounds) and builds the rows.
            const check = validateSurveyAnswers(storedQuestions, data.answers);
            if (!check.ok) {
              throw new BookingError("INVALID_ANSWERS", check.errors[0]?.message ?? "Invalid answers.");
            }
            answerRows = check.rows;
          } else if (data.answers.length > 0) {
            throw new BookingError("INVALID_ANSWERS", "This service has no intake survey.");
          }
          const rows = answerRows;

          // Flower allocation: uniform-random from the free pool, read inside
          // this transaction. The partial unique index is the final arbiter
          // when two transactions read the same free set concurrently.
          const used = await tx.booking.findMany({
            where: { status: { in: ["pending", "confirmed"] } },
            select: { flowerCode: true },
          });
          const usedCodes = new Set(used.map((row) => row.flowerCode));
          const free = FLOWERS.filter((flower) => !usedCodes.has(flower.code));
          if (free.length === 0) {
            throw new BookingError("FLOWERS_EXHAUSTED", getDictionary(locale).booking.flowersExhausted);
          }
          const flower = free[randomInt(free.length)];

          // Slot guard: conditional update; 0 rows affected = lost the race.
          const claimed = await tx.bookingSlot.updateMany({
            where: { id: slot.id, status: "available" },
            data: { status: "booked" },
          });
          if (claimed.count === 0) {
            throw new BookingError("SLOT_TAKEN", "This slot is no longer available.");
          }

          let surveyResponseId: string | null = null;
          if (service.intakeSurveyId) {
            const response = await tx.surveyResponse.create({
              data: {
                surveyId: service.intakeSurveyId,
                locale,
                // Booking-linked responses are identified via the Booking row,
                // not via respondentKey: a NULL key keeps the
                // @@unique([surveyId, respondentKey]) index from blocking a
                // repeat booking by the same visitor.
                respondentKey: null,
              },
            });
            if (rows.length > 0) {
              await tx.surveyAnswer.createMany({
                data: rows.map((row) => ({ ...row, responseId: response.id })),
              });
            }
            surveyResponseId = response.id;
          }

          // Contact is REQUIRED (15:17 correction). The `?? ""` keeps this
          // compiling while A2's nullable revert is in flight; after the
          // revert zod guarantees non-empty name/email/phone.
          const booking = await tx.booking.create({
            data: {
              referenceCode,
              serviceId: service.id,
              slotId: slot.id,
              surveyResponseId,
              name: data.name ?? "",
              email: data.email?.toLowerCase() ?? "",
              phone: data.phone || null,
              notes: data.notes,
              flowerCode: flower.code,
              status: "pending",
            },
          });

          return {
            id: booking.id,
            referenceCode: booking.referenceCode,
            flowerCode: flower.code,
            flowerName: flowerNameFor(flower.code, locale),
            service: service.slug,
            serviceName: service.translations[0]?.name ?? service.slug,
            startsAt: slot.startsAt.toISOString(),
            endsAt: slot.endsAt.toISOString(),
          };
        });

        // Email confirmation (anti-ghost), only when mail is configured. The
        // booking already exists as `pending`; the token + expiry are
        // attached here so a mail failure never rolls the booking back.
        let confirmationEmailSent = false;
        if (confirmationEmailConfigured()) {
          const { token } = await issueConfirmationToken(prisma, created.id);
          const baseUrl = (process.env.APP_URL ?? new URL(request.url).origin).replace(/\/$/, "");
          confirmationEmailSent = await sendBookingConfirmationEmail({
            to: (data.email ?? "").toLowerCase(),
            locale,
            name: data.name ?? "",
            serviceName: created.serviceName,
            startsAtLabel: formatVnDateTime(created.startsAt, locale),
            referenceCode: created.referenceCode,
            confirmUrl: `${baseUrl}${locale === "en" ? "/en" : "/vi"}/dat-lich-khao-sat/xac-nhan?token=${token}`,
            lookupUrl: `${baseUrl}${locale === "en" ? "/en" : "/vi"}/dat-lich-khao-sat/tra-cuu`,
            expiresHours: CONFIRMATION_TTL_MS / 3_600_000,
          });
        }
        return ok({ ...created, confirmationEmailSent, email: (data.email ?? "").toLowerCase() });
      } catch (error) {
        if (error instanceof BookingError) {
          if (error.code === "SLOT_TAKEN") return fail("SLOT_TAKEN", error.message, 409);
          if (error.code === "SURVEY_CLOSED") return fail("SURVEY_CLOSED", error.message, 409);
          if (error.code === "FLOWERS_EXHAUSTED") return fail("FLOWERS_EXHAUSTED", error.message, 409);
          if (error.code === "SERVICE_NOT_FOUND") return fail("SERVICE_NOT_FOUND", error.message, 404);
          return fail("INVALID_ANSWERS", error.message, 400);
        }
        if (isPrismaUniqueViolation(error) && attempt < FLOWER_ALLOC_RETRIES - 1) {
          continue; // Lost a race on the slot/flower/code index — retry with a fresh read.
        }
        throw error;
      }
    }
    return fail("CONFLICT", "The slot could not be booked. Please try again.", 409);
  });
}
