"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { ArtworkCardData, CollectionData } from "@/data/artworks";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";
import { ArtworkCard } from "./artwork-card";

// The lightbox dialog (image viewer, keyboard nav, focus trap) loads only
// when a visitor opens an artwork, so the gallery's initial bundle stays
// light. `ssr: false` keeps the chunk out of the server render entirely:
// the dialog only ever mounts client-side, after a click.
const ArtLightbox = dynamic(() => import("./art-lightbox").then((mod) => mod.ArtLightbox), {
  ssr: false,
});

export type GalleryLabels = {
  allWorks: string;
  allCollections: string;
  collections: string;
  viewFullscreen: string;
  close: string;
  next: string;
  previous: string;
  details: string;
  medium: string;
  created: string;
  collection: string;
  category: string;
  viewArtwork: string;
  imageAlt: string;
  count: string;
};

export function ArtGallery({
  artworks,
  collections,
  locale,
  labels,
}: {
  artworks: ArtworkCardData[];
  collections: CollectionData[];
  locale: Locale;
  labels: GalleryLabels;
}) {
  const [activeCollection, setActiveCollection] = useState<string>("all");
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  // The lightbox is portalled to <body> so no ancestor transform, filter or
  // stacking context can clip it or push it beneath the sticky header.
  useEffect(() => setMounted(true), []);

  const visible = useMemo(
    () => (activeCollection === "all" ? artworks : artworks.filter((item) => item.collectionSlug === activeCollection)),
    [artworks, activeCollection],
  );

  const close = useCallback(() => setOpenIndex(null), []);
  const step = useCallback(
    (direction: 1 | -1) => {
      setOpenIndex((current) => {
        if (current === null || visible.length === 0) return current;
        return (current + direction + visible.length) % visible.length;
      });
    },
    [visible.length],
  );

  const open = openIndex !== null ? visible[openIndex] ?? null : null;

  return (
    <div>
      {collections.length > 0 && (
        <div className="mb-8 flex flex-wrap items-center gap-2 border-y border-line py-4">
          <span className="mr-2 text-[10px] uppercase tracking-[0.16em] text-muted">{labels.collections}</span>
          <button
            type="button"
            onClick={() => setActiveCollection("all")}
            className={cn("chip transition-colors", activeCollection === "all" && "chip-active")}
            aria-pressed={activeCollection === "all"}
          >
            {labels.allCollections}
            <span className="tabular-nums opacity-60">{artworks.length}</span>
          </button>
          {collections.map((collection) => (
            <button
              key={collection.id}
              type="button"
              onClick={() => setActiveCollection(collection.slug)}
              className={cn("chip transition-colors", activeCollection === collection.slug && "chip-active")}
              aria-pressed={activeCollection === collection.slug}
            >
              {collection.name}
              <span className="tabular-nums opacity-60">{collection.count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="columns-1 gap-5 sm:columns-2 xl:columns-3">
        {visible.map((artwork, index) => (
          <ArtworkCard
            key={artwork.id}
            artwork={artwork}
            label={labels.viewFullscreen}
            onOpen={() => setOpenIndex(index)}
          />
        ))}
      </div>

      {open && mounted && createPortal(
        <ArtLightbox
          artwork={open}
          index={openIndex ?? 0}
          total={visible.length}
          locale={locale}
          labels={labels}
          onClose={close}
          onStep={step}
        />,
        document.body,
      )}
    </div>
  );
}
