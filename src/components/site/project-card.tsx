import Image from "next/image";
import Link from "next/link";
import type { ProjectCardData } from "@/data/projects";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/i18n";

export function ProjectCard({
  project,
  href,
  dict,
  index,
  size = "default",
  priority = false,
}: {
  project: ProjectCardData;
  href: string;
  dict: Dictionary;
  index?: number;
  size?: "default" | "large";
  priority?: boolean;
}) {
  const isLarge = size === "large";

  return (
    <article className="group flex h-full flex-col">
      <Link href={href} className="block">
        <div
          className={cn(
            "relative overflow-hidden bg-surface-muted border border-line",
            isLarge ? "aspect-[16/10]" : "aspect-[4/3]",
          )}
        >
          {project.thumbnail ? (
            <Image
              src={project.thumbnail.url}
              alt={project.thumbnail.alt || project.name}
              fill
              priority={priority}
              sizes={isLarge ? "(min-width: 1024px) 60vw, 100vw" : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"}
              className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.035]"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-surface-muted">
              <span className="label">{project.name.slice(0, 2)}</span>
            </div>
          )}
          {project.featured && (
            <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[9px] uppercase tracking-[0.16em] text-ink backdrop-blur">
              {dict.common.featured}
            </span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col pt-5">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className={cn("tracking-tight", isLarge ? "text-2xl lg:text-[1.75rem]" : "text-lg")}>
            <Link href={href} className="underline-sweep">
              {project.name}
            </Link>
          </h3>
          {typeof index === "number" && (
            <span className="text-[10px] tabular-nums tracking-[0.18em] text-muted">
              {String(index + 1).padStart(2, "0")}
            </span>
          )}
        </div>

        <p className={cn("mt-2 text-sm leading-relaxed text-muted", isLarge ? "max-w-xl" : "")}>
          {project.shortDescription}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted">
          {project.role && (
            <span>
              {dict.common.role}: <span className="text-ink">{project.role}</span>
            </span>
          )}
          {project.year && <span className="tabular-nums">{project.year}</span>}
        </div>

        {project.technologies.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {project.technologies.slice(0, 5).map((tech) => (
              <span key={tech} className="chip">
                {tech}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto pt-5">
          <Link href={href} className="link-arrow text-muted group-hover:text-ink">
            {dict.common.viewProject}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
      </div>
    </article>
  );
}
