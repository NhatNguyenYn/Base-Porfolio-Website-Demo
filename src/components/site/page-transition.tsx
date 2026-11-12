"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Replays the `.page-enter` fade on every client-side navigation.
 *
 * A route-level `template.tsx` would do the same, but in Next 15.5 it leaves
 * streamed content inside `<div hidden id="S:0">` and blocks hydration on
 * routes that suspend, so the transition lives here instead.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <main id="main" key={pathname} className="page-enter">
      {children}
    </main>
  );
}
