// Shared gradient pill badge (Phase 10, 15:14 photo reference).
//
// Spirit of the reference: a pill-shaped badge with a gradient and white
// script/italic text. Colours come from the caller — for surveys, the
// survey's configured badgeFromColor/badgeToColor; for bookings, the flower
// name with the same survey theme colours (Agent E imports this read-only).
// When no colours are given, the badge falls back to the survey theme
// variables (accent → primary), which themselves fall back to the
// portfolio's own palette. No brand colour from the reference photos is
// hardcoded here.
//
// The text is plain text (a survey title or a flower name) rendered in an
// italic serif face — the closest the self-hosted fonts (Lora) get to the
// script lettering in the reference.
import { isValidHexColor } from "./survey-theme";

export function GradientBadge({
  text,
  fromColor,
  toColor,
}: {
  text: string;
  /** Validated hex gradient start; null/undefined/invalid → theme accent. */
  fromColor?: string | null;
  /** Validated hex gradient end; null/undefined/invalid → theme primary. */
  toColor?: string | null;
}) {
  const from = isValidHexColor(fromColor) ? fromColor.trim() : "var(--survey-accent, #9b1c31)";
  const to = isValidHexColor(toColor) ? toColor.trim() : "var(--survey-primary, #17233a)";
  return (
    <span
      className="serif-accent inline-block max-w-full break-words px-7 py-3 text-center text-[1.35rem] leading-snug text-white italic shadow-lg sm:px-9 sm:text-[1.6rem]"
      style={{
        backgroundImage: `linear-gradient(135deg, ${from}, ${to})`,
        borderRadius: "9999px",
      }}
    >
      {text}
    </span>
  );
}
