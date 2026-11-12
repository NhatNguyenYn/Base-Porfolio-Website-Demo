import Link from "next/link";

export function Pagination({
  page,
  pages,
  basePath,
  params,
  labels,
}: {
  page: number;
  pages: number;
  basePath: string;
  params: Record<string, string | undefined>;
  labels: { previous: string; next: string; page: string; of: string };
}) {
  if (pages <= 1) return null;

  const href = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "page") search.set(key, value);
    }
    if (target > 1) search.set("page", String(target));
    const query = search.toString();
    return `${basePath}${query ? `?${query}` : ""}`;
  };

  const numbers = Array.from({ length: pages }, (_, index) => index + 1).filter(
    (value) => value === 1 || value === pages || Math.abs(value - page) <= 1,
  );

  return (
    <nav className="mt-14 flex items-center justify-between border-t border-line pt-6" aria-label="Pagination">
      <div className="flex items-center gap-3">
        {page > 1 ? (
          <Link href={href(page - 1)} className="link-arrow text-muted hover:text-ink">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M19 12H5M11 6l-6 6 6 6" />
            </svg>
            {labels.previous}
          </Link>
        ) : (
          <span className="text-sm text-muted/50">{labels.previous}</span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {numbers.map((value, index) => {
          const previous = numbers[index - 1];
          const gap = previous && value - previous > 1;
          return (
            <span key={value} className="flex items-center gap-1.5">
              {gap && <span className="px-1 text-xs text-muted">…</span>}
              <Link
                href={href(value)}
                aria-current={value === page ? "page" : undefined}
                className={`grid h-8 min-w-8 place-items-center rounded-full px-2 text-xs tabular-nums transition-colors ${
                  value === page ? "bg-primary text-primary-fg" : "text-muted hover:text-ink"
                }`}
              >
                {value}
              </Link>
            </span>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        {page < pages ? (
          <Link href={href(page + 1)} className="link-arrow text-muted hover:text-ink">
            {labels.next}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        ) : (
          <span className="text-sm text-muted/50">{labels.next}</span>
        )}
      </div>
    </nav>
  );
}
