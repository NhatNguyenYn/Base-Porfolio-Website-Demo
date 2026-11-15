import { countArtworks, listArtworks } from "@/server/queries/artworks";
import { fail, ok, publicCache, readPagination, resolveLocale, withApi } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withApi(request, async () => {
    const params = new URL(request.url).searchParams;
    const locale = resolveLocale(params.get("locale"));
    if (!locale) return fail("INVALID_LOCALE", "locale must be one of vi, en.", 400);

    const { page, perPage } = readPagination(params, 24);
    const filters = {
      collection: params.get("collection") ?? undefined,
      category: params.get("category") ?? undefined,
      featuredOnly: params.get("featured") === "true",
    };
    // Paginate at the database: the gallery asks for one batch at a time
    // instead of all 117 rows (see listArtworks).
    const total = await countArtworks(locale, filters);
    const pages = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(page, pages);
    const artworks = await listArtworks(locale, {
      ...filters,
      limit: perPage,
      offset: (safePage - 1) * perPage,
    });
    return ok(artworks, { page: safePage, perPage, total, pages, locale }, publicCache);
  });
}
