import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/utils";

// Read APP_URL at request time so the sitemap host cannot drift from the
// domain actually serving the site.
export const dynamic = "force-dynamic";

/**
 * Bare hostname for the robots `Host` directive (a full URL with scheme and
 * trailing slash is invalid there). Falls back to localhost when APP_URL is
 * unset, matching absoluteUrl's fallback.
 */
export function robotsHost(): string {
  try {
    return new URL(process.env.APP_URL || "http://localhost:3000").hostname;
  } catch {
    return "localhost";
  }
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Authentication still protects these routes; robots.txt is only a
        // crawl hint and never a security control.
        // /media/ stays disallowed: src/app/media/[...key]/route.ts serves any
        // stored object by its (unguessable) key with no auth and no
        // visibility check, so media belonging to draft/hidden content is
        // served there too. Trade-off: OG images under /media/ may not be
        // fetched by robots-respecting crawlers; the /og-default.png fallback
        // lives in /public and is unaffected.
        disallow: ["/admin", "/admin/", "/api/", "/media/", "/preview", "/preview/"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: robotsHost(),
  };
}
