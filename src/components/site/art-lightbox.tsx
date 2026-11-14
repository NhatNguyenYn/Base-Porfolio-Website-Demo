"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import type { ArtworkCardData } from "@/data/artworks";
import type { Locale } from "@/i18n/config";
import { localeHref } from "@/i18n/config";
import { formatDate } from "@/lib/utils";
import { useFocusTrap } from "@/lib/focus-trap";

/**
 * Lightbox dialog, split out of ArtGallery so it loads on demand
 * (next/dynamic) instead of in the gallery's initial bundle. The grid stays
 * light; this chunk is fetched only when a visitor opens an artwork.
 *
 * Focus is trapped inside while open (Tab cycles, Escape closes) and returns
 * to the artwork button that opened it when it closes.
 */
export function ArtLightbox({
  artwork: open,
  index,
  total,
  locale,
  labels,
  onClose,
  onStep,
}: {
  artwork: ArtworkCardData;
  index: number;
  total: number;
  locale: Locale;
  labels: {
    viewFullscreen: string;
    close: string;
    next: string;
    previous: string;
    viewArtwork: string;
  };
  onClose: () => void;
  onStep: (direction: 1 | -1) => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap(dialogRef, true, { onEscape: onClose });

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") onStep(1);
      if (event.key === "ArrowLeft") onStep(-1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onStep]);

  async function enterFullscreen() {
    const node = dialogRef.current;
    if (!node) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await node.requestFullscreen();
      }
    } catch {
      // Fullscreen is optional; the lightbox already fills the viewport.
    }
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={open.title}
      tabIndex={-1}
      className="fixed inset-0 z-[100] flex flex-col bg-[#0a0c10]/97 text-white outline-none backdrop-blur-sm"
    >
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium tracking-tight">{open.title}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-white/50">
            {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={enterFullscreen}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/20 text-white/70 transition-colors hover:border-white/60 hover:text-white"
            aria-label={labels.viewFullscreen}
            title={labels.viewFullscreen}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/20 text-white/70 transition-colors hover:border-white/60 hover:text-white"
            aria-label={labels.close}
            title={labels.close}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M5 5l14 14M19 5 5 19" />
            </svg>
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 py-3 sm:px-10">
        {open.image ? (
          <div className="relative h-full w-full">
            <Image
              src={open.image.url}
              alt={open.image.alt || open.title}
              fill
              sizes="100vw"
              priority
              className="object-contain"
            />
          </div>
        ) : (
          <p className="serif-accent text-3xl">{open.title}</p>
        )}

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => onStep(-1)}
              aria-label={labels.previous}
              className="absolute left-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/30 text-white/80 transition-colors hover:border-white/60 hover:text-white sm:left-4"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => onStep(1)}
              aria-label={labels.next}
              className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/30 text-white/80 transition-colors hover:border-white/60 hover:text-white sm:right-4"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>

      <div className="border-t border-white/10 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[10px] uppercase tracking-[0.14em] text-white/50">
              {open.collectionName && <span>{open.collectionName}</span>}
              {open.medium && <span>{open.medium}</span>}
              {open.createdDate && <span>{formatDate(open.createdDate, locale)}</span>}
            </div>
            {open.description && (
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-white/70">{open.description}</p>
            )}
          </div>
          <Link
            href={`${localeHref(locale, "/art")}/${open.slug}`}
            className="btn btn-sm shrink-0 border border-white/25 text-white hover:border-white/70"
          >
            {labels.viewArtwork}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M7 17 17 7M9 7h8v8" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
