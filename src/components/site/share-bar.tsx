"use client";

import { useEffect, useState } from "react";

export function ShareBar({
  title,
  labels,
}: {
  title: string;
  labels: { share: string; copy: string; copied: string };
}) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(window.location.href);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url || window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] uppercase tracking-[0.16em] text-muted">{labels.share}</span>
      <button
        type="button"
        onClick={copy}
        className="chip transition-colors hover:border-ink hover:text-ink"
        aria-live="polite"
      >
        {copied ? labels.copied : labels.copy}
      </button>
      <a
        href={`https://x.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="grid h-7 w-7 place-items-center rounded-full border border-line text-muted transition-colors hover:border-ink hover:text-ink"
        aria-label="X"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.3 3h3.2l-7 8 7.3 10h-5.7l-4.5-6.2L5.4 21H2.2l7.5-8.6L2.7 3H8.5l4.1 5.7zM16.1 19h1.8L7.9 4.9H6z" />
        </svg>
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="grid h-7 w-7 place-items-center rounded-full border border-line text-muted transition-colors hover:border-ink hover:text-ink"
        aria-label="Facebook"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M14.5 21v-7.2h2.6l.4-3h-3V8.9c0-.87.25-1.46 1.5-1.46h1.6V4.72c-.28-.04-1.23-.12-2.34-.12-2.32 0-3.9 1.4-3.9 3.98v2.22H8.5v3h2.86V21z" />
        </svg>
      </a>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="grid h-7 w-7 place-items-center rounded-full border border-line text-muted transition-colors hover:border-ink hover:text-ink"
        aria-label="LinkedIn"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.5h4V21H3zM9.5 9.5H13v1.6c.55-1 1.75-1.9 3.5-1.9 2.7 0 4 1.8 4 4.9V21h-4v-6.2c0-1.5-.55-2.4-1.8-2.4-1.1 0-1.75.75-2 1.5-.1.25-.12.6-.12 1V21h-4z" />
        </svg>
      </a>
    </div>
  );
}
