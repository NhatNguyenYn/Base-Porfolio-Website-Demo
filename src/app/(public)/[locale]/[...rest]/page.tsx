import { notFound } from "next/navigation";

/**
 * Unknown paths under a locale resolve to the localized 404 page. notFound()
 * is called during metadata resolution so the HTTP status is 404 rather than a
 * soft 404 from the streamed shell.
 */

// Static-export build (GitHub Pages demo): nothing to prerender here —
// unknown paths fall through to the hosting 404 page. Ignored by the dynamic build.
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata() {
  notFound();
}

export default function CatchAllPage() {
  notFound();
}
