import { redirect } from "next/navigation";
import { isLocale, localeHref, type Locale } from "@/i18n/config";

// The GitHub Pages demo build rewrites this to "force-static"
// (see .github/workflows/pages.yml); the full-stack build keeps it dynamic.
export const dynamic = "force-dynamic";

/**
 * Projects are hidden from the public site: a project category URL redirects
 * to the homepage instead of rendering (and never 404s, so old links and
 * bookmarks keep landing somewhere useful).
 */
export default async function ProjectCategoryPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = (isLocale(raw) ? raw : "vi") as Locale;
  redirect(localeHref(locale, "/"));
}
