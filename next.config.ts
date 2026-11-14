import type { NextConfig } from "next";

// Static-export build for the GitHub Pages demo (workflow `.github/workflows/pages.yml`
// sets PAGES_EXPORT=1). It only changes how the *public* site is emitted:
// `output: "export"` + `basePath` + `trailingSlash` + unoptimized images, and the
// security `headers()` are skipped (Pages serves static files, there is no server
// to attach headers). The full-stack build (Vercel, `PAGES_EXPORT` unset) is
// untouched — same routes, same dynamic rendering, same headers.
const isPagesExport = process.env.PAGES_EXPORT === "1";

// GitHub Pages serves this project site from a subpath.
const basePath = isPagesExport ? "/Base-Porfolio-Website-Demo" : "";

const nextConfig: NextConfig = {
  // Same value as `basePath`, exposed to the client bundle so `assetUrl`
  // (src/lib/asset.ts) prefixes local image URLs in both modes. Without
  // this, `next/image` with `images.unoptimized` renders the stored
  // root-absolute URL verbatim and every demo image 404s.
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  ...(isPagesExport
    ? {
        output: "export",
        // GitHub Pages serves this project site from a subpath.
        basePath,
        trailingSlash: true,
      }
    : {}),
  images: {
    formats: ["image/avif", "image/webp"],
    // Demo artwork ships as SVG placeholders; uploaded artwork is raster.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      // Production storage (S3-compatible) is configured through env.
      ...(process.env.S3_PUBLIC_BASE_URL
        ? [
            {
              protocol: "https" as const,
              hostname: new URL(process.env.S3_PUBLIC_BASE_URL).hostname,
            },
          ]
        : []),
    ],
    // The image-optimization API needs a server; the static demo serves originals.
    ...(isPagesExport ? { unoptimized: true } : {}),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  poweredByHeader: false,
  // Old booking/survey routes redirect to the merged page (2026-11-14).
  // Full-stack only: `output: "export"` does not support redirects, and the
  // static demo stages these routes out instead (see pages.yml).
  ...(isPagesExport
    ? {}
    : {
        async redirects() {
          return [
            // Order matters: /booking/cancel must match before
            // /booking/:serviceSlug, or "cancel" would be treated as a slug.
            // The locale is constrained to vi|en: an open `:locale` would
            // also match /api/booking/slots (locale="api") and break the
            // slots API.
            {
              source: "/:locale(vi|en)/booking/cancel",
              destination: "/:locale/dat-lich-khao-sat/tra-cuu",
              permanent: true,
            },
            {
              source: "/:locale(vi|en)/booking/:serviceSlug",
              destination: "/:locale/dat-lich-khao-sat",
              permanent: true,
            },
            {
              source: "/:locale(vi|en)/booking",
              destination: "/:locale/dat-lich-khao-sat",
              permanent: true,
            },
            {
              source: "/:locale(vi|en)/survey/:slug",
              destination: "/:locale/dat-lich-khao-sat",
              permanent: true,
            },
          ];
        },
      }),
  ...(isPagesExport
    ? {}
    : {
    async headers() {
      const isProduction = process.env.NODE_ENV === "production";
      // includeSubDomains is opt-in: it must not be sent until every subdomain
      // is known to be HTTPS-only. Preload is never set from application code.
      const hsts = ["max-age=63072000"];
      if (process.env.HSTS_INCLUDE_SUBDOMAINS === "true") hsts.push("includeSubDomains");
      return [
        {
          source: "/:path*",
          headers: [
            { key: "X-Content-Type-Options", value: "nosniff" },
            { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
            { key: "X-Frame-Options", value: "SAMEORIGIN" },
            { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
            ...(isProduction
              ? [{ key: "Strict-Transport-Security", value: hsts.join("; ") }]
              : []),
          ],
        },
        {
          // The CMS must never be indexed or embedded.
          source: "/admin/:path*",
          headers: [
            { key: "X-Robots-Tag", value: "noindex, nofollow" },
            { key: "X-Frame-Options", value: "DENY" },
          ],
        },
        {
          source: "/api/admin/:path*",
          headers: [
            { key: "Cache-Control", value: "private, no-store" },
            { key: "X-Robots-Tag", value: "noindex, nofollow" },
          ],
        },
      ];
    },
    }),
};

export default nextConfig;
