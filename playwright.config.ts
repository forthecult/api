import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ?? "3000";
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

/**
 * Playwright configuration for smoke tests.
 * Tracks auth, cart, checkout, and critical user flows.
 *
 * Usage:
 *   - `bun run smoketest` - Run all smoke tests (with dev server)
 *   - `bun run smoketest:no-compile` - Against existing server
 *   - `bun run smoketest:ui` - UI mode for debugging
 *   - `bun run smoketest -- --grep "authentication"` - Run auth tests only
 *   - `bun run smoketest -- --grep "checkout"` - Run checkout tests only
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // Sequential for auth/cart state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1, // Retry for API-dependent tests
  workers: 1, // Single worker for session isolation
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "bun run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
