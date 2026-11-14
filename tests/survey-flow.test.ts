// DB + HTTP integration: survey lifecycle and submission (Phase 10, Agent G).
//
// The REAL public submit handler is invoked (src/app/api/surveys/[slug]/
// responses/route.ts). `next/headers` is mocked per file because the handler
// reads the client IP for rate limiting through it, and `headers()` throws
// outside a Next request scope in vitest. Each call gets a fresh
// X-Forwarded-For identity so the 5-submits/10-min rate limit never bleeds
// between tests; the rate limit itself is NOT what is under test here.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const mockHeaders = vi.hoisted(() => {
  // One stub for every call: each read of X-Forwarded-For returns a fresh
  // IP, so parallel requests never share a rate-limit bucket (the handlers
  // call headers() exactly once per request, for clientIp()).
  let n = 300;
  return {
    current: {
      get: (name: string) => {
        if (name.toLowerCase() === "x-forwarded-for") {
          n += 1;
          return `203.0.113.${n}`;
        }
        return null;
      },
    } as unknown as Headers,
  };
});
vi.mock("next/headers", () => ({
  headers: async () => mockHeaders.current,
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
}));

import { POST as submitSurvey } from "@/app/api/surveys/[slug]/responses/route";
import { getPublishedSurvey } from "@/data/surveys";
import { prisma } from "@/server/db";
import { resetDatabase } from "./helpers/db";
import {
  countResponses,
  createSurveyFixture,
  publishSurvey,
  setSurveyStatus,
  sha256Hex,
  uid,
  validAnswers,
} from "./helpers/phase10";

async function submit(
  slug: string,
  body: Record<string, unknown>,
): Promise<{ status: number; json: Record<string, any> }> {
  const res = await submitSurvey(
    new Request(`http://localhost:3000/api/surveys/${slug}/responses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug }) },
  );
  return { status: res.status, json: (await res.json()) as Record<string, any> };
}

beforeAll(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("survey lifecycle: create → publish → submit", () => {
  it("draft survey is invisible publicly and rejects submissions", async () => {
    const { survey, questions } = await createSurveyFixture();
    const { status } = await getPublishedSurvey(survey.slug, "vi");
    expect(status).toBe("not_found");

    const { status: httpStatus, json } = await submit(survey.slug, {
      locale: "vi",
      answers: validAnswers(questions),
    });
    expect(httpStatus).toBe(404);
    expect(json.error.code).toBe("NOT_FOUND");
    expect(await countResponses(survey.id)).toBe(0);
  });

  it("published survey accepts a valid response and stores one row per answer", async () => {
    const { survey, questions } = await createSurveyFixture();
    await publishSurvey(survey.id);
    expect((await getPublishedSurvey(survey.slug, "vi")).status).toBe("ok");

    const { status, json } = await submit(survey.slug, {
      locale: "vi",
      answers: validAnswers(questions),
    });
    expect(status).toBe(200);
    expect(json.success).toBe(true);
    expect(typeof json.data.responseId).toBe("string");

    const stored = await prisma.surveyResponse.findUnique({
      where: { id: json.data.responseId },
      include: { answers: true },
    });
    expect(stored).not.toBeNull();
    expect(stored?.locale).toBe("vi");
    // 6 questions, multiple_choice contributes 2 rows → 7 answer rows.
    expect(stored?.answers).toHaveLength(7);
    const rating = stored?.answers.find((a) => a.value === "4");
    expect(rating).toBeDefined();
    const choice = stored?.answers.find((a) => a.value === "red");
    expect(choice?.optionId).toBeTruthy();
  });

  it("rejects a missing required answer and stores nothing", async () => {
    const { survey, questions } = await createSurveyFixture();
    await publishSurvey(survey.id);
    const answers = validAnswers(questions).filter(
      (a) => a.questionId !== questions.find((q) => q.type === "short_text")?.id,
    );
    const { status, json } = await submit(survey.slug, { locale: "vi", answers });
    expect(status).toBe(400);
    expect(json.error.code).toBe("INVALID_ANSWERS");
    expect(await countResponses(survey.id)).toBe(0);
  });

  it("rejects a rating outside the question range and stores nothing", async () => {
    const { survey, questions } = await createSurveyFixture();
    await publishSurvey(survey.id);
    const answers = validAnswers(questions).map((a) =>
      a.type === "rating" ? { ...a, value: "6" } : a,
    );
    const { status } = await submit(survey.slug, { locale: "vi", answers });
    expect(status).toBe(400);
    expect(await countResponses(survey.id)).toBe(0);
  });

  it("rejects an unknown option value and stores nothing", async () => {
    const { survey, questions } = await createSurveyFixture();
    await publishSurvey(survey.id);
    const answers = validAnswers(questions).map((a) =>
      a.type === "single_choice" ? { ...a, optionValues: ["green"] } : a,
    );
    const { status } = await submit(survey.slug, { locale: "vi", answers });
    expect(status).toBe(400);
    expect(await countResponses(survey.id)).toBe(0);
  });

  it("rejects an unknown question id and stores nothing", async () => {
    const { survey, questions } = await createSurveyFixture();
    await publishSurvey(survey.id);
    const answers = [
      ...validAnswers(questions),
      { questionId: "question-khong-ton-tai", type: "short_text", value: "x", optionValues: [] },
    ];
    const { status } = await submit(survey.slug, { locale: "vi", answers });
    expect(status).toBe(400);
    expect(await countResponses(survey.id)).toBe(0);
  });

  it("rejects a duplicate identified response via @@unique([surveyId, respondentKey])", async () => {
    const { survey, questions } = await createSurveyFixture();
    await publishSurvey(survey.id);
    const respondentKey = sha256Hex("respondent@example.com");
    const body = { locale: "vi", respondentKey, answers: validAnswers(questions) };

    const first = await submit(survey.slug, body);
    expect(first.status).toBe(200);
    const second = await submit(survey.slug, body);
    expect(second.status).toBe(409);
    expect(second.json.error.code).toBe("DUPLICATE_RESPONSE");
    expect(await countResponses(survey.id)).toBe(1);
  });

  it("allows repeated anonymous responses (NULL respondentKey is never deduped)", async () => {
    const { survey, questions } = await createSurveyFixture();
    await publishSurvey(survey.id);
    const body = { locale: "vi", answers: validAnswers(questions) };
    expect((await submit(survey.slug, body)).status).toBe(200);
    expect((await submit(survey.slug, body)).status).toBe(200);
    expect(await countResponses(survey.id)).toBe(2);
  });

  it("closed survey rejects new submissions with SURVEY_CLOSED", async () => {
    const { survey, questions } = await createSurveyFixture();
    await publishSurvey(survey.id);
    await setSurveyStatus(survey.id, "closed");
    expect((await getPublishedSurvey(survey.slug, "vi")).status).toBe("closed");

    const { status, json } = await submit(survey.slug, { locale: "vi", answers: validAnswers(questions) });
    expect(status).toBe(409);
    expect(json.error.code).toBe("SURVEY_CLOSED");
    expect(await countResponses(survey.id)).toBe(0);
  });

  it("archived survey rejects new submissions with SURVEY_CLOSED and keeps old responses", async () => {
    const { survey, questions } = await createSurveyFixture();
    await publishSurvey(survey.id);
    const ok = await submit(survey.slug, { locale: "vi", answers: validAnswers(questions) });
    expect(ok.status).toBe(200);

    await setSurveyStatus(survey.id, "archived");
    const { status, json } = await submit(survey.slug, { locale: "vi", answers: validAnswers(questions) });
    expect(status).toBe(409);
    expect(json.error.code).toBe("SURVEY_CLOSED");
    // Archiving/closing never deletes responses.
    expect(await countResponses(survey.id)).toBe(1);
  });

  it("survey past its endsAt window rejects submissions", async () => {
    const { survey, questions } = await createSurveyFixture();
    await publishSurvey(survey.id);
    await prisma.survey.update({
      where: { id: survey.id },
      data: { endsAt: new Date(Date.now() - 60_000) },
    });
    const { status, json } = await submit(survey.slug, { locale: "vi", answers: validAnswers(questions) });
    expect(status).toBe(409);
    expect(json.error.code).toBe("SURVEY_CLOSED");
    expect(await countResponses(survey.id)).toBe(0);
  });

  it("rejects a respondentKey that is not a sha256 hex digest", async () => {
    const { survey, questions } = await createSurveyFixture();
    await publishSurvey(survey.id);
    const { status, json } = await submit(survey.slug, {
      locale: "vi",
      respondentKey: "raw-email@example.com",
      answers: validAnswers(questions),
    });
    expect(status).toBe(400);
    expect(json.error.code).toBe("INVALID_RESPONDENT_KEY");
    expect(await countResponses(survey.id)).toBe(0);
  });

  it("two surveys with the same respondent email dedupe independently", async () => {
    const a = await createSurveyFixture({ slug: `p10-a-${uid()}` });
    const b = await createSurveyFixture({ slug: `p10-b-${uid()}` });
    await publishSurvey(a.survey.id);
    await publishSurvey(b.survey.id);
    const respondentKey = sha256Hex("same-person@example.com");
    expect(
      (await submit(a.survey.slug, { locale: "vi", respondentKey, answers: validAnswers(a.questions) }))
        .status,
    ).toBe(200);
    expect(
      (await submit(b.survey.slug, { locale: "vi", respondentKey, answers: validAnswers(b.questions) }))
        .status,
    ).toBe(200);
    expect(await countResponses(a.survey.id)).toBe(1);
    expect(await countResponses(b.survey.id)).toBe(1);
  });
});
