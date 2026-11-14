import { test, expect } from "@playwright/test";
import { db, ADMIN_EMAIL } from "./helpers";

/**
 * Admin auth + CRUD smoke. The serial describe reuses the single login
 * from e2e/admin.setup.ts (storage state) instead of logging in per test:
 * the login action is rate-limited to 6 attempts / 10 min per account.
 * One draft article is created, preview-gated, published (editorial
 * template), verified publicly, then soft-deleted — the DB ends exactly
 * as seeded.
 */
const STATE = "/tmp/e2e-evidence/admin-state.json";

test.describe("admin login failure", () => {
  test("wrong password fails with an alert", async ({ page }) => {
    await page.goto("/admin/login", { waitUntil: "domcontentloaded" });
    await page.fill("#email", ADMIN_EMAIL);
    await page.fill("#password", "definitely-not-the-password-123");
    await page.getByRole("button", { name: /đăng nhập/i }).click();
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});

test.describe.serial("admin auth + article CRUD", () => {
  test.use({ storageState: STATE });

  const slug = `e2e-smoke-editorial-${Date.now()}`;
  const title = "E2E Smoke Editorial";
  let articleId = "";

  test("stored session loads the dashboard", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/admin(\?.*)?$/);
    await expect(
      page.getByRole("heading", { name: /tổng quan/i }),
    ).toBeVisible();
  });

  test("create a draft editorial article", async ({ page }) => {
    await page.goto("/admin/blog/new", { waitUntil: "networkidle" });
    await page.fill("#vi-title", title);
    // The EN panel is hidden until its tab is active (LocaleTabs).
    await page.getByRole("tab", { name: "English" }).click();
    await page.fill("#en-title", `${title} (EN)`);
    await page.getByRole("tab", { name: "Tiếng Việt" }).click();
    await page.fill('textarea[name="vi.content"]', "# E2E smoke\n\nNội dung kiểm thử tự động. Đoạn văn bản đủ dài để render.");
    await page.fill("#slug", slug);
    await page.selectOption("#template", "editorial");
    await page.selectOption("#status", "draft");
    await page.getByRole("button", { name: /lưu bài viết/i }).click();
    // saveArticleAction redirects to /admin/blog/<id>?saved=1
    await expect(page).toHaveURL(/\/admin\/blog\/[^/]+\?saved=1/, { timeout: 15_000 });
    articleId = page.url().match(/\/admin\/blog\/([^?]+)/)![1];

    const row = await db().article.findUnique({ where: { id: articleId } });
    expect(row?.slug).toBe(slug);
    expect(row?.status).toBe("draft");
    expect(row?.template).toBe("editorial");
  });

  test("preview gate: draft is NOT publicly visible without auth", async ({ page }) => {
    const ctx = await page.context().browser()!.newContext();
    const pub = await ctx.newPage();
    const res = await pub.goto(`/vi/blog/${slug}`, { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBe(404);
    await ctx.close();
  });

  test("preview gate: logged-in admin CAN preview the draft", async ({ page }) => {
    const res = await page.goto(`/preview/article/${articleId}`, {
      waitUntil: "domcontentloaded",
    });
    expect(res?.status()).toBe(200);
    await expect(page.locator("main").first()).toContainText(title);
  });

  test("publish the article and verify the editorial template renders publicly", async ({ page }) => {
    await page.goto(`/admin/blog/${articleId}`, { waitUntil: "networkidle" });
    await page.selectOption("#status", "published");
    await page.getByRole("button", { name: /lưu bài viết/i }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/blog/${articleId}\\?saved=1`), {
      timeout: 15_000,
    });

    // Public, logged-out check in a fresh context.
    const ctx = await page.context().browser()!.newContext();
    const pub = await ctx.newPage();
    const res = await pub.goto(`/vi/blog/${slug}`, { waitUntil: "networkidle" });
    expect(res?.status()).toBe(200);
    await expect(pub.locator("main").first()).toContainText(title);
    const html = await pub.content();
    expect(html).toContain("prose-editorial");
    await ctx.close();
  });

  test("delete (soft-delete) the smoke article and confirm it is gone publicly", async ({ page }) => {
    await page.goto("/admin/blog", { waitUntil: "networkidle" });
    const row = page.locator("tr", { hasText: title }).first();
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: /^xoá$/i }).click();
    await page.getByRole("button", { name: /xoá bài viết/i }).click();
    await expect(page).toHaveURL(/\/admin\/blog\?deleted=1/, { timeout: 15_000 });

    const after = await db().article.findUnique({ where: { id: articleId } });
    expect(after?.deletedAt).not.toBeNull();

    const ctx = await page.context().browser()!.newContext();
    const pub = await ctx.newPage();
    const res = await pub.goto(`/vi/blog/${slug}`, { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBe(404);
    await ctx.close();
  });

  test("logout returns to the login page", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/admin(\?.*)?$/);
    await page.getByRole("button", { name: /đăng xuất/i }).click();
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 15_000 });
    // Logged-out admin root redirects to login.
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});

test.describe("preview gate without auth", () => {
  test("logged-out preview URL redirects to login (preview requires a session)", async ({
    page,
  }) => {
    const article = await db().article.findFirst({
      where: { status: "published", deletedAt: null },
      select: { id: true },
    });
    expect(article).not.toBeNull();
    await page.goto(`/preview/article/${article!.id}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
