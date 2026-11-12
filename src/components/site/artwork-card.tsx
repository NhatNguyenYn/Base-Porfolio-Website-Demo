"use client";

import Image from "next/image";
import type { ArtworkCardData } from "@/data/artworks";
import { cn } from "@/lib/utils";

/**
 * A single artwork plate. Clicking opens the lightbox, which lives in the
 * gallery client component so it can handle keyboard navigation.
 */
export function ArtworkCard({
  artwork,
  onOpen,
  label,
  priority = false,
}: {
  artwork: ArtworkCardData;
  onOpen: () => void;
  label: string;
  priority?: boolean;
}) {
  const width = artwork.image?.width ?? 1200;
  const height = artwork.image?.height ?? 1500;

  return (
    <figure className="group mb-5 break-inside-avoid">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${label}: ${artwork.title}`}
        className="relative block w-full overflow-hidden border border-line bg-surface-muted text-left"
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        {artwork.image ? (
          <Image
            src={artwork.image.url}
            alt={artwork.image.alt || artwork.title}
            fill
            priority={priority}
            sizes="(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 92vw"
            className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center">
            <span className="serif-accent text-2xl text-muted">{artwork.title}</span>
          </span>
        )}

        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 flex translate-y-2 items-end justify-between gap-3 p-4 text-white opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
          <span>
            <span className="block text-[10px] uppercase tracking-[0.16em] text-white/70">
              {artwork.collectionName || artwork.categoryName}
            </span>
            <span className="mt-1 block text-sm font-medium tracking-tight">{artwork.title}</span>
          </span>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/40">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" />
            </svg>
          </span>
        </span>
      </button>

      <figcaption className={cn("flex items-baseline justify-between gap-3 pt-2.5")}>
        <span className="text-[13px] tracking-tight">{artwork.title}</span>
        <span className="text-[10px] tabular-nums tracking-[0.1em] text-muted">
          {artwork.medium || artwork.categoryName}
        </span>
      </figcaption>
    </figure>
  );
}
