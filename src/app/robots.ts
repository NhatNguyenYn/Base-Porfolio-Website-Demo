import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/utils";

// Read APP_URL at request time so the sitemap host cannot drift from the
// domain actually serving the site.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Authentication still protects these routes; robots.txt is only a
        // crawl hint and never a security control.
        disallow: ["/admin", "/admin/", "/api/", "/media/", "/preview", "/preview/"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
