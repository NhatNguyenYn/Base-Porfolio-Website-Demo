import { listCollections } from "@/server/queries/artworks";
import { fail, ok, publicCache, resolveLocale } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const locale = resolveLocale(new URL(request.url).searchParams.get("locale"));
  if (!locale) return fail("INVALID_LOCALE", "locale must be one of vi, en.", 400);

  const collections = await listCollections(locale);
  return ok(collections, { locale, total: collections.length }, publicCache);
}
