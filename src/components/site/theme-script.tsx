"use client";

import { useEffect } from "react";
import { assetUrl } from "@/lib/asset";

const THEME_KEY = "ps-theme";

/**
 * Applies the stored theme before paint to avoid a flash of the wrong palette.
 * Falls back to the CMS default theme when the visitor has no preference.
 *
 * The bootstrap itself lives in `public/theme-init.js` (a plain same-origin
 * script, allowed by `script-src 'self'` with no nonce) so this layout —
 * and the ISR pages under it — never need the per-request CSP nonce. It is
 * intentionally a synchronous <script> in <head>: the theme must apply
 * before first paint, and next/script's beforeInteractive warns under the
 * App Router lint rule, so the sync-script rule is disabled here by design.
 */
export function ThemeScript({
  defaultTheme,
}: {
  defaultTheme: "light" | "dark" | "system";
}) {
  return (
    // eslint-disable-next-line @next/next/no-sync-scripts
    <script src={assetUrl("/theme-init.js")} data-default-theme={defaultTheme} />
  );
}

export function useThemeSync() {
  useEffect(() => {
    const root = document.documentElement;
    if (!root.getAttribute("data-theme")) {
      root.setAttribute("data-theme", "light");
    }
  }, []);
}

export { THEME_KEY };
