import type { Metadata } from "next";
import { headers } from "next/headers";
import "@/app/globals.css";
import { fontVariables } from "@/app/fonts";
import { ThemeScript } from "@/components/site/theme-script";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Quản trị — Portfolio Studio",
  robots: { index: false, follow: false },
};

export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  // Same per-request nonce the CSP expects; without it the inline theme
  // bootstrap would be blocked once the policy is enforced.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="vi" className={fontVariables} suppressHydrationWarning>
      <head>
        <ThemeScript defaultTheme="light" nonce={nonce} />
      </head>
      <body className="min-h-screen bg-background text-ink">{children}</body>
    </html>
  );
}
