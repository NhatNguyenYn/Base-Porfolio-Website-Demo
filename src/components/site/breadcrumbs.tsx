import Link from "next/link";
import { cn } from "@/lib/utils";

export type Crumb = { name: string; href: string };

/**
 * Visible breadcrumb trail. The matching BreadcrumbList JSON-LD is built from
 * the same array, so the visible path and structured data cannot disagree.
 */
export function Breadcrumbs({
  items,
  label,
  className,
}: {
  items: Crumb[];
  label: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("text-[11px] text-muted", className)}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.href}-${index}`} className="flex min-w-0 items-center gap-2">
              {last ? (
                <span aria-current="page" className="truncate text-ink">
                  {item.name}
                </span>
              ) : (
                <Link href={item.href} className="transition-colors hover:text-ink">
                  {item.name}
                </Link>
              )}
              {!last && (
                <span aria-hidden="true" className="text-line-strong">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
