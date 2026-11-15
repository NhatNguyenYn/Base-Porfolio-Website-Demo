/**
 * Instant navigation feedback for the public site.
 *
 * Dynamic pages (blog list, booking, detail pages) wait for the server
 * before they can render, and without a loading boundary the old page just
 * sits frozen for 1–2s, which reads as a dead click. This skeleton renders
 * immediately on navigation — and, in Next 15, lets <Link> prefetch
 * dynamic routes up to this boundary, so a hovered or already-visited
 * link can swap near-instantly. ISR pages (home, art, about, contact)
 * prefetch in full and rarely show this at all.
 *
 * The shape mirrors PageHero (label rule, display title, description,
 * meta row) plus a card grid, so it reads as the page arriving rather
 * than a spinner, on every section page under the locale.
 */
export default function LocaleLoading() {
  return (
    <div aria-hidden="true">
      <section className="container-page pb-12 pt-14 lg:pb-16 lg:pt-20">
        <div className="flex items-center gap-3">
          <span className="h-px w-8 bg-accent" />
          <span className="skeleton-shimmer inline-block h-3 w-24" />
        </div>
        <div className="mt-7 grid gap-8 lg:grid-cols-[1.6fr_1fr] lg:items-end">
          <div className="space-y-3">
            <span className="skeleton-shimmer block h-12 w-3/4 sm:h-16" />
            <span className="skeleton-shimmer block h-12 w-1/2 sm:h-16" />
          </div>
          <div className="max-w-md space-y-3 lg:pb-2">
            <span className="skeleton-shimmer block h-4 w-full" />
            <span className="skeleton-shimmer block h-4 w-5/6" />
            <span className="skeleton-shimmer block h-4 w-2/3" />
          </div>
        </div>
      </section>

      <section className="container-page pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="border border-line bg-surface p-3">
              <span className="skeleton-shimmer block aspect-[4/3] w-full" />
              <span className="skeleton-shimmer mt-4 block h-4 w-2/3" />
              <span className="skeleton-shimmer mt-2 block h-3 w-1/2" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
