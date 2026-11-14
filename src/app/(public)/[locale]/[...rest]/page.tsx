import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n";
import { isLocale, type Locale } from "@/i18n/config";
import { getSettings } from "@/data/settings";
import { buildPageMetadata } from "@/lib/seo";

/**
 * Unknown paths under a locale resolve to the localized 404 page.
 *
 * 404 noindex: generateMetadata returns a noindex page (instead of throwing
 * notFound() during metadata resolution, which would discard the metadata and
 * let the 404 inherit the indexable layout metadata). The component still
 * calls notFound(), so the HTTP status stays 404. Next 15 has no
 * generateMetadata support in not-found.tsx itself, and next.config headers()
 * cannot target 404 responses, so this metadata path is the cleanest option.
 * Detail pages already follow the same pattern (noindex metadata + notFound()
 * in the component) for missing translations.
 */

// Static-export build (GitHub Pages demo): nothing to prerender here —
// unknown paths fall through to the hosting 404 page. Ignored by the dynamic build.
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; rest: string[] }>;
}): Promise<Metadata> {
  const { locale: raw, rest } = await params;
  const locale: Locale = isLocale(raw) ? raw : "vi";
  const dict = getDictionary(locale);
  const path = `/${(rest ?? []).join("/")}`;
  let siteName = "Portfolio Studio";
  try {
    siteName = (await getSettings()).siteName;
  } catch {
    // The 404 must still render noindex when settings cannot load.
  }
  return buildPageMetadata({
    locale,
    path,
    title: dict.notFound.title,
    description: dict.notFound.text,
    siteName,
    noindex: true,
  });
}

export default function CatchAllPage() {
  notFound();
}
