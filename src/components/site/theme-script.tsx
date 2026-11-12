"use client";

import { useEffect } from "react";

const THEME_KEY = "ps-theme";

/**
 * Applies the stored theme before paint to avoid a flash of the wrong palette.
 * Falls back to the CMS default theme when the visitor has no preference.
 */
export function ThemeScript({ defaultTheme }: { defaultTheme: "light" | "dark" | "system" }) {
  const script = `
(function() {
  document.documentElement.classList.add("js");
  try {
    var stored = localStorage.getItem("${THEME_KEY}");
    var preference = stored || "${defaultTheme}";
    var systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme = preference === "system" ? (systemDark ? "dark" : "light") : preference;
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
  } catch (error) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
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
