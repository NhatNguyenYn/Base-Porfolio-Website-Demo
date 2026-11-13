"use client";

import { useEffect, useRef } from "react";

/** Decorative progress bar; transform-only and one rAF per scroll burst. */
export function ReadingProgress() {
  const bar = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    let frame = 0;
    let max = 0;

    const update = () => {
      frame = 0;
      const node = bar.current;
      if (!node) return;
      const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      node.style.transform = `scaleX(${progress.toFixed(4)})`;
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    // Measuring scrollHeight forces layout, so it runs only when the document
    // can actually change size — not on every scroll frame.
    const measure = () => {
      max = document.documentElement.scrollHeight - window.innerHeight;
      update();
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    resizeObserver?.observe(document.body);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      resizeObserver?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="reading-progress" aria-hidden="true">
      <span ref={bar} />
    </div>
  );
}
