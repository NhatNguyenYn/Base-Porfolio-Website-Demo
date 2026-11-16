/**
 * Instant navigation feedback for the admin panel.
 *
 * Every protected admin page is force-dynamic and waits on the database
 * before it can render, and without a loading boundary the old page just
 * sits frozen for 1.5–5s after a sidebar click, which reads as a dead
 * click (measured live 16/11: no tab under 1.5s on first click, Bookings
 * 5.6s, and no skeleton appeared at all). This skeleton renders
 * immediately on navigation — and, in Next 15, lets <Link> prefetch
 * dynamic routes up to this boundary, so a hovered or already-visited
 * tab can swap near-instantly.
 *
 * The shape mirrors the admin list pages (PageHeader title + description
 * and a DataTable: header row plus body rows), so it reads as the page
 * arriving rather than a spinner. The sidebar lives in the protected
 * layout above this boundary, so it stays visible while the content
 * area shows the skeleton.
 */
export default function AdminLoading() {
  return (
    <div aria-hidden="true">
      <div className="mb-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full max-w-2xl">
            <span className="skeleton-shimmer block h-8 w-56" />
            <span className="skeleton-shimmer mt-3 block h-4 w-full" />
            <span className="skeleton-shimmer mt-2 block h-4 w-2/3" />
          </div>
          <div className="flex shrink-0 gap-2">
            <span className="skeleton-shimmer inline-block h-8 w-24 rounded-full" />
            <span className="skeleton-shimmer inline-block h-8 w-28 rounded-full" />
          </div>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-3">
        <span className="skeleton-shimmer inline-block h-9 w-36" />
        <span className="skeleton-shimmer inline-block h-9 w-40" />
        <span className="skeleton-shimmer inline-block h-9 w-28" />
      </div>

      <div className="overflow-x-auto border border-line bg-surface">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-surface-muted/60">
              {Array.from({ length: 5 }).map((_, index) => (
                <th key={index} scope="col" className="px-4 py-2.5">
                  <span className="skeleton-shimmer block h-3 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, index) => (
              <tr key={index} className="border-b border-line last:border-b-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="skeleton-shimmer block h-14 w-11 shrink-0" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <span className="skeleton-shimmer block h-3.5 w-2/3" />
                      <span className="skeleton-shimmer block h-3 w-1/3" />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="skeleton-shimmer block h-3.5 w-20" />
                </td>
                <td className="px-4 py-3">
                  <span className="skeleton-shimmer block h-3.5 w-10" />
                </td>
                <td className="px-4 py-3">
                  <span className="skeleton-shimmer block h-5 w-16 rounded-full" />
                </td>
                <td className="px-4 py-3">
                  <span className="skeleton-shimmer ml-auto block h-7 w-16 rounded-full" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
