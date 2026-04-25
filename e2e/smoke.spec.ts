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

  test("homepage featured products section renders product cards when catalog has products", async ({
    page,
    request,
  }) => {
    const productsRes = await request.get(
      "/api/products?forStorefront=1&limit=1&sort=newest",
    );
    expect(productsRes.status()).toBeLessThan(500);
    const body = (await productsRes.json()) as { total?: number };
    const total = typeof body.total === "number" ? body.total : 0;

    await page.goto("/");
    const featuredSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: /featured products/i }),
    });
    await expect(featuredSection).toBeVisible();
    if (total > 0) {
      await expect(
        featuredSection.locator('a[href^="/products/"]').first(),
      ).toBeVisible({ timeout: 15_000 });
    } else {
      await expect(
        featuredSection.getByRole("link", { name: /view all products/i }),
      ).toBeVisible();
    }
  });

  test("products listing renders product links", async ({ page }) => {
    await page.goto("/products");
    await expect(page.getByRole("heading").first()).toBeVisible();
    await expect(page.locator('a[href^="/products/"]').first()).toBeVisible();
  });

  test("product detail page loads from products listing", async ({ page }) => {
    await page.goto("/products");
    const firstProductLink = page.locator('a[href^="/products/"]').first();
    await expect(firstProductLink).toBeVisible();
    const href = await firstProductLink.getAttribute("href");
    expect(href).toBeTruthy();
    const response = await page.goto(String(href));
    expect(response?.status()).toBeLessThan(500);
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("brand detail page loads from brands listing", async ({ page }) => {
    const response = await page.goto("/brands");
    expect(response?.status()).toBeLessThan(500);
    const firstBrandLink = page.locator('a[href^="/brands/"]').first();
    await expect(firstBrandLink).toBeVisible();
    const brandHref = await firstBrandLink.getAttribute("href");
    expect(brandHref).toBeTruthy();
    const brandResponse = await page.goto(String(brandHref));
    expect(brandResponse?.status()).toBeLessThan(500);
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("first category page loads without runtime error fallback", async ({
    page,
    request,
  }) => {
    const categoriesRes = await request.get("/api/categories");
    expect(categoriesRes.ok()).toBeTruthy();
    const categoriesJson = (await categoriesRes.json()) as {
      categories?: { slug?: string }[];
    };
    const slug = categoriesJson.categories?.find((c) => c.slug)?.slug;
    expect(slug).toBeTruthy();
    const response = await page.goto(`/${slug}`);
    expect(response?.status()).toBeLessThan(500);
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
    await expect(page.getByRole("heading").first()).toBeVisible();
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

  test("wallet sign-in modal opens from login", async ({ page }) => {
    await page.goto("/login");
    const walletTrigger = page
      .getByRole("button", { name: /sign in with wallet|connect wallet/i })
      .first();
    await expect(walletTrigger).toBeVisible();
    await walletTrigger.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByText(/sign in with wallet|connect wallet|solana|ethereum/i),
    ).toBeVisible();
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
  test("auth session endpoint never returns 5xx", async ({ request }) => {
    const sessionRes = await request.get("/api/auth/session");
    const getSessionRes = await request.get("/api/auth/get-session");
    // Better Auth can expose either path depending on version/config; at least
    // one must respond without a server error.
    expect(
      sessionRes.status() < 500 || getSessionRes.status() < 500,
    ).toBeTruthy();
  });

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
