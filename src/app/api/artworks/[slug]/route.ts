import { getArtworkDetail } from "@/server/queries/artworks";
import { fail, ok, publicCache, resolveLocale, withApi } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return withApi(request, async () => {
    const locale = resolveLocale(new URL(request.url).searchParams.get("locale"));
    if (!locale) return fail("INVALID_LOCALE", "locale must be one of vi, en.", 400);

    const { slug } = await params;
    const result = await getArtworkDetail(slug, locale);

    if (result.status === "not_translated") {
      return fail("NOT_TRANSLATED", "This artwork has no translation in the requested locale.", 404);
    }
    if (result.status !== "ok" || !result.artwork) {
      return fail("NOT_FOUND", "Artwork not found.", 404);
    }

    return ok(result.artwork, { locale }, publicCache);
  });
}
