import { expect, test as setup } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Auth setup project. Signs in with a known test account and writes a
 * storageState so logged-in specs can reuse it via `storageState:
 * authStorageStatePath`.
 *
 * Gated behind `E2E_AUTH_EMAIL` / `E2E_AUTH_PASSWORD`. When either is missing,
 * logged-in tests should declare `test.skip(!process.env.E2E_AUTH_EMAIL, …)`
 * so they skip declaratively instead of silently.
 */

export const authStorageStatePath = path.join(
  here,
  ".auth",
  "user.storage.json",
);

setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_AUTH_EMAIL?.trim();
  const password = process.env.E2E_AUTH_PASSWORD?.trim();
  setup.skip(
    !email || !password,
    "E2E_AUTH_EMAIL / E2E_AUTH_PASSWORD not set — skipping authenticated setup",
  );

  await page.goto("/login");
  await page.getByLabel(/email/i).first().fill(email!);
  await page
    .getByLabel(/password/i)
    .first()
    .fill(password!);
  await page.getByRole("button", { name: /sign in|log in/i }).click();

  // A successful login lands on either a dashboard route or the homepage and
  // exposes an account control; both are covered by the post-auth wait below.
  await page.waitForURL(
    (url) =>
      !url.pathname.startsWith("/login") && !url.pathname.startsWith("/auth"),
    { timeout: 20_000 },
  );
  await expect(
    page.getByRole("button", { name: /account|profile|sign out|log out/i }),
  ).toBeVisible({ timeout: 10_000 });

  await page.context().storageState({ path: authStorageStatePath });
});
