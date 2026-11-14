import { test, expect } from "@playwright/test";
import { readAdminPassword, ADMIN_EMAIL } from "./helpers";

/**
 * Setup project (see playwright.config.ts): logs in ONCE as the admin and
 * saves the session to /tmp/e2e-evidence/admin-state.json. The spec files
 * reuse that state instead of logging in per test — the login action is
 * rate-limited to 6 attempts / 10 min per account
 * (src/server/actions/auth.ts), so repeated per-test logins would trip it.
 * Runs before every spec file via the `setup` project dependency.
 */
test("admin login succeeds and dashboard loads", async ({ page }) => {
  await page.goto("/admin/login", { waitUntil: "domcontentloaded" });
  await page.fill("#email", ADMIN_EMAIL);
  await page.fill("#password", readAdminPassword());
  await page.getByRole("button", { name: /đăng nhập/i }).click();
  await expect(page).toHaveURL(/\/admin(\?.*)?$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: /tổng quan/i })).toBeVisible();
  // Session cookie was set (Secure cookie over http loopback — see report).
  const cookies = await page.context().cookies();
  expect(
    cookies.some((c) => c.name === "ps_session"),
    "ps_session cookie present",
  ).toBeTruthy();
  await page.context().storageState({ path: "/tmp/e2e-evidence/admin-state.json" });
});
