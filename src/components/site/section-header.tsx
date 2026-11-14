import Link from "next/link";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/ui/reveal";

export function SectionHeader({
  index,
  label,
  title,
  description,
  action,
  className,
  tone = "default",
}: {
  index?: string;
  label: string;
  title: React.ReactNode;
  description?: string;
  action?: { href: string; label: string };
  className?: string;
  tone?: "default" | "inverse";
}) {
  return (
    <Reveal variant="fade">
    <div className={cn("border-t border-line pt-6", className)}>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3">
            {index && (
              <span
                className={cn(
                  "text-[11px] tabular-nums tracking-[0.2em]",
                  tone === "inverse" ? "text-white/50" : "text-muted",
                )}
              >
                {index}
              </span>
            )}
            <span className={cn("label", tone === "inverse" && "text-white/60")}>{label}</span>
          </div>
          <h2
            className={cn(
              "mt-4 text-[clamp(1.75rem,3.4vw,2.85rem)] leading-[1.08] tracking-[-0.03em]",
              tone === "inverse" ? "text-white" : "text-accent",
            )}
          >
            {title}
          </h2>
          {description && (
            <p
              className={cn(
                "mt-4 max-w-xl text-[0.9375rem] leading-relaxed",
                tone === "inverse" ? "text-white/60" : "text-muted",
              )}
            >
              {description}
            </p>
          )}
        </div>
        {action && (
          <Link
            href={action.href}
            className={cn("link-arrow shrink-0", tone === "inverse" ? "text-white" : "text-ink")}
          >
            {action.label}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        )}
      </div>
    </div>
    </Reveal>
  );
}
