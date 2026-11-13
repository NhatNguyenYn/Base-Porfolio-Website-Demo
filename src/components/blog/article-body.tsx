import { cn } from "@/lib/utils";
import type { ArticleTemplate } from "@/lib/article-template";

/** Shared article body: the template only changes presentation, never content. */
export function ArticleBody({
  html,
  template,
  className,
}: {
  html: string;
  template: ArticleTemplate;
  className?: string;
}) {
  return (
    <div
      className={cn("prose-editorial", template === "editorial" && "prose-editorial--editorial", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
