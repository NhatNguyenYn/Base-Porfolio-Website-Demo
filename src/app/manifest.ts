import type { MetadataRoute } from "next";
import { defaultLocale } from "@/i18n/config";
import { assetUrl, getBasePath } from "@/lib/asset";
import { getSettings } from "@/data/settings";

/**
 * Web app manifest. The name comes from site settings (with the default when
 * the database is unreachable); icons reuse the bundled 512×512 icon.png.
 * theme/background colours match --background in globals.css.
 *
 * Without an explicit dynamic export, the Pages static-export build fails
 * on this route ("force-static/revalidate not configured"); the Pages demo
 * build rewrites this to "force-static" (see .github/workflows/pages.yml),
 * the full-stack build keeps it dynamic — same convention as sitemap.ts
 * and robots.ts.
 */
export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let name = "Portfolio Studio";
  try {
    name = (await getSettings()).siteName;
  } catch {
    // Manifest must still serve when settings cannot load.
  }

  // Manifest URLs are root-absolute paths: under the Pages demo subpath
  // they must carry the basePath, otherwise start_url/scope/icons 404.
  // Server mode has no basePath, so assetUrl/getBasePath are identity there.
  const basePath = getBasePath();
  return {
    name,
    short_name: name,
    description: "Personal portfolio — selected work, art gallery and writing.",
    start_url: `${basePath}/${defaultLocale}`,
    scope: `${basePath}/`,
    display: "standalone",
    background_color: "#f8f8f6",
    theme_color: "#f8f8f6",
    icons: [
      {
        src: assetUrl("/icon.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
