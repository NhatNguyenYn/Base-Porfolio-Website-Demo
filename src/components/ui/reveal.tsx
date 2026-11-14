"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type RevealVariant = "up" | "fade" | "scale" | "mask";

/**
 * Progressive entrance animation. Content stays readable without JS and the
 * animation is disabled by prefers-reduced-motion in CSS.
 *
 * `delay` is for staggering siblings (70ms steps is the house rhythm); the
 * element is observed once and the observer disconnects after it appears.
 *
 * Above-fold behaviour: `priority` renders visible on the first render (no
 * effect wait) — use it for LCP heroes/covers. Otherwise the observer's
 * initial callback fires immediately for elements already in view, so
 * above-fold content never waits for a scroll event. No
 * getBoundingClientRect() is called on mount: the observer path handles the
 * in-view case without forcing layout for every instance, and the
 * no-IntersectionObserver fallback reveals unconditionally.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  variant = "up",
  as = "div",
  priority = false,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  variant?: RevealVariant;
  as?: "div" | "section" | "li" | "article" | "figure" | "span";
  /** Render visible immediately: use for above-the-fold LCP content. */
  priority?: boolean;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(priority);

  useEffect(() => {
    if (priority) return;
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [priority]);

  const Tag = as as "div";

  return (
    <Tag
      ref={ref as React.RefObject<HTMLDivElement>}
      className={cn("reveal", visible && "is-visible", className)}
      data-variant={variant}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
