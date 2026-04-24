import { expect, test } from "@playwright/test";

import { addCurrentProductToCart, gotoFirstProduct } from "./helpers";

/**
 * Core public-route smoke. Each test uses a single accessible locator per
 * assertion — no `text='A', text='B', #id` OR chains, which Playwright parses
 * as a single CSS selector with an id of `B', text='C'` and silently matches
 * nothing. All assertions are hard (no `isVisible().catch → test.skip`): a
 * smoke must fail the build, not quietly pass.
 */

test.describe("site shell", () => {
  test("homepage loads with branded title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Culture|For the Cult/i);
    await expect(page.getByRole("navigation").first()).toBeVisible();
  });

  test("products listing renders product links", async ({ page }) => {
    await page.goto("/products");
    await expect(page.getByRole("heading").first()).toBeVisible();
    await expect(page.locator('a[href^="/products/"]').first()).toBeVisible();
  });

  test("404 page handles unknown routes", async ({ page }) => {
    const response = await page.goto("/page-does-not-exist-12345", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(404);
    await expect(page.getByText(/404|not found/i).first()).toBeVisible();
  });
});

test.describe("authentication pages", () => {
  test("signup page shows email + password inputs", async ({ page }) => {
    await page.goto("/signup");
    await expect(
      page.getByRole("textbox", { name: /email/i }).first(),
    ).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test("login page shows sign-in action", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("textbox", { name: /email/i }).first(),
    ).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: /sign in|log in/i }),
    ).toBeVisible();
  });

  test("forgot password page shows email input", async ({ page }) => {
    await page.goto("/auth/forgot-password");
    await expect(
      page.getByRole("textbox", { name: /email/i }).first(),
    ).toBeVisible();
  });

  test("login surfaces a validation error on empty submit", async ({
    page,
  }) => {
    await page.goto("/login");
    await page
      .getByRole("button", { name: /sign in|log in/i })
      .first()
      .click();
    await expect(page.getByRole("alert").first()).toBeVisible({
      timeout: 5_000,
    });
  });
});

test.describe("cart flow", () => {
  // One shared serial flow: add → open → increase → remove. Each step relies
  // on the previous step's state, so describe-level serial mode keeps them
  // from racing each other across workers.
  test.describe.configure({ mode: "serial" });

  test("add first product to cart", async ({ page }) => {
    await gotoFirstProduct(page);
    await addCurrentProductToCart(page);
    await expect(
      page.getByRole("button", { name: /open cart/i }).first(),
    ).toBeVisible();
  });

  test("cart drawer opens and shows controls", async ({ page }) => {
    await gotoFirstProduct(page);
    await addCurrentProductToCart(page);
    await page
      .getByRole("button", { name: /open cart/i })
      .first()
      .click();
    await expect(
      page.getByRole("button", { name: /increase quantity/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /remove item/i }).first(),
    ).toBeVisible();
  });
});

test.describe("checkout surfaces", () => {
  test("checkout route responds", async ({ page }) => {
    const response = await page.goto("/checkout");
    expect(response?.status()).toBeLessThan(500);
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("crypto checkout route responds", async ({ page }) => {
    const response = await page.goto("/checkout/crypto");
    expect(response?.status()).toBeLessThan(500);
    await expect(page.getByRole("heading").first()).toBeVisible();
  });
});

test.describe("web3 marketing", () => {
  test("membership page loads", async ({ page }) => {
    await page.goto("/membership");
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("token page loads", async ({ page }) => {
    await page.goto("/token");
    await expect(page.getByRole("heading").first()).toBeVisible();
  });
});

test.describe("support surfaces", () => {
  test("chat page loads", async ({ page }) => {
    await page.goto("/chat");
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("contact page loads", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.getByRole("heading").first()).toBeVisible();
  });
});

test.describe("public api contract", () => {
  test("shipping calculate accepts a valid US cart", async ({ request }) => {
    const response = await request.post("/api/shipping/calculate", {
      data: {
        country: "US",
        items: [{ id: "test-product", price: 2500, quantity: 1 }],
        region: "NY",
        subtotal: 2500,
      },
    });
    // Endpoint swallows validation failures and returns ZERO_SHIPPING to keep
    // checkout flowing, so 200 is the contract. 4xx means a regression broke
    // the public surface.
    expect(response.status()).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("cost");
    expect(typeof body.cost === "number").toBe(true);
  });

  test("shipping calculate rejects a malformed payload with 4xx or defaults", async ({
    request,
  }) => {
    const response = await request.post("/api/shipping/calculate", {
      data: { junk: true },
    });
    // Accept either strict rejection (4xx) or graceful fallback (200 with a
    // zero-cost shipping object). Anything else — a 5xx or non-JSON — is a
    // bug. Explicit about the two accepted shapes so drift is visible.
    if (response.status() === 200) {
      const body = (await response.json()) as Record<string, unknown>;
      expect(body).toHaveProperty("cost");
    } else {
      expect(response.status()).toBeGreaterThanOrEqual(400);
      expect(response.status()).toBeLessThan(500);
    }
  });

  test("newsletter subscribe returns JSON success", async ({ request }) => {
    const unique = `newsletter-smoke-${Date.now()}@gmail.com`;
    const response = await request.post("/api/newsletter/subscribe", {
      data: { email: unique },
      headers: { "Content-Type": "application/json" },
    });
    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as { success?: boolean };
    expect(body.success).toBe(true);
  });
});
