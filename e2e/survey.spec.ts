// E2E: survey lifecycle (Phase 10, Agent G).
//
// Admin (reused storage-state login from e2e/admin.setup.ts — never logs in
// per test) creates a survey in the UI, adds questions, sets the editorial-vn
// theme, previews, publishes; an anonymous visitor submits on desktop and on
// mobile 390px; admin sees the response and exports CSV; the survey is then
// closed and new submissions are rejected. A second, Prisma-seeded survey
// with two sections exercises the multi-step wizard (Next/Back keeps
// answers). Fixtures are cleaned up afterwards; the dev DB ends as seeded.
import { test, expect, type Browser, type Page } from "@playwright/test";
import { db } from "./helpers";

const STATE = "/tmp/e2e-evidence/admin-state.json";
const RUN = Date.now().toString(36);
const SLUG = `e2e-survey-${RUN}`;
const TITLE_VI = "Khảo sát E2E — phản hồi dịch vụ";
const TITLE_EN = "E2E survey — service feedback";
const ANSWER_TEXT = "Câu trả lời E2E — tiếng Việt có dấu";
const SECTIONED_SLUG = `e2e-survey-sections-${RUN}`;

// Distinct visitor identities: the public submit endpoint rate-limits at
// 5 submits / 10 min per client IP, and every anonymous browser context
// would otherwise share the single "unknown" bucket (no X-Forwarded-For),
// so re-runs within one window would 429 each other. One XFF identity per
// context simulates distinct visitors.
let anonIpCounter = 0;
async function anonContext(browser: Browser, viewport?: { width: number; height: number }) {
  anonIpCounter += 1;
  return browser.newContext({
    ...(viewport ? { viewport } : {}),
    extraHTTPHeaders: { "x-forwarded-for": `203.0.113.${100 + anonIpCounter}` },
  });
}

/**
 * Click a button and wait for the UI it reveals. In `next dev` the route's
 * JS compiles lazily, so a click that lands before hydration does nothing
 * (SSR HTML has no handlers yet); retry the click until the expected
 * element appears. Once any earlier click has worked, hydration is done
 * and later clicks need no retry.
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

async function seedSectionedSurvey() {
  const survey = await db().survey.create({
    data: {
      slug: SECTIONED_SLUG,
      status: "published",
      publishedAt: new Date(Date.now() - 60_000),
      themePreset: "minimal",
      translations: {
        create: [
          {
            locale: "vi",
            title: "Khảo sát E2E nhiều bước",
            subtitle: "",
            description: "",
            introduction: "",
            completionMessage: "Cảm ơn bạn đã hoàn thành khảo sát nhiều bước.",
            privacyNotice: "",
          },
          {
            locale: "en",
            title: "E2E multi-step survey",
            subtitle: "",
            description: "",
            introduction: "",
            completionMessage: "Thank you for completing the multi-step survey.",
            privacyNotice: "",
          },
        ],
      },
    },
    select: { id: true },
  });
  for (let s = 0; s < 2; s++) {
    const section = await db().surveySection.create({
      data: {
        surveyId: survey.id,
        order: s,
        translations: {
          create: [
            { locale: "vi", title: `Nhóm ${s + 1}`, description: "" },
            { locale: "en", title: `Section ${s + 1}`, description: "" },
          ],
        },
      },
      select: { id: true },
    });
    await db().surveyQuestion.create({
      data: {
        surveyId: survey.id,
        sectionId: section.id,
        type: "short_text",
        order: 0,
        required: s === 0,
        translations: {
          create: [
            { locale: "vi", title: `Câu hỏi nhóm ${s + 1}`, description: "", placeholder: "" },
            { locale: "en", title: `Section ${s + 1} question`, description: "", placeholder: "" },
          ],
        },
      },
    });
  }
  return survey.id;
}

/** Ordered cleanup: responses first (their answers reference questions with
 * onDelete Restrict, so a plain survey.deleteMany would fail once a survey
 * has answers), then the surveys themselves. */
async function cleanupE2ESurveys() {
  const rows = await db().survey.findMany({
    where: { slug: { startsWith: "e2e-survey-" } },
    select: { id: true },
  });
  const ids = rows.map((row) => row.id);
  if (ids.length > 0) {
    await db().surveyResponse.deleteMany({ where: { surveyId: { in: ids } } });
    await db().survey.deleteMany({ where: { id: { in: ids } } });
  }
}

test.describe.serial("survey lifecycle (admin UI → public → admin)", () => {
  test.use({ storageState: STATE });

  let surveyId = "";
  let publicUrl = "";

  test.beforeAll(async () => {
    await cleanupE2ESurveys();
    await seedSectionedSurvey();
  });

  test.afterAll(async () => {
    await cleanupE2ESurveys();
    await db().$disconnect();
  });

  test("admin creates a survey, adds questions, sets editorial-vn theme and publishes", async ({
    page,
  }) => {
    await page.goto("/admin/surveys/new", { waitUntil: "domcontentloaded" });
    await waitForHydration(page, '[name="vi.title"]');
    await page.locator('[name="vi.title"]').fill(TITLE_VI);
    await page.locator('[name="vi.completionMessage"]').fill("Cảm ơn bạn đã hoàn thành khảo sát E2E.");
    await page.locator("#slug").fill(SLUG);
    await page.getByRole("tab", { name: "English" }).first().click();
    await page.locator('[name="en.title"]').fill(TITLE_EN);
    for (let attempt = 0; attempt < 4; attempt++) {
      await page.getByRole("button", { name: "Tạo khảo sát", exact: true }).click().catch(() => undefined);
      try {
        await expect(page).toHaveURL(/\/admin\/surveys\/[^/]+\?saved=1/, { timeout: 5000 });
        break;
      } catch {
        // Click landed before hydration — try again.
      }
    }
    await expect(page).toHaveURL(/\/admin\/surveys\/[^/]+\?saved=1/, { timeout: 15_000 });
    surveyId = page.url().match(/\/admin\/surveys\/([^/?]+)/)?.[1] ?? "";
    expect(surveyId).not.toBe("");

    // Question 1: required short text.
    const addQuestion = async (type: string, titleVi: string, titleEn: string, required: boolean) => {
      await page.getByRole("button", { name: "+ Thêm câu hỏi" }).click();
      const qForm = page.locator("form", { has: page.locator("#q-type") });
      await qForm.locator("#q-type").selectOption(type);
      if (required) await qForm.locator('[name="required"]').check();
      await qForm.locator('[name="vi.title"]').fill(titleVi);
      await qForm.getByRole("tab", { name: "English" }).click();
      await qForm.locator('[name="en.title"]').fill(titleEn);
      await qForm.getByRole("button", { name: "Thêm câu hỏi", exact: true }).click();
      await expect(page.locator("text=" + titleVi).first()).toBeVisible({ timeout: 10_000 });
    };
    await addQuestion("short_text", "Bạn muốn chia sẻ điều gì?", "What would you like to share?", true);
    await addQuestion("rating", "Bạn chấm mấy điểm?", "How many points?", false);

    // Theme editorial-vn + publish, via the settings form on the same page.
    await page.locator("#themePreset").selectOption("editorial-vn");
    await page.locator("#status").selectOption("published");
    await page.getByRole("button", { name: "Lưu khảo sát", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/surveys/${surveyId}\\?saved=1`), {
      timeout: 15_000,
    });
  });

  test("admin previews the survey and opens the public URL", async ({ page }) => {
    await page.goto(`/admin/surveys/${surveyId}`, { waitUntil: "domcontentloaded" });
    const preview = page.waitForEvent("popup");
    await page.getByRole("link", { name: "Xem trước" }).click();
    const previewPage = await preview;
    await expect(previewPage.locator("body")).toContainText(TITLE_VI, { timeout: 10_000 });
    await previewPage.close();

    const href = await page.getByRole("link", { name: "Xem trang công khai" }).getAttribute("href");
    expect(href).toContain(`/vi/survey/${SLUG}`);
    publicUrl = href ?? "";
  });

  test("anonymous visitor submits on desktop and sees the completion screen", async ({ browser }) => {
    const anon = await anonContext(browser);
    const visitor = await anon.newPage();
    await visitor.goto(publicUrl, { waitUntil: "domcontentloaded" });
    await waitForHydration(visitor, 'button:has-text("Bắt đầu khảo sát")');
    await expect(visitor.locator("body")).toContainText(TITLE_VI);
    await expect(visitor.locator("body")).toContainText("Không thu thập thông tin cá nhân");
    await clickUntilVisible(visitor, "Bắt đầu khảo sát", 'input[type="text"]');
    await visitor.locator('input[type="text"]').first().fill(ANSWER_TEXT);
    await visitor.getByRole("button", { name: "4", exact: true }).click();
    // Anti-bot timing gate (route step 3): the server returns a SILENT fake
    // 200 and stores NOTHING when a submit lands < 1800 ms after the wizard
    // mounted. A real human is slower than that; wait so the response is
    // really stored. (Without this the test passes — the UI shows success —
    // but the DB count in the CSV test below is short by one.)
    await visitor.waitForTimeout(2100);
    await visitor.getByRole("button", { name: "Gửi câu trả lời" }).click();
    await expect(visitor.locator("body")).toContainText("ĐÃ GHI NHẬN PHIẾU", { timeout: 15_000 });
    await expect(visitor.locator("body")).toContainText("Cảm ơn bạn đã hoàn thành khảo sát E2E.");
    await anon.close();
  });

  test("anonymous visitor submits on mobile 390px without horizontal overflow", async ({
    browser,
  }) => {
    const mobile = await anonContext(browser, { width: 390, height: 844 });
    const visitor = await mobile.newPage();
    await visitor.goto(publicUrl, { waitUntil: "domcontentloaded" });
    await waitForHydration(visitor, 'button:has-text("Bắt đầu khảo sát")');
    await clickUntilVisible(visitor, "Bắt đầu khảo sát", 'input[type="text"]');
    await visitor.locator('input[type="text"]').first().fill(ANSWER_TEXT + " (mobile)");
    await visitor.getByRole("button", { name: "5", exact: true }).click();
    // Anti-bot timing gate (route step 3): the server returns a SILENT fake
    // 200 and stores NOTHING when a submit lands < 1800 ms after the wizard
    // mounted. A real human is slower than that; wait so the response is
    // really stored. (Without this the test passes — the UI shows success —
    // but the DB count in the CSV test below is short by one.)
    await visitor.waitForTimeout(2100);
    await visitor.getByRole("button", { name: "Gửi câu trả lời" }).click();
    await expect(visitor.locator("body")).toContainText("ĐÃ GHI NHẬN PHIẾU", { timeout: 15_000 });
    const overflow = await visitor.evaluate(() => document.documentElement.scrollWidth - 390);
    expect(overflow).toBeLessThanOrEqual(1);
    await mobile.close();
  });

  test("multi-step wizard: Next validates, Back keeps the answer", async ({ browser }) => {
    const anon = await anonContext(browser);
    const visitor = await anon.newPage();
    await visitor.goto(`/vi/survey/${SECTIONED_SLUG}`, { waitUntil: "domcontentloaded" });
    await waitForHydration(visitor, 'button:has-text("Bắt đầu khảo sát")');
    await clickUntilVisible(visitor, "Bắt đầu khảo sát", 'input[type="text"]');
    // Step 1 is required: Next without an answer must not advance.
    await visitor.getByRole("button", { name: "Tiếp theo" }).click();
    await expect(visitor.locator("body")).toContainText("Câu hỏi nhóm 1");
    await visitor.locator('input[type="text"]').first().fill("Đáp án bước 1");
    await visitor.getByRole("button", { name: "Tiếp theo" }).click();
    await expect(visitor.locator("body")).toContainText("Câu hỏi nhóm 2");
    await visitor.getByRole("button", { name: "Quay lại" }).click();
    await expect(visitor.locator('input[type="text"]').first()).toHaveValue("Đáp án bước 1");
    await visitor.getByRole("button", { name: "Tiếp theo" }).click();
    await visitor.getByRole("button", { name: "Gửi câu trả lời" }).click();
    await expect(visitor.locator("body")).toContainText("ĐÃ GHI NHẬN PHIẾU", { timeout: 15_000 });
    await anon.close();
  });

  test("admin sees the responses and exports CSV (BOM + VI + answer)", async ({ page }) => {
    expect(await db().surveyResponse.count({ where: { surveyId } })).toBe(2);
    const firstResponse = await db().surveyResponse.findFirstOrThrow({
      where: { surveyId },
      orderBy: { submittedAt: "asc" },
      select: { id: true },
    });
    await page.goto(`/admin/surveys/${surveyId}/responses`, { waitUntil: "domcontentloaded" });
    await page.goto(`/admin/surveys/${surveyId}/responses/${firstResponse.id}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("body")).toContainText(ANSWER_TEXT, { timeout: 10_000 });

    // CSV export as the admin (same session): BOM, VI title, answer text.
    const exportRes = await page.request.get(`/api/admin/surveys/${surveyId}/responses/export`);
    expect(exportRes.status()).toBe(200);
    expect(exportRes.headers()["content-type"] ?? "").toContain("text/csv");
    const body = await exportRes.text();
    expect(body.charCodeAt(0)).toBe(0xfeff);
    expect(body).toContain("response_id,submitted_at,locale");
    expect(body).toContain("Bạn muốn chia sẻ điều gì?");
    expect(body).toContain(ANSWER_TEXT);
  });

  test("export without a session is 401", async ({ browser }) => {
    const anon = await anonContext(browser);
    // NOTE: a context created via browser.newContext() inside a test that
    // uses storageState inherits the admin session cookie (verified in the
    // trace: the request carried ps_session and returned 200). Clear it so
    // this really is an unauthenticated request.
    await anon.clearCookies();
    const res = await anon.request.get(`/api/admin/surveys/${surveyId}/responses/export`);
    expect(res.status()).toBe(401);
    await anon.close();
  });

  test("closing the survey rejects new submissions (UI card + API 409)", async ({
    page,
    browser,
  }) => {
    await page.goto(`/admin/surveys/${surveyId}`, { waitUntil: "domcontentloaded" });
    await waitForHydration(page, "#status");
    await page.locator("#status").selectOption("closed");
    await page.getByRole("button", { name: "Lưu khảo sát", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/surveys/${surveyId}\\?saved=1`), {
      timeout: 15_000,
    });

    const anon = await anonContext(browser);
    const visitor = await anon.newPage();
    await visitor.goto(publicUrl, { waitUntil: "domcontentloaded" });
    await expect(visitor.locator("body")).toContainText("Khảo sát đã kết thúc", { timeout: 10_000 });
    const apiRes = await anon.request.post(`/api/surveys/${SLUG}/responses`, {
      data: { locale: "vi", answers: [] },
    });
    expect(apiRes.status()).toBe(409);
    expect(((await apiRes.json()) as { error: { code: string } }).error.code).toBe("SURVEY_CLOSED");
    await anon.close();
  });
});
