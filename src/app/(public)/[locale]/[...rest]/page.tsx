import { notFound } from "next/navigation";

/**
 * Unknown paths under a locale resolve to the localized 404 page. notFound()
 * is called during metadata resolution so the HTTP status is 404 rather than a
 * soft 404 from the streamed shell.
 */
export async function generateMetadata() {
  notFound();
}

export default function CatchAllPage() {
  notFound();
}
