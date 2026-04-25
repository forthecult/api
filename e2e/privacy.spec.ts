import { expect, test } from "@playwright/test";

import { posthogIngestHost, posthogIsEnabled } from "./helpers";

/**
 * Privacy + auth boundary smokes. Catches regressions where:
 *   - dashboard routes stop redirecting to /login (data exposure)
 *   - the token-gate challenge endpoint is mis-wired (gate bypass)
 *   - PostHog drifts off our first-party proxy host (ad-block + privacy hit)
 */

const AUTH_GATED_ROUTES: readonly string[] = [
  "/dashboard",
  "/dashboard/profile",
  "/dashboard/orders",
  "/dashboard/settings",
  "/dashboard/support-tickets",
];

for (const path of AUTH_GATED_ROUTES) {
  test(`unauthenticated ${path} redirects to /login`, async ({ page }) => {
    await page.goto(path, { waitUntil: "commit" });
    await page.waitForURL(/\/(login|auth\/sign-in)/, { timeout: 15_000 });
    await expect(
      page.getByRole("textbox", { name: /email/i }).first(),
    ).toBeVisible();
  });
}

test("token-gate challenge endpoint rejects unknown resources", async ({
  request,
}) => {
  const response = await request.post("/api/token-gate/challenge", {
    data: { resourceId: "__does_not_exist__", resourceType: "page" },
  });
  // 400/404/422 are all acceptable negative responses. 200 with a challenge
  // for an unknown slug would be a gate misconfiguration.
  expect(response.status(), `got ${response.status()}`).toBeGreaterThanOrEqual(
    400,
  );
  expect(response.status()).toBeLessThan(500);
});

test("analytics only sends to the first-party proxy host", async ({ page }) => {
  test.skip(
    !posthogIsEnabled(),
    "NEXT_PUBLIC_POSTHOG_KEY not set — analytics disabled",
  );

  const proxyHost = new URL(posthogIngestHost()).hostname;
  const offProxyCalls: string[] = [];
  page.on("request", (req) => {
    const url = req.url();
    const host = new URL(url).hostname;
    // PostHog SDK hits only the configured proxy. Any call to *.posthog.com or
    // another analytics domain means the proxy has drifted or a new vendor
    // was added without review.
    if (
      host !== proxyHost &&
      (host.endsWith(".posthog.com") ||
        host === "posthog.com" ||
        host.endsWith(".i.posthog.com"))
    ) {
      offProxyCalls.push(url);
    }
  });

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(
    offProxyCalls,
    `analytics leaked to non-proxy hosts: ${offProxyCalls.join(", ")}`,
  ).toEqual([]);
});
