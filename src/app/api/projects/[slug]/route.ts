import { getProjectDetail } from "@/server/queries/projects";
import { fail, ok, publicCache, resolveLocale } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const locale = resolveLocale(new URL(request.url).searchParams.get("locale"));
  if (!locale) return fail("INVALID_LOCALE", "locale must be one of vi, en.", 400);

  const { slug } = await params;
  const result = await getProjectDetail(slug, locale);

  if (result.status === "not_translated") {
    return fail("NOT_TRANSLATED", "This project has no translation in the requested locale.", 404);
  }
  if (result.status !== "ok" || !result.project) {
    return fail("NOT_FOUND", "Project not found.", 404);
  }

  return ok(result.project, { locale }, publicCache);
}
