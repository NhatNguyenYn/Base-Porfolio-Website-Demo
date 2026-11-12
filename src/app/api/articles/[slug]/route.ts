import { getArticleDetail } from "@/server/queries/articles";
import { fail, ok, publicCache, resolveLocale } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const locale = resolveLocale(new URL(request.url).searchParams.get("locale"));
  if (!locale) return fail("INVALID_LOCALE", "locale must be one of vi, en.", 400);

  const { slug } = await params;
  const result = await getArticleDetail(slug, locale);

  if (result.status === "not_translated") {
    return fail("NOT_TRANSLATED", "This article has no translation in the requested locale.", 404);
  }
  if (result.status !== "ok" || !result.article) {
    // Drafts, archived and scheduled articles are indistinguishable from missing.
    return fail("NOT_FOUND", "Article not found.", 404);
  }

  return ok(result.article, { locale }, publicCache);
}
