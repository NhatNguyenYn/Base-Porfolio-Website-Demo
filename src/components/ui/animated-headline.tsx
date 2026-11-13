import { cn } from "@/lib/utils";

/**
 * Splits a headline into words and lets CSS animate them in sequence. The
 * markup is fully server-rendered, so the text is present without JavaScript;
 * `prefers-reduced-motion` removes the animation entirely.
 */
export function AnimatedHeadline({
  text,
  className,
  as: Tag = "h1",
  step = 65,
}: {
  text: string;
  className?: string;
  as?: "h1" | "h2";
  step?: number;
}) {
  const words = text.split(/\s+/).filter(Boolean);

  return (
    <Tag className={className} aria-label={text}>
      {words.map((word, index) => (
        <span key={`${word}-${index}`} aria-hidden="true">
          <span className="headline-word" style={{ animationDelay: `${index * step}ms` }}>
            {word}
          </span>
          {index < words.length - 1 ? " " : null}
        </span>
      ))}
    </Tag>
  );
}
