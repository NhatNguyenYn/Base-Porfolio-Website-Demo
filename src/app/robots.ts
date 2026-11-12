import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/utils";

// Static in both builds: the content depends only on APP_URL, never on the
// database. (Also required for the GitHub Pages static export.)
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/api/", "/media/"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
