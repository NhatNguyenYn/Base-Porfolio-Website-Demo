// DB + unit integration: survey CSV export (Phase 10, Agent G).
//
// Two layers:
//  1. Pure CSV helpers (escapeCsvCell / toCsvRow / displayAnswerValue) —
//     unit-tested directly, including the formula-injection guard.
//  2. A full exported file built the same way the export route builds it
//     (header + one row per response from stored answers), asserted for
//     UTF-8 BOM, VI diacritics, headers, escaping and the formula guard.
// The route's auth gate (non-admin 401/403) and the BOM on the real HTTP
// response are covered against the live dev server in e2e/survey.spec.ts,
// because authorize() goes through getSessionUser() (React cache() + cookies),
// which cannot be driven faithfully from vitest.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { resetDatabase } from "./helpers/db";
import {
  displayAnswerValue,
  escapeCsvCell,
  optionLabelOf,
  questionTitleOf,
  toCsvRow,
} from "@/server/queries/survey-responses";
import {
  createSurveyFixture,
  publishSurvey,
  validAnswers,
} from "./helpers/phase10";

beforeAll(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("escapeCsvCell (RFC 4180 + formula-injection guard)", () => {
  it("passes plain cells through unchanged", () => {
    expect(escapeCsvCell("hello")).toBe("hello");
    expect(escapeCsvCell("Câu trả lời tiếng Việt có dấu")).toBe("Câu trả lời tiếng Việt có dấu");
    expect(escapeCsvCell("")).toBe("");
    expect(escapeCsvCell("123")).toBe("123");
  });

  it("quotes cells containing a comma, quote or newline (doubling inner quotes)", () => {
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(escapeCsvCell("a\rb")).toBe('"a\rb"');
  });

  it("prefixes a single quote for every formula-trigger leading character", () => {
    for (const trigger of ["=", "+", "-", "@", "\t", "\r"]) {
      const cell = escapeCsvCell(`${trigger}2+5`);
      // The guard prefix is always present right before the payload…
      expect(cell).toContain(`'${trigger}2+5`);
      // …and for triggers that do not themselves force RFC-4180 quoting,
      // the guarded cell starts with the quote.
      if (trigger !== "\r") expect(cell.startsWith("'")).toBe(true);
      // The "\r" trigger forces quoting, so the guard sits after the quote.
      if (trigger === "\r") expect(cell.startsWith(`"'\r2+5"`)).toBe(true);
    }
    expect(escapeCsvCell("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(escapeCsvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(escapeCsvCell("+2+5")).toBe("'+2+5");
    expect(escapeCsvCell("-2+5")).toBe("'-2+5");
    // A trigger NOT at the start is left alone.
    expect(escapeCsvCell("a=b")).toBe("a=b");
    expect(escapeCsvCell("email@example.com")).toBe("email@example.com");
  });

  it("applies the formula guard BEFORE quoting", () => {
    // Starts with "=" AND contains a comma → guard prefix, then quotes.
    expect(escapeCsvCell("=1,2")).toBe("\"'=1,2\"");
  });

  it("toCsvRow joins cells with commas", () => {
    expect(toCsvRow(["a", "b,c", "d"])).toBe('a,"b,c",d');
    expect(toCsvRow([])).toBe("");
  });
});

describe("exported CSV content (built from stored responses)", () => {
  it("has the header row, VI diacritics, escaping and the formula guard", async () => {
    const { survey, questions } = await createSurveyFixture({
      titleVi: "Khảo sát xuất CSV — tiếng Việt",
    });
    await publishSurvey(survey.id);
    const textQ = questions.find((q) => q.type === "short_text")!;
    const choiceQ = questions.find((q) => q.type === "single_choice")!;

    // Response 1: normal answers, incl. VI diacritics.
    const r1 = await prisma.surveyResponse.create({
      data: {
        surveyId: survey.id,
        locale: "vi",
        answers: {
          create: [
            { questionId: textQ.id, optionId: null, value: "Câu trả lời có dấu, và dấu phẩy" },
            {
              questionId: choiceQ.id,
              optionId: choiceQ.options[0].id,
              value: choiceQ.options[0].value,
            },
          ],
        },
      },
      select: { id: true },
    });
    // Response 2: formula-injection attempts + a quote in the text.
    const r2 = await prisma.surveyResponse.create({
      data: {
        surveyId: survey.id,
        locale: "vi",
        answers: {
          create: [
            { questionId: textQ.id, optionId: null, value: "=2+5" },
            { questionId: choiceQ.id, optionId: choiceQ.options[1].id, value: choiceQ.options[1].value },
          ],
        },
      },
      select: { id: true },
    });
    // Response 3: an answer starting with "@" and one with a double quote.
    await prisma.surveyResponse.create({
      data: {
        surveyId: survey.id,
        locale: "vi",
        answers: {
          create: [
            { questionId: textQ.id, optionId: null, value: '@SUM(A1:A2) và "trích dẫn"' },
            { questionId: choiceQ.id, optionId: choiceQ.options[0].id, value: choiceQ.options[0].value },
          ],
        },
      },
    });

    // Build the file exactly as the export route does: header from question
    // titles, one row per response, display values per question.
    const storedQuestions = await prisma.surveyQuestion.findMany({
      where: { surveyId: survey.id },
      select: { id: true, type: true, translations: true },
      orderBy: { order: "asc" },
    });
    const header = toCsvRow([
      "response_id",
      "submitted_at",
      "locale",
      ...storedQuestions.map((q) => questionTitleOf(q.translations, q.id)),
    ]);
    const rows = await prisma.surveyResponse.findMany({
      where: { surveyId: survey.id },
      orderBy: { submittedAt: "asc" },
      include: { answers: { include: { option: { select: { value: true, translations: true } } } } },
    });
    const questionType = new Map(storedQuestions.map((q) => [q.id, q.type]));
    const lines = rows.map((row) =>
      toCsvRow([
        row.id,
        row.submittedAt.toISOString(),
        row.locale,
        ...storedQuestions.map((q) => {
          const mine = row.answers.filter((a) => a.questionId === q.id);
          return mine
            .map((a) =>
              displayAnswerValue({
                type: questionType.get(a.questionId) ?? "",
                value: a.value,
                optionLabel: a.option ? optionLabelOf(a.option.translations, a.option.value) : null,
              }),
            )
            .join("; ");
        }),
      ]),
    );
    const csv = `\uFEFF${header}\r\n${lines.join("\r\n")}\r\n`;

    // UTF-8 BOM first — Excel needs it for Vietnamese.
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("response_id,submitted_at,locale");
    // Question titles are the VI titles (headers, not ids).
    expect(csv).toContain("Câu hỏi kiểm thử short_text");
    expect(csv).toContain("Câu hỏi kiểm thử single_choice");
    // Both response ids are present, one row each.
    expect(csv).toContain(r1.id);
    expect(csv).toContain(r2.id);
    expect(lines).toHaveLength(3);
    // VI diacritics intact (not mojibake / not stripped).
    expect(csv).toContain("Câu trả lời có dấu");
    // Comma inside a cell is quoted, not a column split.
    expect(csv).toContain('"Câu trả lời có dấu, và dấu phẩy"');
    // Formula guard: the raw payloads never appear unguarded at cell start.
    expect(csv).not.toContain(',"=2+5"');
    expect(csv).not.toContain(",=2+5");
    expect(csv).toContain("'=2+5");
    expect(csv).toContain("'@SUM(A1:A2)");
    // Inner double quotes are doubled per RFC 4180.
    expect(csv).toContain('""trích dẫn""');
    // Choice answers render as labels (Đỏ/Xanh), not raw values, in the
    // display column — the stored value is still the slug in the DB.
    expect(csv).toContain("Đỏ");
    expect(csv).toContain("Xanh");
    // Sanity: the fixture's valid-answers helper also round-trips.
    expect(validAnswers(questions).length).toBe(questions.length);
  });
});
