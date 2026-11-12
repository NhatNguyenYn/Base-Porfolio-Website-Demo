import type { NextConfig } from "next";

// Static-export build for the GitHub Pages demo (workflow `.github/workflows/pages.yml`
// sets PAGES_EXPORT=1). It only changes how the *public* site is emitted:
// `output: "export"` + `basePath` + `trailingSlash` + unoptimized images, and the
// security `headers()` are skipped (Pages serves static files, there is no server
// to attach headers). The full-stack build (Vercel, `PAGES_EXPORT` unset) is
// untouched — same routes, same dynamic rendering, same headers.
const isPagesExport = process.env.PAGES_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(isPagesExport
    ? {
        output: "export",
        // GitHub Pages serves this project site from a subpath.
        basePath: "/Base-Porfolio-Website-Demo",
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
  ...(isPagesExport
    ? {}
    : {
        async headers() {
          const isProduction = process.env.NODE_ENV === "production";
          return [
            {
              source: "/:path*",
              headers: [
                { key: "X-Content-Type-Options", value: "nosniff" },
                { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                { key: "X-Frame-Options", value: "SAMEORIGIN" },
                { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
                ...(isProduction
                  ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
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
