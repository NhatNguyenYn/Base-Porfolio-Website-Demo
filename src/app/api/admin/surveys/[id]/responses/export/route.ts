import { authorize, fail, withApi } from "@/lib/api";
import { logActivity } from "@/server/audit";
import { prisma } from "@/server/db";
import {
  displayAnswerValue,
  getSurveyForResponses,
  optionLabelOf,
  questionTitleOf,
  toCsvRow,
} from "@/server/queries/survey-responses";

export const dynamic = "force-dynamic";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CHUNK_SIZE = 500;

function parseDateParam(value: string | null, endOfDay: boolean): Date | undefined {
  if (!value || !DATE_PATTERN.test(value)) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+07:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * GET /api/admin/surveys/[id]/responses/export — admin-only CSV export.
 *
 * UTF-8 with BOM (Excel + Vietnamese), header row
 * `response_id, submitted_at, locale, <question titles…>`, one row per
 * response, RFC 4180 quoting + formula-injection guard (see escapeCsvCell).
 * Responses are read in chunks of 500 and streamed out; answers are never
 * loaded into a single array. `Cache-Control: private, no-store`.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(request, async () => {
    const guard = await authorize();
    if ("error" in guard) return guard.error;

    const { id } = await params;
    const survey = await getSurveyForResponses(id);
    if (!survey || survey.deletedAt) {
      return fail("NOT_FOUND", "Survey not found.", 404);
    }

    const search = new URL(request.url).searchParams;
    const from = parseDateParam(search.get("from"), false);
    const to = parseDateParam(search.get("to"), true);
    const submittedAt =
      from || to
        ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) }
        : undefined;
    const responseWhere = { surveyId: survey.id, ...(submittedAt ? { submittedAt } : {}) };

    const questions = await prisma.surveyQuestion.findMany({
      where: { surveyId: survey.id },
      select: { id: true, type: true, translations: true },
      orderBy: { order: "asc" },
    });
    const header = toCsvRow([
      "response_id",
      "submitted_at",
      "locale",
      ...questions.map((question) => questionTitleOf(question.translations, question.id)),
    ]);

    await logActivity({
      userId: guard.user.id,
      action: "export",
      entityType: "survey_response",
      entityId: survey.id,
      summary: `Exported survey responses to CSV (${survey.slug})`,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          // UTF-8 BOM so Excel opens Vietnamese text correctly.
          controller.enqueue(encoder.encode(`\uFEFF${header}\r\n`));
          let offset = 0;
          for (;;) {
            const rows = await prisma.surveyResponse.findMany({
              where: responseWhere,
              orderBy: { submittedAt: "asc" },
              skip: offset,
              take: CHUNK_SIZE,
              select: { id: true, locale: true, submittedAt: true },
            });
            if (rows.length === 0) break;

            const answers = await prisma.surveyAnswer.findMany({
              where: { responseId: { in: rows.map((row) => row.id) } },
              select: {
                responseId: true,
                questionId: true,
                value: true,
                option: { select: { value: true, translations: true } },
              },
            });
            const questionType = new Map(questions.map((item) => [item.id, item.type]));
            const cellsByResponse = new Map<string, Map<string, string[]>>();
            for (const answer of answers) {
              const text = displayAnswerValue({
                type: questionType.get(answer.questionId) ?? "",
                value: answer.value,
                optionLabel: answer.option
                  ? optionLabelOf(answer.option.translations, answer.option.value)
                  : null,
              });
              const byQuestion =
                cellsByResponse.get(answer.responseId) ?? new Map<string, string[]>();
              const list = byQuestion.get(answer.questionId) ?? [];
              list.push(text);
              byQuestion.set(answer.questionId, list);
              cellsByResponse.set(answer.responseId, byQuestion);
            }

            const lines: string[] = [];
            for (const row of rows) {
              const byQuestion = cellsByResponse.get(row.id);
              lines.push(
                toCsvRow([
                  row.id,
                  row.submittedAt.toISOString(),
                  row.locale,
                  ...questions.map((question) =>
                    (byQuestion?.get(question.id) ?? []).join("; "),
                  ),
                ]),
              );
            }
            controller.enqueue(encoder.encode(`${lines.join("\r\n")}\r\n`));

            offset += rows.length;
            if (rows.length < CHUNK_SIZE) break;
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="responses-${survey.slug}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  });
}
