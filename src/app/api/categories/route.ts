import { listCategories } from "@/server/queries/articles";
import { getArtworkCategories } from "@/server/queries/artworks";
import { fail, ok, publicCache, resolveLocale, withApi } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withApi(request, async () => {
    const params = new URL(request.url).searchParams;
    const locale = resolveLocale(params.get("locale"));
    if (!locale) return fail("INVALID_LOCALE", "locale must be one of vi, en.", 400);

    const kind = params.get("kind") === "artwork" ? "artwork" : "article";
    const categories = kind === "artwork" ? await getArtworkCategories(locale) : await listCategories(locale);

    return ok(categories, { locale, kind, total: categories.length }, publicCache);
  });
}
