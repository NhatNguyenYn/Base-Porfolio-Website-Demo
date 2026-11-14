import { test, expect } from "@playwright/test";
import { SEED } from "./helpers";

/**
 * Responsive smoke: home + one detail page at every viewport in the task
 * list. The pass/fail criterion is real horizontal page overflow
 * (documentElement.scrollWidth > innerWidth). Elements whose bounding rect
 * extends past the viewport but are visually clipped by an overflow-hidden
 * ancestor (e.g. the hero's decorative blur circle) do NOT cause page
 * scroll and are reported as annotations, not failures.
 */
const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 375, height: 667 },
] as const;

const PAGES = ["/vi", `/vi/projects/${SEED.project}`] as const;

async function unclippedOffenders(page: any): Promise<string[]> {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const bad: string[] = [];
    const isClipped = (el: Element): boolean => {
      let p = el.parentElement;
      while (p) {
        const cs = getComputedStyle(p);
        if (cs.overflowX === "hidden" || cs.overflowX === "clip" || cs.overflow === "hidden") {
          return true;
        }
        p = p.parentElement;
      }
      return false;
    };
    document.querySelectorAll("body *").forEach((el) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width > 0 && r.right > vw + 1 && !isClipped(el)) {
        const tag = el.tagName.toLowerCase();
        const cls = (el.getAttribute("class") || "").split(" ").slice(0, 2).join(".");
        const id = el.getAttribute("id");
        bad.push(`${tag}${id ? `#${id}` : ""}${cls ? `.${cls}` : ""} (right=${Math.round(r.right)} > vw=${vw})`);
      }
    });
    return [...new Set(bad)].slice(0, 10);
  });
}

async function clippedOffenders(page: any): Promise<string[]> {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const bad: string[] = [];
    const isClipped = (el: Element): boolean => {
      let p = el.parentElement;
      while (p) {
        const cs = getComputedStyle(p);
        if (cs.overflowX === "hidden" || cs.overflowX === "clip" || cs.overflow === "hidden") {
          return true;
        }
        p = p.parentElement;
      }
      return false;
    };
    document.querySelectorAll("body *").forEach((el) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width > 0 && r.right > vw + 1 && isClipped(el)) {
        const tag = el.tagName.toLowerCase();
        const cls = (el.getAttribute("class") || "").split(" ").slice(0, 2).join(".");
        bad.push(`${tag}${cls ? `.${cls}` : ""} (right=${Math.round(r.right)} > vw=${vw}, clipped)`);
      }
    });
    return [...new Set(bad)].slice(0, 5);
  });
}

for (const vp of VIEWPORTS) {
  for (const path of PAGES) {
    test(`viewport ${vp.width}x${vp.height}: ${path} has no horizontal overflow`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const res = await page.goto(path, { waitUntil: "networkidle" });
      expect(res?.status()).toBe(200);
      await expect(page.locator("main").first()).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(
        overflow,
        `horizontal overflow ${overflow}px at ${vp.width}px on ${path}`,
      ).toBeLessThanOrEqual(0);
      const offenders = await unclippedOffenders(page);
      expect(offenders, `unclipped elements wider than viewport at ${vp.width}px on ${path}`).toEqual([]);
      const clipped = await clippedOffenders(page);
      if (clipped.length > 0) {
        testInfo.annotations.push({
          type: "clipped-overflow (not a page-scroll bug)",
          description: clipped.join("; "),
        });
      }
      if (vp.width === 390 && path === "/vi") {
        await page.screenshot({ path: "/tmp/e2e-evidence/viewport-390-home.png" });
      }
    });
  }
}
