import { listArticles } from "@/server/queries/articles";
import { fail, ok, publicCache, readPagination, resolveLocale } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const locale = resolveLocale(params.get("locale"));
  if (!locale) return fail("INVALID_LOCALE", "locale must be one of vi, en.", 400);

  const { page, perPage } = readPagination(params, 9);
  const result = await listArticles(locale, {
    q: params.get("q") ?? undefined,
    category: params.get("category") ?? undefined,
    tag: params.get("tag") ?? undefined,
    page,
    perPage,
  });

  return ok(
    result.items,
    {
      locale,
      page: result.page,
      perPage,
      total: result.total,
      pages: result.pages,
      categories: result.categories,
      tags: result.tags,
    },
    publicCache,
  );
}
