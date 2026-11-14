import { test, expect } from "@playwright/test";

/**
 * Category-filter fix — static-export E2E.
 *
 * RUN AGAINST THE STATIC EXPORT ONLY (PAGES_EXPORT=1 build served from
 * out/, e.g. E2E_BASE_URL=http://127.0.0.1:4181/Base-Porfolio-Website-Demo).
 * Run with --no-deps: the default "setup" project logs into the admin, which
 * does not exist on a static export.
 *   npx playwright test e2e/live-fixes-filter.spec.ts --project=e2e --no-deps
 *
 * Regression: on the export the category chips linked to `?category=slug`,
 * which only changed the URL — the prerendered list HTML stayed unfiltered.
 * The chips now link to the prerendered /category/<slug>/ pages.
 *
 * Chips are located with `a.chip` (not getByRole link by name) because the
 * breadcrumb also links the current category by the same name.
 *
 * Seed data (prisma/seed.ts): 4 projects — product = Aurora Design System +
 * Lantern Notes, platform = Harbor Analytics, experiment = Signal API;
 * 5 articles, one per category — software-engineering =
 * "Hệ thống thiết kế không bắt đầu từ component".
 */
const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";

test.describe("category filter on the static export", () => {
  test("projects: chip 'Sản phẩm' goes to the category page with only product projects", async ({ page }) => {
    await page.goto(`${BASE}/vi/projects/`, { waitUntil: "networkidle" });
    const chip = page.locator("a.chip", { hasText: "Sản phẩm" }).first();
    await expect(chip).toBeVisible();
    await expect(chip).toHaveAttribute("href", /\/vi\/projects\/category\/product\/?$/);

    await chip.click();
    await expect(page).toHaveURL(/\/vi\/projects\/category\/product\/?$/);
    await expect(page.getByRole("link", { name: /Aurora Design System/ }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Lantern Notes/ }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Harbor Analytics/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Signal API/ })).toHaveCount(0);
    // The active chip is the product one; the count shows the filtered total.
    await expect(page.locator("a.chip", { hasText: "Sản phẩm" }).first()).toHaveClass(/chip-active/);
    await expect(page.locator("main")).toContainText("02");
  });

  test("projects: chip 'Mọi loại dự án' returns to the full list", async ({ page }) => {
    await page.goto(`${BASE}/vi/projects/category/product/`, { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: /Harbor Analytics/ })).toHaveCount(0);

    await page.locator("a.chip", { hasText: "Mọi loại dự án" }).first().click();
    await expect(page).toHaveURL(/\/vi\/projects\/?$/);
    await expect(page.getByRole("link", { name: /Aurora Design System/ }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Harbor Analytics/ }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Signal API/ }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Lantern Notes/ }).first()).toBeVisible();
  });

  test("blog: chip 'Kỹ thuật phần mềm' goes to the category page with only that article", async ({ page }) => {
    await page.goto(`${BASE}/vi/blog/`, { waitUntil: "networkidle" });
    const chip = page.locator("a.chip", { hasText: "Kỹ thuật phần mềm" }).first();
    await expect(chip).toBeVisible();
    await expect(chip).toHaveAttribute("href", /\/vi\/blog\/category\/software-engineering\/?$/);

    await chip.click();
    await expect(page).toHaveURL(/\/vi\/blog\/category\/software-engineering\/?$/);
    await expect(
      page.getByRole("link", { name: /Hệ thống thiết kế không bắt đầu từ component/ }).first(),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /AI không thay thế kỹ sư/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Một ngày làm việc sâu/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Màu sắc như một quyết định kỹ thuật/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Viết để nghĩ/ })).toHaveCount(0);
    await expect(page.locator("a.chip", { hasText: "Kỹ thuật phần mềm" }).first()).toHaveClass(/chip-active/);
  });

  test("blog: chip 'Mọi danh mục' returns to the full list", async ({ page }) => {
    await page.goto(`${BASE}/vi/blog/category/software-engineering/`, { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: /AI không thay thế kỹ sư/ })).toHaveCount(0);

    await page.locator("a.chip", { hasText: "Mọi danh mục" }).first().click();
    await expect(page).toHaveURL(/\/vi\/blog\/?$/);
    await expect(
      page.getByRole("link", { name: /Hệ thống thiết kế không bắt đầu từ component/ }).first(),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /AI không thay thế kỹ sư/ }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Một ngày làm việc sâu/ }).first()).toBeVisible();
  });

  test("projects category page works in EN too", async ({ page }) => {
    const res = await page.goto(`${BASE}/en/projects/category/product/`, { waitUntil: "networkidle" });
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("link", { name: /Aurora Design System/ }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Lantern Notes/ }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Harbor Analytics/ })).toHaveCount(0);
    await expect(page.locator("a.chip", { hasText: "Product" }).first()).toHaveClass(/chip-active/);
  });
});
