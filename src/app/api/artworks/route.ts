import { listArtworks } from "@/server/queries/artworks";
import { fail, ok, paginate, publicCache, readPagination, resolveLocale } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const locale = resolveLocale(params.get("locale"));
  if (!locale) return fail("INVALID_LOCALE", "locale must be one of vi, en.", 400);

  const { page, perPage } = readPagination(params, 24);
  const artworks = await listArtworks(locale, {
    collection: params.get("collection") ?? undefined,
    category: params.get("category") ?? undefined,
    featuredOnly: params.get("featured") === "true",
  });

  const { items, meta } = paginate(artworks, page, perPage);
  return ok(items, { ...meta, locale }, publicCache);
}
