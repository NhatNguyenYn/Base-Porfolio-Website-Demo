"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Very small scroll-linked offset (max `strength` pixels). One passive
 * listener, one rAF frame at most per scroll burst, transform-only so it never
 * triggers layout. Disabled for reduced motion and when the element is off
 * screen work would be wasted. The reduced-motion preference is watched live:
 * toggling it in the OS while the page is open enables/disables the effect
 * without a reload.
 */
export function Parallax({
  children,
  className,
  strength = 12,
}: {
  children: React.ReactNode;
  className?: string;
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");

    let frame = 0;
    let enabled = !media.matches;

    const update = () => {
      frame = 0;
      if (!enabled) return;
      const rect = node.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      const offset = (rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight;
      const shift = Math.max(-strength, Math.min(strength, -offset * strength));
      node.style.transform = `translate3d(0, ${shift.toFixed(2)}px, 0)`;
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    const applyPreference = () => {
      enabled = !media.matches;
      if (enabled) {
        update();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll, { passive: true });
      } else {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
        if (frame) {
          window.cancelAnimationFrame(frame);
          frame = 0;
        }
        node.style.transform = "";
      }
    };

    applyPreference();
    media.addEventListener("change", applyPreference);

    return () => {
      media.removeEventListener("change", applyPreference);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      node.style.transform = "";
    };
  }, [strength]);

  return (
    <div ref={ref} className={cn("will-change-transform", className)}>
      {children}
    </div>
  );
}
