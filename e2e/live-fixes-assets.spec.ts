import { test, expect } from "@playwright/test";

/**
 * Live-fixes: base-path assets + language switcher (errors 1 + 2).
 *
 * Runs against the STATIC Pages export served under its subpath, e.g.:
 *
 *   E2E_BASE_URL=http://127.0.0.1:4181/Base-Porfolio-Website-Demo \
 *     npx playwright test e2e/live-fixes-assets.spec.ts --project=e2e --no-deps
 *
 * (The repo config's `setup` project logs into /admin, which does not exist
 * in the static export, so this spec must run with `--no-deps`.)
 *
 * Slugs below are the deterministic demo-seed slugs (prisma/seed.ts).
 */
const SUBPATH = "/Base-Porfolio-Website-Demo";
const BASE = process.env.E2E_BASE_URL || `http://127.0.0.1:4187${SUBPATH}`;

/** Every <img> on the page must resolve: prefixed local src + real pixels. */
async function expectImagesLoaded(page: any, label: string) {
  const count = await page.evaluate(() => document.images.length);
  expect(count, `${label}: page has at least one <img>`).toBeGreaterThan(0);
  // next/image lazy-loads below-fold images, and a fast stepped window
  // scroll does NOT reliably trigger Chrome's lazy-load for the deepest
  // images (observed: the last card's image never even requested). Bring
  // each image into view and wait for it to finish instead — a broken src
  // also completes, with naturalWidth 0, so this cannot mask a real 404.
  const handles = await page.$$("img");
  for (const img of handles) {
    await img.scrollIntoViewIfNeeded();
    await page
      .waitForFunction((el: HTMLImageElement) => el.complete, img, { timeout: 15_000 })
      .catch(() => {});
  }
  const bad = await page.evaluate(() =>
    Array.from(document.images).map((img) => ({
      src: img.getAttribute("src") || "",
      ok: img.complete && img.naturalWidth > 0,
    })),
  );
  for (const img of bad) {
    expect(img.src.startsWith(SUBPATH) || img.src.startsWith("http"), `${label}: img src has basePath: ${img.src}`).toBeTruthy();
    expect(img.ok, `${label}: img loads with naturalWidth > 0: ${img.src}`).toBeTruthy();
  }
  return bad.length;
}

test.describe("export under subpath: images carry the basePath", () => {
  for (const path of ["/vi", "/vi/blog", "/vi/projects", "/vi/art"]) {
    test(`images load on ${path}`, async ({ page }) => {
      const res = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      expect(res?.status(), `${path} status`).toBe(200);
      const count = await expectImagesLoaded(page, path);
      expect(count).toBeGreaterThan(0);
    });
  }

  for (const path of [
    "/vi/blog/design-systems-start-before-components",
    "/vi/projects/signal-api",
    "/vi/art/after-the-rain",
  ]) {
    test(`cover image loads on ${path}`, async ({ page }) => {
      const res = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      expect(res?.status(), `${path} status`).toBe(200);
      await expectImagesLoaded(page, path);
    });
  }
});

test.describe("export under subpath: language switcher", () => {
  test("switcher links carry the basePath and EN navigation lands on /en/", async ({ page }) => {
    await page.goto(`${BASE}/vi`, { waitUntil: "domcontentloaded" });
    const hrefs = await page.evaluate(() => {
      const group = document.querySelector('[aria-label="Ngôn ngữ"], [aria-label="Language"]');
      const links = Array.from((group ?? document).querySelectorAll("a[hrefLang]"));
      return links.map((a) => (a as HTMLAnchorElement).getAttribute("href") || "");
    });
    expect(hrefs.length, "switcher has VI + EN links").toBeGreaterThanOrEqual(2);
    for (const href of hrefs) {
      expect(href.startsWith(`${SUBPATH}/`), `switcher href has basePath: ${href}`).toBeTruthy();
    }
    // No bare /en or /vi link anywhere on the page.
    const bare = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a[href]"));
      return links
        .map((a) => (a as HTMLAnchorElement).getAttribute("href") || "")
        .filter((href) => href === "/en" || href === "/vi" || href.startsWith("/en/") || href.startsWith("/vi/"));
    });
    expect(bare, "no bare /vi or /en hrefs").toEqual([]);

    await page.getByRole("link", { name: "EN", exact: true }).first().click();
    await expect(page).toHaveURL(/\/en(\/|$)/);
    await expect(page.locator("main").first()).toBeVisible();
  });
});

test.describe("export under subpath: canonical / OG URLs", () => {
  test("home canonical and og:url contain the subpath", async ({ page }) => {
    const res = await page.goto(`${BASE}/vi`, { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBe(200);
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical).toContain(SUBPATH);
    expect(canonical).toMatch(/\/vi\/$/);
    const ogUrl = await page.locator('meta[property="og:url"]').getAttribute("content");
    expect(ogUrl).toContain(SUBPATH);
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(ogImage).toContain(SUBPATH);
  });
});

test.describe("export under subpath: blog detail category chip + sitemap", () => {
  test("detail category chip links to the prerendered category page, not ?category=", async ({
    page,
  }) => {
    const res = await page.goto(`${BASE}/vi/blog/design-systems-start-before-components`, {
      waitUntil: "domcontentloaded",
    });
    expect(res?.status()).toBe(200);
    const href = await page
      .locator('header a[href*="/blog/category/"]')
      .first()
      .getAttribute("href");
    expect(href).toBe(`${SUBPATH}/vi/blog/category/software-engineering/`);
    // Tag chips intentionally keep ?tag= (no /blog/tag/[slug]/ route exists).
    const tagHref = await page.locator('a[href*="?tag="]').first().getAttribute("href");
    expect(tagHref).toContain("?tag=");
  });

  test("sitemap lists the projects/category pages with the subpath", async ({ request }) => {
    const res = await request.get(`${BASE}/sitemap.xml`);
    expect(res.status()).toBe(200);
    const xml = await res.text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const projectCats = locs.filter((url) => url.includes("/projects/category/"));
    expect(projectCats).toHaveLength(6); // 3 categories x 2 locales
    for (const url of projectCats) {
      expect(url.startsWith(`https://nhatnguyenyn.github.io${SUBPATH}/`)).toBeTruthy();
    }
    expect(locs.some((url) => url.includes("/blog/category/"))).toBeTruthy();
  });
});
