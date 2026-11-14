// E2E: booking flow (Phase 10, Agent G).
//
// Admin (reused storage-state login) creates a service + slot in the UI; a
// visitor books with contact + the intake survey, sees the BK- reference
// code + flower badge; the public calendar then shows only the flower;
// admin confirms; the visitor cancels with code + email; the slot is free
// again with no flower shown. The intake survey is seeded via Prisma.
// Fixtures are cleaned up afterwards; the dev DB ends as seeded.
import { test, expect, type Browser, type Page } from "@playwright/test";
import { db } from "./helpers";
import { flowerNameFor } from "../src/lib/flowers";

const STATE = "/tmp/e2e-evidence/admin-state.json";
const RUN = Date.now().toString(36);
const SERVICE_SLUG = `tu-van-e2e-${RUN}`;
const SERVICE_NAME = "Tư vấn E2E";
const VISITOR_NAME = "Nguyễn Văn E2E";
const VISITOR_EMAIL = `e2e-visitor-${RUN}@example.com`;
const VISITOR_PHONE = "0901234567";
const BK_RE = /BK-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}/;

function futureDate(daysAhead: number): string {
  const d = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

/** Ordered cleanup: intake responses first (their answers reference
 * questions with onDelete Restrict), then bookings, services, surveys. */
async function cleanupE2EBookingFixtures() {
  const intake = await db().survey.findMany({
    where: { slug: { startsWith: "e2e-intake-" } },
    select: { id: true },
  });
  const intakeIds = intake.map((row) => row.id);
  if (intakeIds.length > 0) {
    await db().surveyResponse.deleteMany({ where: { surveyId: { in: intakeIds } } });
  }
  await db().booking.deleteMany({ where: { email: { startsWith: "e2e-visitor-" } } });
  await db().bookingService.deleteMany({ where: { slug: { startsWith: "tu-van-e2e-" } } });
  if (intakeIds.length > 0) {
    await db().survey.deleteMany({ where: { id: { in: intakeIds } } });
  }
}

/**
 * Click a button and wait for the UI it reveals. In `next dev` the route's
 * JS compiles lazily, so a click that lands before hydration does nothing
 * (SSR HTML has no handlers yet); retry until the expected element appears.
 */
/**
 * Wait until React has hydrated `selector` (SSR HTML has no handlers, so a
 * click or fill that lands before hydration is silently lost — including
 * controlled-input fills, which hydration then resets to ""). React attaches
 * `__reactFiber$`/`__reactProps$` keys to DOM nodes on commit; before that
 * the key is absent. If the selector never hydrates (server-only markup),
 * fall through after a short timeout and let the retry helpers cover it.
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

async function clickUntilVisible(
  page: Page,
  name: string | RegExp,
  selector: string,
): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt++) {
    // Idempotence first: the reveal may already be showing (e.g. a toggle
    // button must not be clicked twice).
    try {
      await page.locator(selector).first().waitFor({ state: "visible", timeout: 2000 });
      return;
    } catch {
      // Not revealed yet — click below.
    }
    await page
      .getByRole("button", { name })
      .click({ timeout: 10_000 })
      .catch(() => undefined);
    try {
      await page.locator(selector).first().waitFor({ state: "visible", timeout: 5000 });
      return;
    } catch {
      // Not hydrated yet (or the reveal is slow) — click again.
    }
  }
  throw new Error(`button ${String(name)} did not reveal ${selector}`);
}

// Distinct visitor identities (see e2e/survey.spec.ts): the booking endpoint
// rate-limits at 5 creates / 10 min per client IP.
let anonIpCounter = 0;
async function anonContext(browser: Browser) {
  anonIpCounter += 1;
  return browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": `203.0.113.${150 + anonIpCounter}` },
  });
}

test.describe.serial("booking flow (admin UI → visitor → admin → cancel)", () => {
  test.use({ storageState: STATE });

  let intakeSurveyId = "";
  let serviceId = "";
  let referenceCode = "";
  let flowerName = "";
  // Services deactivated for this suite (restored in afterAll).
  let deactivatedServiceIds: string[] = [];

  test.beforeAll(async () => {
    await cleanupE2EBookingFixtures();
    // The merged page /vi/dat-lich-khao-sat shows the FIRST active service,
    // so the E2E service must be the only active one while this suite runs.
    // Deactivate the others (e.g. the seeded demo service) and restore them
    // afterwards; the dev DB ends as seeded.
    const others = await db().bookingService.findMany({
      where: { active: true },
      select: { id: true },
    });
    deactivatedServiceIds = others.map((row) => row.id);
    if (deactivatedServiceIds.length > 0) {
      await db().bookingService.updateMany({
        where: { id: { in: deactivatedServiceIds } },
        data: { active: false },
      });
    }
    const survey = await db().survey.create({
      data: {
        slug: `e2e-intake-${RUN}`,
        status: "published",
        publishedAt: new Date(Date.now() - 60_000),
        themePreset: "minimal",
        isBookingIntake: true,
        translations: {
          create: [
            {
              locale: "vi",
              title: "Khảo sát đầu vào E2E",
              subtitle: "",
              description: "",
              introduction: "",
              completionMessage: "",
              privacyNotice: "",
            },
            {
              locale: "en",
              title: "E2E intake survey",
              subtitle: "",
              description: "",
              introduction: "",
              completionMessage: "",
              privacyNotice: "",
            },
          ],
        },
        questions: {
          create: {
            type: "short_text",
            order: 0,
            required: true,
            translations: {
              create: [
                { locale: "vi", title: "Bạn muốn trao đổi về vấn đề gì?", description: "", placeholder: "" },
                { locale: "en", title: "What would you like to discuss?", description: "", placeholder: "" },
              ],
            },
          },
        },
      },
      select: { id: true },
    });
    intakeSurveyId = survey.id;
  });

  test.afterAll(async () => {
    await cleanupE2EBookingFixtures();
    if (deactivatedServiceIds.length > 0) {
      await db().bookingService.updateMany({
        where: { id: { in: deactivatedServiceIds } },
        data: { active: true },
      });
    }
    await db().$disconnect();
  });

  test("admin creates a service with the intake survey, then a slot", async ({ page }) => {
    await page.goto("/admin/bookings/services/new", { waitUntil: "domcontentloaded" });
    await waitForHydration(page, "#service-slug");
    await page.locator("#service-slug").fill(SERVICE_SLUG);
    await page.locator("#service-duration").selectOption("30");
    await page.locator("#service-intake").selectOption(intakeSurveyId);
    await page.locator("#vi-name").fill(SERVICE_NAME);
    await page.locator("#en-name").fill("E2E consultation");
    await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/bookings\/services\/[^/]+\?saved=1/, { timeout: 15_000 });
    serviceId = page.url().match(/\/admin\/bookings\/services\/([^/?]+)/)?.[1] ?? "";
    expect(serviceId).not.toBe("");

    await page.goto("/admin/bookings/slots", { waitUntil: "domcontentloaded" });
    await waitForHydration(page, "#slot-service");
    await page.locator("#slot-service").selectOption(serviceId);
    await page.locator("#slot-date").fill(futureDate(3));
    await page.locator("#slot-start").fill("09:00");
    await page.getByRole("button", { name: "Tạo khung giờ", exact: true }).click();
    await expect(page.locator("body")).toContainText(SERVICE_NAME, { timeout: 10_000 });
    await expect(page.locator("body")).toContainText("09:00", { timeout: 10_000 });
  });

  test("visitor books: slot → contact → intake survey → sees code + flower", async ({ browser }) => {
    const anon = await anonContext(browser);
    const visitor = await anon.newPage();
    // The merged page /vi/dat-lich-khao-sat IS the flow for the (single)
    // service: no service list, no "Chọn dịch vụ này" step — the slot
    // picker is directly on the page.
    await visitor.goto("/vi/dat-lich-khao-sat", { waitUntil: "domcontentloaded" });
    await waitForHydration(visitor, 'button:has-text("09:00")');
    // Selecting a slot only marks it (aria-pressed); a separate "Tiếp tục"
    // advances to the contact form.
    await clickUntilVisible(visitor, /09:00/, 'button[aria-pressed="true"]');
    await clickUntilVisible(visitor, "Tiếp tục", "#booking-name");
    await visitor.locator("#booking-name").fill(VISITOR_NAME);
    await visitor.locator("#booking-phone").fill(VISITOR_PHONE);
    await visitor.locator("#booking-email").fill(VISITOR_EMAIL);
    await clickUntilVisible(visitor, "Tiếp tục", 'text=Bạn muốn trao đổi về vấn đề gì?');
    await visitor.locator('input[type="text"]').first().fill("Muốn tư vấn về hợp đồng E2E.");
    await clickUntilVisible(visitor, "Tiếp tục", 'button:has-text("Xác nhận đặt lịch")');
    await visitor.getByRole("button", { name: "Xác nhận đặt lịch" }).click();
    await expect(visitor.locator("body")).toContainText("Cảm ơn bạn đã đặt lịch!", { timeout: 15_000 });
    const bodyText = (await visitor.locator("body").innerText()) ?? "";
    referenceCode = bodyText.match(BK_RE)?.[0] ?? "";
    expect(referenceCode).toMatch(BK_RE);
    // The flower badge sits under the "Tên hoa của bạn" label; its text is
    // the localized flower name for the booked row.
    await expect(visitor.locator("body")).toContainText("Tên hoa của bạn");
    const booking = await db().booking.findUniqueOrThrow({ where: { referenceCode } });
    expect(booking.flowerCode).toBeTruthy();
    flowerName = flowerNameFor(booking.flowerCode, "vi");
    await expect(visitor.locator("body")).toContainText(flowerName);
    await anon.close();
  });

  test("public calendar shows only the flower for the booked slot", async ({ browser }) => {
    const anon = await anonContext(browser);
    const visitor = await anon.newPage();
    await visitor.goto("/vi/dat-lich-khao-sat", { waitUntil: "domcontentloaded" });
    const slotButton = visitor.getByRole("button", { name: /09:00/ });
    await expect(slotButton).toBeDisabled();
    await expect(visitor.locator("body")).toContainText(
      `${flowerName} đã đặt lịch này rồi, bạn chọn lịch khác nhé`,
    );
    await expect(visitor.locator("body")).not.toContainText(VISITOR_NAME);
    await expect(visitor.locator("body")).not.toContainText(VISITOR_EMAIL);
    await expect(visitor.locator("body")).not.toContainText(VISITOR_PHONE);
    await anon.close();
  });

  test("admin sees name + flower, confirms the booking", async ({ page }) => {
    await page.goto("/admin/bookings", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toContainText(`${VISITOR_NAME} — Hoa:`, { timeout: 10_000 });
    const booking = await db().booking.findUniqueOrThrow({ where: { referenceCode } });
    await page.goto(`/admin/bookings/${booking.id}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toContainText(VISITOR_EMAIL);
    await expect(page.locator("body")).toContainText("Muốn tư vấn về hợp đồng E2E.");
    await waitForHydration(page, 'button:has-text("Xác nhận")');
    await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
    await expect(page.locator("body")).toContainText("Đã xác nhận", { timeout: 10_000 });
    expect((await db().booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("confirmed");
  });

  test("visitor looks up the booking first (info card + status), then cancels; slot is free again with no flower", async ({ browser }) => {
    const anon = await anonContext(browser);
    const visitor = await anon.newPage();
    await visitor.goto("/vi/dat-lich-khao-sat/tra-cuu", { waitUntil: "domcontentloaded" });
    await waitForHydration(visitor, "#lookup-code");
    await visitor.locator("#lookup-code").fill(referenceCode);
    await visitor.locator("#lookup-email").fill(VISITOR_EMAIL);
    await clickUntilVisible(visitor, "Tìm lịch hẹn", "text=Huỷ lịch hẹn này");
    // The lookup shows the booking's own info card before any cancel.
    await expect(visitor.locator("body")).toContainText(VISITOR_NAME, { timeout: 10_000 });
    await expect(visitor.locator("body")).toContainText("Đã xác nhận");
    await expect(visitor.locator("body")).toContainText(referenceCode);
    await expect(visitor.locator("body")).toContainText(flowerName);
    await clickUntilVisible(visitor, "Huỷ lịch hẹn này", "text=Lịch hẹn đã được huỷ");
    const booking = await db().booking.findUniqueOrThrow({ where: { referenceCode } });
    expect(booking.status).toBe("cancelled");

    await visitor.goto("/vi/dat-lich-khao-sat", { waitUntil: "domcontentloaded" });
    const slotButton = visitor.getByRole("button", { name: /09:00/ });
    await expect(slotButton).toBeEnabled();
    await expect(visitor.locator("body")).toContainText("Còn trống");
    await expect(visitor.locator("body")).not.toContainText("đã đặt lịch này rồi");
    await anon.close();
  });

  test("confirmation link with an unknown token shows the invalid state", async ({ browser }) => {
    const anon = await anonContext(browser);
    const visitor = await anon.newPage();
    await visitor.goto("/vi/dat-lich-khao-sat/xac-nhan?token=does-not-exist", {
      waitUntil: "domcontentloaded",
    });
    await expect(visitor.locator("body")).toContainText("không hợp lệ", { timeout: 10_000 });
    await anon.close();
  });
});
