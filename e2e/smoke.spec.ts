import { test, expect } from "@playwright/test";
import { db, SEED } from "./helpers";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";

/** Read the live HTML of a URL (same origin) for SEO assertions. */
async function liveHtml(request: any, url: string) {
  const res = await request.get(url);
  expect(res.status(), `${url} status`).toBe(200);
  return { status: res.status(), html: await res.text(), headers: res.headers() };
}

test.describe("public pages render (vi + en)", () => {
  const pages: Array<{ path: string; marker: string }> = [
    { path: "/vi", marker: "" },
    { path: "/vi/about", marker: "" },
    { path: "/vi/projects", marker: "" },
    { path: `/vi/projects/${SEED.project}`, marker: "" },
    { path: "/vi/art", marker: "" },
    { path: `/vi/art/${SEED.artwork}`, marker: "" },
    { path: `/vi/art/collections/${SEED.collection}`, marker: "" },
    { path: "/vi/blog", marker: "" },
    { path: `/vi/blog/${SEED.articleDefault}`, marker: "" },
    { path: `/vi/blog/category/${SEED.category}`, marker: "" },
    { path: "/vi/contact", marker: "" },
  ];

  for (const { path } of pages) {
    test(`GET ${path} renders 200 with <main> content`, async ({ page }) => {
      const res = await page.goto(path, { waitUntil: "networkidle" });
      expect(res?.status(), `${path} status`).toBe(200);
      await expect(page.locator("main").first()).toBeVisible();
      // No Next.js error overlay / crash text.
      await expect(page.locator("text=Application error")).toHaveCount(0);
      await expect(page.locator("text=Something went wrong")).toHaveCount(0);
    });
  }

  test("en locale renders the same set of pages", async ({ page }) => {
    for (const p of ["/en", "/en/about", "/en/projects", "/en/blog", "/en/contact"]) {
      const res = await page.goto(p, { waitUntil: "domcontentloaded" });
      expect(res?.status(), `${p} status`).toBe(200);
      await expect(page.locator("main").first()).toBeVisible();
    }
  });

  test("root / redirects to /vi", async ({ page }) => {
    const res = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(page.url()).toBe(`${BASE}/vi`);
    expect(res?.status()).toBe(200);
  });

  test("bare /blog/<slug> redirects to the localized URL", async ({ page }) => {
    await page.goto(`/blog/${SEED.articleDefault}`, { waitUntil: "domcontentloaded" });
    expect(page.url()).toBe(`${BASE}/vi/blog/${SEED.articleDefault}`);
  });
});

test.describe("locale switcher", () => {
  test("vi -> en keeps the same page", async ({ page }) => {
    await page.goto("/vi/about", { waitUntil: "domcontentloaded" });
    const enLink = page.locator('a[hrefLang="en"]').first();
    await expect(enLink).toBeVisible();
    await expect(enLink).toHaveAttribute("href", "/en/about");
    await enLink.click();
    await expect(page).toHaveURL(`${BASE}/en/about`);
    await expect(page.locator("main").first()).toBeVisible();
  });

  test("en -> vi keeps the same page", async ({ page }) => {
    await page.goto("/en/projects", { waitUntil: "domcontentloaded" });
    const viLink = page.locator('a[hrefLang="vi"]').first();
    await expect(viLink).toHaveAttribute("href", "/vi/projects");
    await viLink.click();
    await expect(page).toHaveURL(`${BASE}/vi/projects`);
  });
});

test.describe("sitemap + robots", () => {
  test("sitemap.xml is valid XML and lists public URLs", async ({ request }) => {
    const { html } = await liveHtml(request, "/sitemap.xml");
    expect(html).toContain("<urlset");
    expect(html).toContain(`/vi/blog/${SEED.articleDefault}`);
    expect(html).toContain(`/vi/projects/${SEED.project}`);
    expect(html).not.toContain("/admin");
  });

  test("robots.txt allows public crawling and references the sitemap", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const txt = await res.text();
    expect(txt).toContain("User-Agent:");
    expect(txt).toContain("Sitemap:");
    expect(txt).toContain("sitemap.xml");
  });
});

test.describe("SEO spot-checks in live HTML", () => {
  test("home has title, canonical, hreflang, JSON-LD", async ({ request }) => {
    const { html } = await liveHtml(request, "/vi");
    expect(html).toMatch(/<title>[^<]+<\/title>/);
    expect(html).toContain('rel="canonical"');
    expect(html).toContain('hrefLang="vi"');
    expect(html).toContain('hrefLang="en"');
    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain("http://127.0.0.1:3000/vi");
  });

  test("article page has title, canonical, hreflang, JSON-LD", async ({ request }) => {
    const { html } = await liveHtml(request, `/vi/blog/${SEED.articleDefault}`);
    expect(html).toMatch(/<title>[^<]+<\/title>/);
    expect(html).toContain('rel="canonical"');
    expect(html).toContain(`blog/${SEED.articleDefault}`);
    expect(html).toContain('hrefLang="vi"');
    expect(html).toContain('hrefLang="en"');
    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain("BlogPosting");
  });

  test("project page has title, canonical, hreflang, JSON-LD", async ({ request }) => {
    const { html } = await liveHtml(request, `/vi/projects/${SEED.project}`);
    expect(html).toMatch(/<title>[^<]+<\/title>/);
    expect(html).toContain('rel="canonical"');
    expect(html).toContain('hrefLang="vi"');
    expect(html).toContain('type="application/ld+json"');
  });

  test("editorial template article (if one is seeded) renders editorial markup", async ({ request }) => {
    const editorial = await db().article.findFirst({
      where: { template: "editorial", status: "published", deletedAt: null },
      select: { slug: true },
    });
    test.skip(!editorial, "no published editorial-template article in the seeded DB");
    const { html } = await liveHtml(request, `/vi/blog/${editorial!.slug}`);
    // Editorial template renders the prose-editorial body (see blog/[slug]/page.tsx).
    expect(html).toContain("prose-editorial");
  });
});

test.describe("contact form", () => {
  test("submits and stores the message in the DB (no SMTP configured)", async ({ page }) => {
    const stamp = Date.now();
    const email = `e2e-smoke-${stamp}@example.com`;
    const before = await db().contactMessage.count({ where: { email } });

    await page.goto("/vi/contact", { waitUntil: "networkidle" });
    await page.fill("#contact-name", "E2E Smoke Test");
    await page.fill("#contact-email", email);
    await page.fill("#contact-subject", "E2E smoke test message");
    await page.fill("#contact-message", "This is an automated E2E smoke-test message. Please ignore.");
    // Server action rejects submissions <1.8s after page render (bot timing
    // check in src/server/actions/contact.ts), so wait before submitting.
    await page.waitForTimeout(2600);
    await page.getByRole("button", { name: /gửi/i }).click();
    await expect(
      page.locator("text=Cảm ơn bạn! Tin nhắn đã được lưu lại"),
    ).toBeVisible({ timeout: 15_000 });

    const after = await db().contactMessage.count({ where: { email } });
    expect(after - before).toBe(1);
    // Cleanup: remove the smoke-test message so the DB stays as seeded.
    await db().contactMessage.deleteMany({ where: { email } });
  });
});

test.describe("404 page", () => {
  test("bogus localized URL renders the 404 page with status 404", async ({ page }) => {
    const res = await page.goto("/vi/this-page-does-not-exist-xyz", {
      waitUntil: "domcontentloaded",
    });
    expect(res?.status()).toBe(404);
    await expect(page.locator("main").first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  test("bogus article slug renders 404", async ({ page }) => {
    const res = await page.goto("/vi/blog/no-such-article-xyz", {
      waitUntil: "domcontentloaded",
    });
    expect(res?.status()).toBe(404);
  });
});
