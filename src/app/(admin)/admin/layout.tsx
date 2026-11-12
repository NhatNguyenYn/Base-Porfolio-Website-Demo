import type { Metadata } from "next";
import "@/app/globals.css";
import { fontVariables } from "@/app/fonts";
import { ThemeScript } from "@/components/site/theme-script";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Quản trị — Portfolio Studio",
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={fontVariables} suppressHydrationWarning>
      <head>
        <ThemeScript defaultTheme="light" />
      </head>
      <body className="min-h-screen bg-background text-ink">{children}</body>
    </html>
  );
}
