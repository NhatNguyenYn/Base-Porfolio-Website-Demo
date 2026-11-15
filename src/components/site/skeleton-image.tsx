"use client";

import { useCallback, useState } from "react";
import Image, { type ImageProps } from "next/image";
import { cn } from "@/lib/utils";

/**
 * `next/image` with a skeleton loading frame instead of a blur placeholder.
 *
 * While the image is loading (or errors), the frame shows a soft shimmer
 * (`.skeleton-shimmer` in globals.css) at the image's own size — no layout
 * shift, no blurry preview. Once loaded, the image fades in over the frame.
 *
 * The `onLoad` handler alone is not enough: an image already in the browser
 * cache may finish before React attaches the handler, so the ref callback
 * also checks `complete` on mount.
 *
 * Callers must render this inside a `relative` container (the skeleton is
 * `absolute inset-0`); with `fill` that is already required.
 */
export function SkeletonImage({
  className,
  skeletonClassName,
  ...props
}: Omit<ImageProps, "placeholder" | "blurDataURL" | "onLoad" | "onError"> & {
  skeletonClassName?: string;
}) {
  const [loaded, setLoaded] = useState(false);

  const attach = useCallback((img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalWidth > 0) setLoaded(true);
  }, []);

  return (
    <>
      {!loaded && (
        <span
          aria-hidden="true"
          className={cn("skeleton-shimmer absolute inset-0", skeletonClassName)}
        />
      )}
      <Image
        {...props}
        ref={attach}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={cn(
          "transition-opacity duration-700",
          loaded ? "opacity-100" : "opacity-0",
          className,
        )}
      />
    </>
  );
}
