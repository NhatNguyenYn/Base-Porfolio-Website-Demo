import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Live fix 4 — CSS guard for the Vietnamese diacritic clipping fix.
 * These are static guards on src/app/globals.css so a later edit cannot
 * silently reintroduce the cut: the numbers they pin are the ones measured
 * with Playwright on the static demo build (see
 * e2e/live-fixes-headings.spec.ts for the browser-side assertions).
 *
 * Measured before the fix (desktop 1280px): `.display` line-height 0.98
 * let the below-baseline ink paint 8.9px (76.8px font) to 11.6px (94.7px
 * font) below the last line box, and `.js .reveal.is-visible` clipped
 * with `clip-path: inset(0 0 0 0)`; the PageHero wrapper bottom coincides
 * with the heading bottom, so dots under ậ/ạ were cut to slivers.
 */
const css = fs.readFileSync(
  path.resolve(__dirname, "..", "src", "app", "globals.css"),
  "utf8",
);

function ruleBlock(selector: string, marker?: string): string {
  // First occurrence of `selector { ... }` whose body contains `marker`
  // (needed because `.js .reveal.is-visible` also appears in the
  // prefers-reduced-motion block, with `clip-path: none !important`).
  let from = 0;
  for (;;) {
    const start = css.indexOf(selector, from);
    expect(start, `rule ${selector} exists`).toBeGreaterThanOrEqual(0);
    const open = css.indexOf("{", start);
    const close = css.indexOf("}", open);
    const body = css.slice(open + 1, close);
    if (!marker || body.includes(marker)) return body;
    from = close + 1;
  }
}

describe("live fix 4 — diacritic clearance in globals.css", () => {
  it("display headings keep descender padding inside their own box", () => {
    const block = ruleBlock(".display {");
    expect(block).toMatch(/line-height:\s*0\.98/);
    const m = block.match(/padding-bottom:\s*([\d.]+)em/);
    expect(m, ".display needs padding-bottom in em").not.toBeNull();
    // Worst measured overflow was ~0.125em below the line box.
    expect(Number(m![1])).toBeGreaterThanOrEqual(0.14);
  });

  it("editorial titles keep the same descender padding", () => {
    const block = ruleBlock(".editorial-title {");
    const m = block.match(/padding-bottom:\s*([\d.]+)em/);
    expect(m, ".editorial-title needs padding-bottom in em").not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(0.12);
  });

  it("visible reveals do not clip — except the image-only mask variant", () => {
    const block = ruleBlock(".js .reveal.is-visible {", "will-change: auto");
    expect(block, "is-visible must not set clip-path").not.toMatch(/clip-path/);
    const mask = ruleBlock('.js .reveal[data-variant="mask"].is-visible {');
    expect(mask).toMatch(/clip-path:\s*inset\(0 0 0 0\)/);
    // The mask pre-state still wipes the image open.
    const maskStart = ruleBlock('.js .reveal[data-variant="mask"] {');
    expect(maskStart).toMatch(/clip-path:\s*inset\(0 0 100% 0\)/);
  });

  it("the underline sweep sits an em-based gap below the text", () => {
    const block = ruleBlock(".underline-sweep::after {");
    // bottom:-2px left only 1.0-1.8px over the lowest ink; -0.3em keeps >= ~3px.
    expect(block).toMatch(/bottom:\s*-0\.3em/);
  });

  it("line 1 still imports the font stylesheet first", () => {
    const first = css.split("\n")[0].trim();
    expect(first).toBe('@import "./fonts.css";');
  });
});
