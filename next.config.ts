import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  poweredByHeader: false,
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
};

export default nextConfig;
