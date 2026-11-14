// E2E: admin schedule import (Phase 11, Worker C — D8).
//
// Admin (reused storage-state login from e2e/admin.setup.ts, a SUPER_ADMIN)
// pastes valid JSON -> preview shows the right counts -> confirms -> the
// new import appears in history and its detail page lists the items;
// pasting invalid JSON shows an inline error and writes nothing; creating
// a connection shows the token exactly once, and revoking disables it.
//
// HOW TO RUN (production build, like Phase 10 — never dev mode):
//   1. Start the local Postgres + engine mirror if down (see phase-11-audit.md §1).
//   2. DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/portfolio?schema=public' \
//        npx prisma migrate deploy   # local scratch DB only, never production
//   3. DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/portfolio?schema=public' \
//        node e2e/temp-admin.mjs create
//   4. DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/portfolio?schema=public' \
//        npm run build && (npm run start &)
//   5. DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/portfolio?schema=public' \
//        E2E_ADMIN_EMAIL=e2e-admin@example.com \
//        E2E_ADMIN_PASSWORD_FILE=/home/hatch/.e2e-admin-pw \
//        npx playwright test --config e2e/playwright.config.ts e2e/schedule-import.spec.ts
//      (--config is REQUIRED: without it Playwright uses its default config,
//      baseURL is unset and every relative goto fails with
//      "Cannot navigate to invalid URL". If port 3000 is taken by another
//      worker's dev server, start production on another port and pass
//      E2E_BASE_URL=http://127.0.0.1:<port>.)
//   6. node e2e/temp-admin.mjs delete   (same DATABASE_URL)
// Fixtures use a unique E2E-SI-<run> prefix and are deleted afterwards;
// the dev DB ends as seeded. The revoked-connection check asserts the DB
// row (isActive false) and the UI status — the API-side 403 for the revoked
// token belongs to Worker F's e2e/schedule-import-api.spec.ts.
import { test, expect, type Page } from "@playwright/test";
import { db } from "./helpers";

const STATE = "/tmp/e2e-evidence/admin-state.json";
const RUN = Date.now().toString(36);
const PREFIX = `E2E-SI-${RUN}`;
const CONNECTION_NAME = `E2E-conn-${RUN}`;

/** VN calendar date (YYYY-MM-DD) N days from now. */
function vnDatePlusDays(days: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(Date.now() + days * 24 * 60 * 60 * 1000));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function validJson(): string {
  return JSON.stringify({
    type: "schedule_import",
    version: "1.0",
    source: "admin-manual",
    generatedAt: new Date().toISOString(),
    schedules: [
      {
        id: `${PREFIX}-001`,
        title: "Tư vấn E2E 1",
        date: vnDatePlusDays(7),
        start: "09:00",
        end: "10:00",
        status: "confirmed",
        location: "Phòng E2E",
      },
      {
        id: `${PREFIX}-002`,
        title: "Tư vấn E2E 2",
        date: vnDatePlusDays(8),
        start: "14:00",
        end: "14:30",
        status: "scheduled",
      },
    ],
  });
}

/**
 * Wait until React has hydrated `selector` (SSR HTML has no handlers, so a
 * click or fill that lands before hydration is silently lost — including
 * controlled-input fills, which hydration then resets to ""). See
 * e2e/booking.spec.ts for the same helper.
 */
async function waitForHydration(page: Page, selector: string): Promise<void> {
  await page
    .waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        return !!el && Object.keys(el).some((k) => k.startsWith("__react"));
      },
      selector,
      { timeout: 15_000 },
    )
    .catch(() => undefined);
}

let importIds: string[] = [];

async function cleanupE2EFixtures() {
  // Only rows this spec created (unique RUN prefix / exact connection name /
  // recorded import ids) — never another run's or a human's data.
  await db().scheduleImportItem.deleteMany({ where: { externalId: { startsWith: PREFIX } } });
  if (importIds.length > 0) {
    await db().scheduleImport.deleteMany({ where: { id: { in: importIds } } });
  }
  await db().importedSchedule.deleteMany({ where: { externalId: { startsWith: PREFIX } } });
  await db().integrationConnection.deleteMany({ where: { name: CONNECTION_NAME } });
}

test.describe.serial("admin schedule import (paste -> preview -> confirm -> history)", () => {
  test.use({ storageState: STATE });

  let importId = "";

  test.beforeAll(async () => {
    await cleanupE2EFixtures();
  });

  test.afterAll(async () => {
    await cleanupE2EFixtures();
    await db().$disconnect();
  });

  test("valid JSON previews correct counts, confirms, and shows in history + detail", async ({ page }) => {
    await page.goto("/admin/schedule-import", { waitUntil: "domcontentloaded" });
    await waitForHydration(page, "#schedule-import-json");
    await page.locator("#schedule-import-json").fill(validJson());
    await page.getByRole("button", { name: "Xem trước", exact: true }).click();
    await expect(page.getByTestId("preview-count-created")).toHaveText("2", { timeout: 15_000 });
    await expect(page.getByTestId("preview-count-total")).toHaveText("2");
    await expect(page.locator("body")).toContainText(`${PREFIX}-001`);
    await expect(page.locator("body")).toContainText("Tư vấn E2E 1");

    await page.getByRole("button", { name: "Xác nhận nhập", exact: true }).click();
    await expect(page.locator("body")).toContainText("Đã nhập lịch", { timeout: 15_000 });
    await expect(page.getByTestId("preview-count-created")).toHaveText("2");

    // History on the same page lists the new import; its detail lists items.
    await expect(page.locator("body")).toContainText("admin-manual", { timeout: 10_000 });
    await page.getByRole("link", { name: "Xem chi tiết lần nhập" }).click();
    await expect(page).toHaveURL(/\/admin\/schedule-import\/history\/[^/]+$/, { timeout: 10_000 });
    importId = page.url().match(/\/history\/([^/?]+)/)?.[1] ?? "";
    expect(importId).not.toBe("");
    importIds.push(importId);
    await expect(page.locator("body")).toContainText(`${PREFIX}-001`);
    await expect(page.locator("body")).toContainText(`${PREFIX}-002`);
    await expect(page.locator("body")).toContainText("Mới");

    const record = await db().scheduleImport.findUniqueOrThrow({ where: { id: importId } });
    expect(record.source).toBe("admin-manual");
    expect(record.status).toBe("completed");
    expect(record.createdCount).toBe(2);
    expect(record.totalRecords).toBe(2);
  });

  test("malformed JSON shows an inline error and writes nothing", async ({ page }) => {
    const before = await db().scheduleImport.count();
    await page.goto("/admin/schedule-import", { waitUntil: "domcontentloaded" });
    await waitForHydration(page, "#schedule-import-json");
    await page.locator("#schedule-import-json").fill("{not json");
    await page.getByRole("button", { name: "Xem trước", exact: true }).click();
    await expect(page.getByTestId("schedule-import-error")).toContainText("JSON không hợp lệ", { timeout: 10_000 });
    expect(await db().scheduleImport.count()).toBe(before);
    expect(
      await db().importedSchedule.count({ where: { externalId: { startsWith: PREFIX } } }),
    ).toBe(2); // only the two rows from the previous test, no new ones
  });

  test("duplicate ids in one payload show an inline error and write nothing", async ({ page }) => {
    const before = await db().scheduleImport.count();
    await page.goto("/admin/schedule-import", { waitUntil: "domcontentloaded" });
    await waitForHydration(page, "#schedule-import-json");
    const duplicate = JSON.parse(validJson()) as { schedules: Record<string, unknown>[] };
    duplicate.schedules.push({ ...duplicate.schedules[0] });
    await page.locator("#schedule-import-json").fill(JSON.stringify(duplicate));
    await page.getByRole("button", { name: "Xem trước", exact: true }).click();
    await expect(page.getByTestId("schedule-import-error")).toContainText(`${PREFIX}-001`, { timeout: 10_000 });
    expect(await db().scheduleImport.count()).toBe(before);
  });

  test("SUPER_ADMIN creates a connection (token once), then revokes it", async ({ page }) => {
    await page.goto("/admin/schedule-import", { waitUntil: "domcontentloaded" });
    await waitForHydration(page, "#connection-name");
    await page.locator("#connection-name").fill(CONNECTION_NAME);
    await page.getByRole("button", { name: "Tạo kết nối", exact: true }).click();
    const alert = page.getByTestId("connection-token-alert");
    await expect(alert).toBeVisible({ timeout: 15_000 });
    const token = (await page.getByTestId("connection-token").innerText()).trim();
    expect(token).toMatch(/^imp_[0-9a-f]{32}$/);
    await expect(alert).toContainText("chỉ hiện một lần");

    // Dismissing the alert removes the token from the page for good.
    await page.getByRole("button", { name: "Đã lưu xong", exact: true }).click();
    await expect(page.getByTestId("connection-token-alert")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(token);

    const connection = await db().integrationConnection.findFirstOrThrow({ where: { name: CONNECTION_NAME } });
    expect(connection.isActive).toBe(true);

    // Two-step revoke: "Thu hồi" reveals the confirm, "Xác nhận" applies it.
    await page.getByRole("button", { name: "Thu hồi", exact: true }).click();
    await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
    await expect(page.locator("body")).toContainText("Đã thu hồi", { timeout: 10_000 });
    expect(
      (await db().integrationConnection.findUniqueOrThrow({ where: { id: connection.id } })).isActive,
    ).toBe(false);
  });
});
