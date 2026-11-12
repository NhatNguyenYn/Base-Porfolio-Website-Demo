import type { ReactNode } from "react";
import "@/app/globals.css";
import { fontVariables } from "@/app/fonts";

export const metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function PreviewLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={fontVariables}>
      <body className="min-h-screen bg-background text-ink">{children}</body>
    </html>
  );
}
