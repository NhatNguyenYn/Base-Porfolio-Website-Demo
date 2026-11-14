// Public survey detail API (Phase 10, Agent C).
// GET /api/surveys/[slug]?locale=vi — published survey only. Returns the
// survey + sections + questions + options + theme. NEVER responses,
// respondent keys, or admin fields (the DTO in src/data/surveys.ts contains
// nothing else to leak).
import { getPublishedSurvey } from "@/data/surveys";
import { fail, ok, publicCache, resolveLocale, withApi } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return withApi(request, async () => {
    const locale = resolveLocale(new URL(request.url).searchParams.get("locale"));
    if (!locale) return fail("INVALID_LOCALE", "locale must be one of vi, en.", 400);

    const { slug } = await params;
    const result = await getPublishedSurvey(slug, locale);

    if (result.status === "not_translated") {
      return fail("NOT_TRANSLATED", "This survey has no translation in the requested locale.", 404);
    }
    if (result.status === "closed") {
      return fail("SURVEY_CLOSED", "This survey is closed.", 409);
    }
    if (result.status !== "ok" || !result.survey) {
      // Drafts and missing surveys are indistinguishable from each other.
      return fail("NOT_FOUND", "Survey not found.", 404);
    }

    return ok(result.survey, { locale }, publicCache);
  });
}
