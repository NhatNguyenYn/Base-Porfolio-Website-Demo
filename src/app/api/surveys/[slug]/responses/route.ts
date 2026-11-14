// Public survey submit API (Phase 10, Agent C).
// POST /api/surveys/[slug]/responses — anonymous by default, no login.
//
// Deliberate deviation from the rest of the codebase (audit §11.3): a JSON
// POST route handler, not a FormData server action, because the client
// wizard needs structured 409/429 responses (survey closed, duplicate,
// rate-limited).
//
// Pipeline, in order:
// 1. 256 KB request cap (Content-Length header, then the parsed body size).
// 2. requireSameOrigin (CSRF).
// 3. Honeypot + startedAt timing, copied from src/server/actions/contact.ts:
//    bots get a SILENT fake success so they learn nothing, and never consume
//    rate-limit quota. A negative elapsed (clock skew) is never a bot signal.
// 4. Rate limit: 5 submits / 10 min / hashed IP (same budget shape as contact).
// 5. zod surveyResponseSchema.
// 6. Published-survey re-check (status + window + translation) + server-side
//    re-validation of every answer against the STORED questions
//    (src/lib/survey-response-validation.ts): required, text length, choice
//    ∈ declared options, rating/NPS bounds, duplicate-option rejection.
// 7. prisma.$transaction (response + answers). The survey's published state
//    is re-checked INSIDE the transaction so a survey closed mid-submit
//    cannot accept a late response.
// 8. Returns { success, data: { responseId } } only — never other responses.
//
// Identified-survey dedupe: when the caller supplies `respondentKey` it must
// already be sha256(lower(email)) (64 hex chars) — the booking intake flow
// computes it; the standalone public form never sends an email, so its
// respondentKey is absent and the response is anonymous. Dedupe is enforced
// by @@unique([surveyId, respondentKey]); Postgres treats NULLs as distinct,
// so anonymous responses are unaffected. Anonymous surveys CANNOT be deduped
// server-side — no cookie/fingerprint is used, and the client-side
// "already submitted" state is UX only, never a security control.
//
// No IP / userAgent is stored: the schema has no such columns, by design.
import { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { getPublishedSurvey } from "@/data/surveys";
import { fail, ok, readJson, requireSameOrigin, withApi } from "@/lib/api";
import { clientIp, hashedKey, rateLimit } from "@/lib/rate-limit";
import { MAX_SURVEY_RESPONSE_JSON_BYTES } from "@/lib/survey-limits";
import { surveyResponseSchema, zodFieldErrors } from "@/lib/validation";
import { validateSurveyAnswers, type StoredQuestion } from "@/lib/survey-response-validation";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

const SURVEY_SUBMIT_LIMIT = 5;
const SURVEY_SUBMIT_WINDOW_MS = 10 * 60 * 1000;
const MIN_HUMAN_SUBMIT_MS = 1800;
const RESPONDENT_KEY_PATTERN = /^[0-9a-f]{64}$/;

function surveyClosedError(): Error {
  return Object.assign(new Error("Survey closed"), { code: "SURVEY_CLOSED" });
}

function isSurveyClosedError(error: unknown): boolean {
  return error instanceof Error && (error as { code?: unknown }).code === "SURVEY_CLOSED";
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return withApi(request, async () => {
    const { slug } = await params;

    // 1. Request-size cap: 256 KB.
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_SURVEY_RESPONSE_JSON_BYTES) {
      return fail("PAYLOAD_TOO_LARGE", "Response is too large.", 413);
    }

    // 2. Origin check.
    const originError = requireSameOrigin(request);
    if (originError) return originError;

    const body = await readJson(request);
    if (!body) return fail("INVALID_JSON", "Request body must be a JSON object.", 400);
    if (Buffer.byteLength(JSON.stringify(body), "utf8") > MAX_SURVEY_RESPONSE_JSON_BYTES) {
      return fail("PAYLOAD_TOO_LARGE", "Response is too large.", 413);
    }

    // 3. Honeypot + timing (contact.ts pattern). Bots get a silent fake
    // success — same envelope shape as a real one — and no rate-limit hit.
    const honeypot = body.website;
    const startedAt = Number(body.startedAt ?? 0);
    const elapsed = Number.isFinite(startedAt) && startedAt > 0 ? Date.now() - startedAt : null;
    const tooFast = elapsed !== null && elapsed >= 0 && elapsed < MIN_HUMAN_SUBMIT_MS;
    if ((typeof honeypot === "string" && honeypot.length > 0) || tooFast) {
      return ok({ responseId: "ok" });
    }

    // 4. Rate limit (hashed IP — the raw IP is never stored or used as a key).
    const requestHeaders = await headers();
    const limit = rateLimit(
      `survey-submit:${hashedKey(clientIp(requestHeaders))}`,
      SURVEY_SUBMIT_LIMIT,
      SURVEY_SUBMIT_WINDOW_MS,
    );
    if (!limit.ok) {
      return fail("RATE_LIMITED", "Too many submissions. Please try again shortly.", 429, {
        retryAfterSeconds: limit.retryAfterSeconds,
      });
    }

    // 5. Zod shape validation.
    const parsed = surveyResponseSchema.safeParse({ ...body, slug });
    if (!parsed.success) {
      return fail("INVALID", "Submitted response is not valid.", 400, zodFieldErrors(parsed.error));
    }
    const input = parsed.data;

    // Identified surveys only: respondentKey must already be a sha256 hex
    // digest (computed by the caller, e.g. the booking intake flow). The
    // raw email is never sent to, or stored by, this endpoint.
    const respondentKey =
      input.respondentKey !== undefined ? input.respondentKey.trim().toLowerCase() : undefined;
    if (respondentKey !== undefined && !RESPONDENT_KEY_PATTERN.test(respondentKey)) {
      return fail("INVALID_RESPONDENT_KEY", "respondentKey must be a sha256 hex digest.", 400);
    }

    // 6. Survey must be published, in-window, and translated in this locale.
    const { status, survey } = await getPublishedSurvey(slug, input.locale);
    if (status === "closed") {
      return fail("SURVEY_CLOSED", "This survey is closed and no longer accepts answers.", 409);
    }
    if (status !== "ok" || !survey) {
      return fail("NOT_FOUND", "Survey not found.", 404);
    }

    const storedQuestions: StoredQuestion[] = survey.questions.map((question) => ({
      id: question.id,
      type: question.type,
      required: question.required,
      minLength: question.minLength,
      maxLength: question.maxLength,
      minRating: question.minRating,
      maxRating: question.maxRating,
      options: question.options.map((option) => ({ id: option.id, value: option.value })),
    }));

    const validated = validateSurveyAnswers(storedQuestions, input.answers);
    if (!validated.ok) {
      return fail("INVALID_ANSWERS", "Some answers are not valid.", 400, {
        errors: validated.errors,
      });
    }

    // 7. One transaction: response + one answer row per answer (one row per
    // selected option for multiple_choice). The survey state is re-checked
    // inside the transaction so a close landing mid-submit cannot leak in.
    try {
      const response = await prisma.$transaction(async (tx) => {
        const now = new Date();
        const live = await tx.survey.findUnique({
          where: { slug },
          select: { status: true, deletedAt: true, publishedAt: true, startsAt: true, endsAt: true },
        });
        if (
          !live ||
          live.deletedAt ||
          live.status !== "published" ||
          !live.publishedAt ||
          live.publishedAt.getTime() > now.getTime() ||
          (live.startsAt && live.startsAt.getTime() > now.getTime()) ||
          (live.endsAt && live.endsAt.getTime() < now.getTime())
        ) {
          throw surveyClosedError();
        }
        const created = await tx.surveyResponse.create({
          data: {
            surveyId: survey.id,
            locale: input.locale,
            respondentKey: respondentKey ?? null,
          },
          select: { id: true },
        });
        if (validated.rows.length > 0) {
          await tx.surveyAnswer.createMany({
            data: validated.rows.map((row) => ({
              responseId: created.id,
              questionId: row.questionId,
              optionId: row.optionId,
              value: row.value,
            })),
          });
        }
        return created;
      });
      return ok({ responseId: response.id });
    } catch (error) {
      if (isSurveyClosedError(error)) {
        return fail("SURVEY_CLOSED", "This survey is closed and no longer accepts answers.", 409);
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        // @@unique([surveyId, respondentKey]): an identified respondent
        // submitting twice. Anonymous responses (NULL key) never hit this.
        return fail("DUPLICATE_RESPONSE", "You have already submitted this survey.", 409);
      }
      throw error;
    }
  });
}
