"use client";

import { useEffect, useState } from "react";

const THEME_KEY = "ps-theme";

export function ThemeSwitcher({ labels }: { labels: { theme: string; light: string; dark: string } }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "dark" ? "dark" : "light");
    setMounted(true);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    document.documentElement.style.colorScheme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Storage can be unavailable in private mode; the theme still applies.
    }
  }

  const nextLabel = theme === "dark" ? labels.light : labels.dark;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`${labels.theme}: ${nextLabel}`}
      title={`${labels.theme}: ${nextLabel}`}
      className="grid h-9 w-9 place-items-center rounded-full border border-line text-muted transition-colors hover:border-line-strong hover:text-ink"
    >
      <span className="sr-only">{nextLabel}</span>
      {mounted && theme === "dark" ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
