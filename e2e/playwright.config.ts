import { defineConfig } from "@playwright/test";
import path from "node:path";

/**
 * Wave 3 E2E (Phases 8 + 9) — smoke suite against a local PRODUCTION build
 * (`next build` + `next start`, never dev mode).
 *
 * Chromium ONLY: the Playwright CDN (cdn.playwright.dev /
 * playwright.download.prss.microsoft.com) is blocked by this VM's egress
 * proxy, so `npx playwright install chromium` cannot download a browser
 * (see report). Chrome for Testing 158.0.8127.18 was downloaded from
 * storage.googleapis.com (reachable) and is used via executablePath below.
 * Chrome/Edge/Firefox/Safari/iOS are not available on this VM.
 *
 * Screenshots/traces go to /tmp/e2e-evidence (NOT inside the repo).
 * Vitest never picks these specs up: its include is the tests dir with a
 * .test.ts suffix, and these live in e2e/ as .spec.ts files.
 */
const CHROME_PATH =
  process.env.E2E_CHROME_PATH ||
  "/home/hatch/chrome-for-testing/chrome-linux64/chrome";

export default defineConfig({
  testDir: path.resolve(__dirname),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "/tmp/e2e-evidence/report.json" }]],
  outputDir: "/tmp/e2e-evidence/test-results",
  // The admin suite logs in once in the setup project and reuses the
  // session (storage state) so the 6-attempts/10-min login rate limit is
  // never tripped by per-test logins.
  projects: [
    { name: "setup", testMatch: /admin\.setup\.ts/ },
    { name: "e2e", testMatch: /.*\.spec\.ts/, dependencies: ["setup"] },
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:3000",
    launchOptions: {
      executablePath: CHROME_PATH,
      args: ["--no-sandbox", "--disable-gpu"],
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    viewport: { width: 1440, height: 900 },
  },
});
