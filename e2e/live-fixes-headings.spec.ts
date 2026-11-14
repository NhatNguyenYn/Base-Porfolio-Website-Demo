import { test, expect } from "@playwright/test";

/**
 * Live fix 4 — Vietnamese diacritics below the baseline (dot below in
 * ệ/ộ/ậ, descenders g/y) were sheared off at the bottom edge of large
 * headings.
 *
 * Root cause (measured 2026-11-14 on the static demo build, desktop 1280px):
 * `.display` uses line-height 0.98, so the ink paints 8.9px (at 76.8px
 * font) to 11.6px (at 94.7px) below the last line box, and every visible
 * `.reveal` wrapper applied `clip-path: inset(0 0 0 0)`. On PageHero pages
 * the wrapper's bottom edge coincides exactly with the heading's bottom
 * edge (grid items-end, description shorter than the title), so the dots
 * under ậ/ạ were cut to slivers (screenshots in the fix report).
 *
 * Fix (src/app/globals.css only): descender padding on `.display` /
 * `.editorial-title`, clip-path removed from `.reveal.is-visible` except
 * for the image-only `mask` variant, and the underline sweep moved to
 * `bottom: -0.3em`.
 *
 * Public pages only — no auth. Runs against `E2E_BASE_URL` (full-stack
 * server or the static demo served under its base path).
 */

const PAGES = [
  { path: "/vi/", label: "home", h1: "Tên Của Bạn" },
  { path: "/vi/blog/", label: "blog-list", h1: "Ghi chép" },
  { path: "/vi/contact/", label: "contact", h1: "Hãy kể tôi nghe" },
  { path: "/vi/blog/category/technology/", label: "category", h1: "Công nghệ" },
  {
    path: "/vi/blog/design-systems-start-before-components/",
    label: "article",
    h1: "Hệ thống thiết kế",
  },
] as const;

// Leading-slash paths resolve against the baseURL *origin*, which drops a
// static-demo base path (e.g. /Base-Porfolio-Website-Demo). Prefix it back
// when running against the demo: E2E_BASE_PATH=/Base-Porfolio-Website-Demo.
// Against the full-stack server (baseURL http://127.0.0.1:3000) it is empty.
const BASE_PATH = process.env.E2E_BASE_PATH || "";
const u = (p: string) => `${BASE_PATH}${p}`;

async function headingMetrics(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const h1 = document.querySelector("h1");
    if (!h1) return null;
    // Nearest clipping ancestor (clip-path or overflow hidden/clip).
    const clippers: { cls: string; clipPath: string; bottom: number }[] = [];
    let anc = h1.parentElement;
    while (anc && anc !== document.body) {
      const cs = getComputedStyle(anc);
      const clips =
        (cs.clipPath && cs.clipPath !== "none") ||
        cs.overflow === "hidden" ||
        cs.overflow === "clip" ||
        cs.overflowX === "hidden" ||
        cs.overflowX === "clip" ||
        cs.overflowY === "hidden" ||
        cs.overflowY === "clip";
      if (clips) {
        clippers.push({
          cls: String(anc.className).slice(0, 60),
          clipPath: cs.clipPath,
          bottom: anc.getBoundingClientRect().bottom,
        });
      }
      anc = anc.parentElement;
    }
    // Lowest ink of the heading text (canvas, whole string = conservative).
    const cs = getComputedStyle(h1);
    const cv = document.createElement("canvas");
    const ctx = cv.getContext("2d")!;
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const probe = ctx.measureText("Hg");
    const m = ctx.measureText(h1.textContent || "");
    // Last line box bottom via ranges.
    let lastLineBottom = 0;
    const walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (!node.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) {
        lastLineBottom = Math.max(lastLineBottom, r.bottom);
      }
      range.detach();
    }
    const inkBottom = lastLineBottom - probe.fontBoundingBoxDescent + m.actualBoundingBoxDescent;
    return {
      text: h1.textContent,
      clientHeight: h1.clientHeight,
      scrollHeight: h1.scrollHeight,
      overflowPx: h1.scrollHeight - h1.clientHeight,
      clippers,
      h1Bottom: h1.getBoundingClientRect().bottom,
      inkBottom,
    };
  });
}

async function navUnderlineClearance(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const out: { text: string; active: boolean; clearance: number }[] = [];
    for (const a of document.querySelectorAll("header nav a")) {
      const cs = getComputedStyle(a);
      const r = a.getBoundingClientRect();
      if (r.width === 0) continue;
      const cv = document.createElement("canvas");
      const ctx = cv.getContext("2d")!;
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const probe = ctx.measureText("Hg");
      const m = ctx.measureText(a.textContent || "");
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
      const half = (lh - (probe.fontBoundingBoxAscent + probe.fontBoundingBoxDescent)) / 2;
      const inkBottom = r.top + half + probe.fontBoundingBoxAscent + m.actualBoundingBoxDescent;
      // ::after bottom resolves to px in computed style (e.g. -3.9px for
      // -0.3em at 13px); it is negative, so subtract it, then the 1px height.
      const afterBottom = parseFloat(getComputedStyle(a, "::after").bottom) || 0;
      const underlineTop = r.bottom - afterBottom - 1; // height: 1px
      out.push({
        text: (a.textContent || "").trim(),
        active: a.getAttribute("data-active") === "true",
        clearance: Math.round((underlineTop - inkBottom) * 10) / 10,
      });
    }
    return out;
  });
}

test.describe("live fix 4 — headings keep their Vietnamese diacritics", () => {
  for (const vp of [
    { width: 1280, height: 900, name: "desktop" },
    { width: 390, height: 844, name: "mobile390" },
  ]) {
    test.describe(`${vp.name} ${vp.width}px`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      for (const p of PAGES) {
        test(`${p.label}: h1 is not clipped`, async ({ page }) => {
          await page.goto(u(p.path), { waitUntil: "networkidle" });
          // Reveal entrance lasts 700ms; wait for it to settle.
          await page.waitForTimeout(1200);
          await expect(page.locator("h1").first()).toContainText(p.h1);
          const m = await headingMetrics(page);
          expect(m, "h1 present").not.toBeNull();
          // The heading's own box contains its ink: the dots below the
          // baseline no longer overflow the element (was 5-13px before).
          expect(m!.overflowPx, `${p.label} h1 scrollHeight-clientHeight`).toBeLessThanOrEqual(2);
          // No clipping ancestor may end above the lowest ink.
          for (const c of m!.clippers) {
            expect(
              c.bottom,
              `${p.label} clipper ${c.cls} ends below the ink (${m!.inkBottom})`,
            ).toBeGreaterThanOrEqual(m!.inkBottom - 2);
          }
        });

        test(`${p.label}: no horizontal overflow at ${vp.width}px`, async ({ page }) => {
          await page.goto(u(p.path), { waitUntil: "networkidle" });
          await page.waitForTimeout(1200);
          const overflowX = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
          }));
          expect(overflowX.scrollWidth, `${p.label} scrollWidth == innerWidth`).toBe(
            overflowX.innerWidth,
          );
        });
      }

      test("nav underline clears the descenders", async ({ page }) => {
        test.skip(vp.width < 1024, "desktop nav is hidden below lg");
        await page.goto(u("/vi/blog/"), { waitUntil: "networkidle" });
        await page.waitForTimeout(1200);
        const links = await navUnderlineClearance(page);
        expect(links.length).toBeGreaterThan(0);
        for (const link of links) {
          // Was 1.0-1.8px before the fix; the sweep now sits 0.3em below.
          expect(link.clearance, `underline clearance for "${link.text}"`).toBeGreaterThanOrEqual(3);
        }
      });

      test("mask reveals wrap images only, never headings", async ({ page }) => {
        await page.goto(u("/vi/"), { waitUntil: "networkidle" });
        await page.waitForTimeout(1200);
        const maskedHeadings = await page.evaluate(
          () => document.querySelectorAll('.reveal[data-variant="mask"] h1, .reveal[data-variant="mask"] h2').length,
        );
        expect(maskedHeadings).toBe(0);
      });
    });
  }
});
