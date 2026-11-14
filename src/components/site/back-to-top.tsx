"use client";

import { useEffect, useState } from "react";

/** Appears after the first viewport; keyboard reachable and reduced-motion aware. */
export function BackToTop({ label }: { label: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // rAF-gated like Parallax: a scroll burst schedules at most one state
    // update per frame instead of one per scroll event.
    let frame = 0;
    const update = () => {
      frame = 0;
      setVisible(window.scrollY > 600);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label={label}
      onClick={() =>
        window.scrollTo({
          top: 0,
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        })
      }
      className="back-to-top fixed bottom-5 right-5 z-40 grid h-10 w-10 place-items-center rounded-full border border-line bg-surface/90 text-ink shadow-soft backdrop-blur transition-colors hover:border-ink sm:bottom-8 sm:right-8"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M12 19V5M6 11l6-6 6 6" />
      </svg>
    </button>
  );
}
