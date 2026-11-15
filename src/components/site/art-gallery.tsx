"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ArtworkCardData, CollectionData } from "@/data/artworks";
import { GALLERY_PER_PAGE } from "@/data/gallery";
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
  loadingMore: string;
  loadError: string;
  retry: string;
  showingAll: string;
};

type ArtworkPageResponse = {
  success: boolean;
  data: ArtworkCardData[];
  meta?: { total?: number; page?: number; pages?: number };
};

/**
 * One batch from the public artworks API (`GET /api/artworks`). The API
 * paginates at the database, so a batch is cheap even with 117 artworks.
 */
async function fetchArtworkPage(
  locale: Locale,
  options: { collection?: string; page: number; perPage: number },
): Promise<{ items: ArtworkCardData[]; total: number }> {
  const params = new URLSearchParams({
    locale,
    page: String(options.page),
    perPage: String(options.perPage),
  });
  if (options.collection) params.set("collection", options.collection);
  const response = await fetch(`/api/artworks?${params.toString()}`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Artworks request failed: ${response.status}`);
  const body = (await response.json()) as ArtworkPageResponse;
  if (!body.success || !Array.isArray(body.data)) throw new Error("Unexpected artworks response");
  return { items: body.data, total: body.meta?.total ?? body.data.length };
}

/**
 * Gallery with infinite scroll.
 *
 * The server renders only the first batch (`artworks`, `perPage` cards);
 * the rest loads as the visitor scrolls, one batch per IntersectionObserver
 * hit, from the public API. The first paint is real content, fast — never a
 * page of skeleton cards. While more loads, only a small "loading" line
 * appears at the bottom; a failed batch keeps the loaded cards and offers a
 * retry instead of blanking the gallery.
 *
 * Collection filtering is server-side too: switching collections fetches
 * that collection's first batch (the loaded cards stay visible until the
 * new batch arrives). The lightbox pages through the cards loaded so far.
 */
export function ArtGallery({
  artworks,
  collections,
  locale,
  labels,
  total,
  perPage = GALLERY_PER_PAGE,
  collection,
  maxItems,
}: {
  artworks: ArtworkCardData[];
  collections: CollectionData[];
  locale: Locale;
  labels: GalleryLabels;
  /** Visible cards for the initial view (all, or the preset collection). */
  total: number;
  /** Cards per batch, server and client alike. */
  perPage?: number;
  /** When set, the gallery is locked to this collection (collection page). */
  collection?: string;
  /** When set, the gallery never loads past this many cards (homepage preview). */
  maxItems?: number;
}) {
  const [items, setItems] = useState<ArtworkCardData[]>(artworks);
  const [activeCollection, setActiveCollection] = useState<string>(collection ?? "all");
  const [totalForActive, setTotalForActive] = useState<number>(total);
  const [nextPage, setNextPage] = useState(2);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // What the retry button should re-run: the batch that just failed.
  const [failed, setFailed] = useState<{ kind: "more" | "filter"; slug: string; page: number } | null>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // The lightbox is portalled to <body> so no ancestor transform, filter or
  // stacking context can clip it or push it beneath the sticky header.
  useEffect(() => setMounted(true), []);

  const busy = loadingMore || filterLoading;
  // A capped gallery (homepage preview) never loads past its cap, even
  // though more cards exist on the full gallery page.
  const effectiveTotal = Math.min(totalForActive, maxItems ?? Number.POSITIVE_INFINITY);
  const hasMore = items.length < effectiveTotal;

  const loadPage = useCallback(
    async (slug: string, page: number, replace: boolean) => {
      const { items: batch, total: freshTotal } = await fetchArtworkPage(locale, {
        collection: slug === "all" ? undefined : slug,
        page,
        perPage,
      });
      setTotalForActive(freshTotal);
      if (replace) {
        setItems(batch);
        setNextPage(2);
      } else {
        setItems((previous) => {
          const seen = new Set(previous.map((item) => item.id));
          return [...previous, ...batch.filter((item) => !seen.has(item.id))];
        });
        setNextPage((previous) => previous + 1);
      }
    },
    [locale, perPage],
  );

  const loadMore = useCallback(async () => {
    if (loadingMore || filterLoading || !hasMore) return;
    setLoadingMore(true);
    setError(null);
    setFailed(null);
    try {
      await loadPage(activeCollection, nextPage, false);
    } catch {
      setError(labels.loadError);
      setFailed({ kind: "more", slug: activeCollection, page: nextPage });
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, filterLoading, hasMore, loadPage, activeCollection, nextPage, labels.loadError]);

  const changeCollection = useCallback(
    async (slug: string, force = false) => {
      if ((!force && slug === activeCollection) || filterLoading) return;
      setActiveCollection(slug);
      setFilterLoading(true);
      setError(null);
      setFailed(null);
      try {
        await loadPage(slug, 1, true);
      } catch {
        setError(labels.loadError);
        setFailed({ kind: "filter", slug, page: 1 });
      } finally {
        setFilterLoading(false);
      }
    },
    [activeCollection, filterLoading, loadPage, labels.loadError],
  );

  const retry = useCallback(async () => {
    if (!failed) return;
    if (failed.kind === "more") {
      await loadMore();
      return;
    }
    await changeCollection(failed.slug, true);
  }, [failed, loadMore, changeCollection]);

  // Start loading the next batch before the visitor reaches the bottom.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { rootMargin: "600px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  // The lightbox pages through the cards loaded so far.
  const visible = items;

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
        <div className="mb-8 flex flex-wrap items-center gap-2 border-y border-line py-4" aria-busy={filterLoading || undefined}>
          <span className="mr-2 text-[10px] uppercase tracking-[0.16em] text-muted">{labels.collections}</span>
          <button
            type="button"
            onClick={() => void changeCollection("all")}
            className={cn("chip transition-colors", activeCollection === "all" && "chip-active")}
            aria-pressed={activeCollection === "all"}
          >
            {labels.allCollections}
            <span className="tabular-nums opacity-60">{total}</span>
          </button>
          {collections.map((collectionItem) => (
            <button
              key={collectionItem.id}
              type="button"
              onClick={() => void changeCollection(collectionItem.slug)}
              className={cn("chip transition-colors", activeCollection === collectionItem.slug && "chip-active")}
              aria-pressed={activeCollection === collectionItem.slug}
            >
              {collectionItem.name}
              <span className="tabular-nums opacity-60">{collectionItem.count}</span>
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

      {/* Sentinel: the next batch starts loading 600px before it is needed. */}
      <div ref={sentinelRef} aria-hidden="true" className="h-px" />

      <div className="mt-10 text-center text-sm text-muted">
        {busy && (
          <p role="status">
            <span className="skeleton-shimmer mr-2 inline-block h-3 w-3 rounded-full align-[-1px]" aria-hidden="true" />
            {labels.loadingMore}
          </p>
        )}
        {!busy && error && (
          <p role="alert">
            {error}{" "}
            <button type="button" onClick={() => void retry()} className="underline underline-offset-4 hover:text-ink">
              {labels.retry}
            </button>
          </p>
        )}
        {!busy && !error && !hasMore && items.length > 0 && items.length >= totalForActive && totalForActive > perPage && (
          <p>
            {labels.showingAll} · {items.length} {labels.count}
          </p>
        )}
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
