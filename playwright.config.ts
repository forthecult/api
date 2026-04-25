import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ?? "3000";
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;
const IS_CI = Boolean(process.env.CI);

/**
 * Smoke + a11y Playwright config.
 *
 * Production parity in CI: runs `next build && next start` so tests hit the
 * same bundler output that ships to users. Locally, `bun run dev` stays
 * fast for iteration.
 *
 * Parallelism: on by default. Tests that need shared state use
 * `test.describe.configure({ mode: "serial" })` at the describe level — the
 * old repo-wide `workers: 1` was hiding flakes and tripling wall time.
 */
export default defineConfig({
  forbidOnly: IS_CI,
  fullyParallel: true,
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts$/,
    },
    {
      dependencies: ["setup"],
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      dependencies: ["setup"],
      name: "mobile-safari",
      use: { ...devices["iPhone 14"] },
    },
  ],
  reporter: IS_CI ? [["github"], ["html", { open: "never" }]] : "list",
  // 0 retries locally surfaces flakes immediately. CI retries once to paper
  // over genuine network blips, not to hide real bugs.
  retries: IS_CI ? 1 : 0,
  testDir: "./e2e",
  use: {
    actionTimeout: 15_000,
    baseURL: BASE_URL,
    navigationTimeout: 30_000,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  webServer: {
    // CI exercises the production build; local stays on dev for speed. The
    // `smoketest:ci` script handles `next build` before Playwright starts.
    command: IS_CI ? "bun run start" : "bun run dev",
    reuseExistingServer: !IS_CI,
    stderr: "pipe",
    stdout: "pipe",
    timeout: 120_000,
    url: BASE_URL,
  },
  // Let Playwright size workers; 1 worker hides races and triples wall time.
  workers: IS_CI ? 2 : undefined,
});
