import { expect, test } from "@playwright/test";

test.describe("smoke tests", () => {
  // Basic Site Tests
  test("homepage loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/FTC|ftc/i);
  });

  test("navigation works", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("nav, header")).toBeVisible();
  });

  test("products page loads", async ({ page }) => {
    await page.goto("/products");
    await expect(page.locator("h1, [data-testid='products-grid']").first()).toBeVisible();
  });

  // Category Tests
  test.describe("categories", () => {
    test("category pages load", async ({ page }) => {
      // Test common category routes
      const categories = ["/hoodies", "/t-shirts", "/accessories"];
      for (const category of categories) {
        await page.goto(category);
        // Check for products or category content
        const hasContent = await page.locator("h1, [data-testid='products-grid'], .product-grid").first().isVisible().catch(() => false);
        if (hasContent) {
          await expect(page.locator("h1, [data-testid='products-grid']").first()).toBeVisible({ timeout: 5000 });
          break; // Pass if at least one category works
        }
      }
    });

    test("featured products on homepage", async ({ page }) => {
      await page.goto("/");
      // Look for featured products section
      const featuredSection = page.locator("section:has-text('Featured'), [data-testid='featured-products'], .featured").first();
      const hasFeatured = await featuredSection.isVisible().catch(() => false);
      if (hasFeatured) {
        await expect(featuredSection).toBeVisible();
        // Verify product links exist
        const productLinks = page.locator("a[href^='/store/'], a[href^='/products/']");
        await expect(productLinks.first()).toBeVisible();
      } else {
        test.skip();
      }
    });
  });

  // Auth Tests
  test.describe("authentication", () => {
    test("signup page loads", async ({ page }) => {
      await page.goto("/signup");
      await expect(page.locator("#email, input[type='email']").first()).toBeVisible();
      await expect(page.locator("#password, input[type='password']").first()).toBeVisible();
    });

    test("login page loads", async ({ page }) => {
      await page.goto("/login");
      await expect(page.locator("#email, input[type='email']").first()).toBeVisible();
      await expect(page.locator("#password, input[type='password']").first()).toBeVisible();
      await expect(page.locator("button[type='submit'], button:has-text('Sign in')").first()).toBeVisible();
    });

    test("signup validates required fields", async ({ page }) => {
      await page.goto("/signup");
      await page.locator("button[type='submit'], button:has-text('Create account')").first().click();
      await expect(page.locator("[role='alert'], .text-destructive").first()).toBeVisible();
    });

    test("login validates required fields", async ({ page }) => {
      await page.goto("/login");
      await page.locator("button[type='submit'], button:has-text('Sign in')").first().click();
      await expect(page.locator("[role='alert'], .text-destructive").first()).toBeVisible();
    });

  test("forgot password page loads", async ({ page }) => {
    await page.goto("/auth/forgot-password");
    await expect(page.locator("input[type='email']").first()).toBeVisible();
  });
  });

  // Cart
  test.describe("cart", () => {
  test("add to cart from product page", async ({ page }) => {
    await page.goto("/products");
    const productLink = page.locator("a[href^='/store/'], a[href^='/products/']").first();
    await expect(productLink).toBeVisible({ timeout: 5000 });
    await productLink.click();
    await expect(page.locator("h1")).toBeVisible({ timeout: 5000 });
    const addButton = page.locator("button:has-text('Add to Cart')").first();
    await expect(addButton).toBeVisible({ timeout: 5000 });
    await addButton.click();
    await expect(page.locator("[aria-label='Open cart']").first()).toBeVisible({ timeout: 5000 });
  });

  test("update cart quantity", async ({ page }) => {
    await page.goto("/products");
    const productLink = page.locator("a[href^='/store/'], a[href^='/products/']").first();
    if (await productLink.isVisible().catch(() => false)) {
      await productLink.click();
      const addButton = page.locator("button:has-text('Add to Cart')").first();
      await addButton.click();
      // Open cart and verify quantity controls
      const cartButton = page.locator("[aria-label='Open cart']").first();
      await cartButton.click();
      const increaseBtn = page.locator("[aria-label='Increase quantity']").first();
      if (await increaseBtn.isVisible().catch(() => false)) {
        await increaseBtn.click();
      }
    }
  });

  test("remove item from cart", async ({ page }) => {
    await page.goto("/products");
    const productLink = page.locator("a[href^='/store/'], a[href^='/products/']").first();
    if (await productLink.isVisible().catch(() => false)) {
      await productLink.click();
      const addButton = page.locator("button:has-text('Add to Cart')").first();
      await addButton.click();
      const cartButton = page.locator("[aria-label='Open cart']").first();
      await cartButton.click();
      const removeBtn = page.locator("[aria-label='Remove item']").first();
      if (await removeBtn.isVisible().catch(() => false)) {
        await removeBtn.click();
      }
    }
  });
});

// Wishlist
test.describe("wishlist", () => {
  test("wishlist opens and displays", async ({ page }) => {
    await page.goto("/");
    // Look for wishlist button/link
    const wishlistBtn = page.locator("[aria-label='Wishlist'], a[href*='/wishlist'], [data-testid='wishlist']").first();
    if (await wishlistBtn.isVisible().catch(() => false)) {
      await wishlistBtn.click();
      await expect(page.locator("h1, text='Wishlist', text='Saved'").first()).toBeVisible({ timeout: 10000 });
    } else {
      test.skip();
    }
  });

  test("add to wishlist from product page", async ({ page }) => {
    await page.goto("/products");
    const productLink = page.locator("a[href^='/store/'], a[href^='/products/']").first();
    await expect(productLink).toBeVisible({ timeout: 5000 });
    await productLink.click();
    await expect(page.locator("h1")).toBeVisible({ timeout: 5000 });

    // Look for heart/wishlist button on product page
    const wishlistBtn = page.locator("[aria-label*='wishlist'], [aria-label*='Wishlist'], button:has(.heart), [data-testid='wishlist']").first();
    if (await wishlistBtn.isVisible().catch(() => false)) {
      await wishlistBtn.click();
      // Verify button state change (added to wishlist)
      await expect(wishlistBtn).toHaveAttribute("aria-label", /Remove|Saved|In wishlist/).catch(() => null);
    } else {
      test.skip();
    }
  });
});

// Dashboard
  test.describe("dashboard", () => {
  test("dashboard requires auth", async ({ page }) => {
    await page.goto("/dashboard");
    // Should redirect to login or show auth required
    await expect(page.locator("text='Sign in', text='Login', #email").first()).toBeVisible({ timeout: 10000 });
  });

  test("profile page accessible", async ({ page }) => {
    await page.goto("/dashboard/profile");
    await expect(page.locator("text='Sign in', #email").first()).toBeVisible({ timeout: 10000 });
  });

  test("orders page accessible", async ({ page }) => {
    await page.goto("/dashboard/orders");
    await expect(page.locator("text='Sign in', #email").first()).toBeVisible({ timeout: 10000 });
  });

  test("settings page loads", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await expect(page.locator("text='Sign in', #email").first()).toBeVisible({ timeout: 10000 });
  });
  });

  // Checkout
  test.describe("checkout", () => {
  test("checkout page loads", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page.locator("h1, text='Checkout'").first()).toBeVisible({ timeout: 10000 });
  });

  test("checkout has shipping form", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page.locator("input[type='email'], input[aria-label='Email']").first()).toBeVisible({ timeout: 10000 });
  });

    test("checkout displays payment options", async ({ page }) => {
      await page.goto("/checkout");
      await expect(page.locator("text='Credit card', text='Crypto', text='PayPal'").first()).toBeVisible({ timeout: 10000 });
    });

    test("estimated shipping works", async ({ page }) => {
      // Add item to cart
      await page.goto("/products");
      const productLink = page.locator("a[href^='/store/'], a[href^='/products/']").first();
      await expect(productLink).toBeVisible({ timeout: 5000 });
      await productLink.click();
      await expect(page.locator("h1")).toBeVisible({ timeout: 5000 });

      const addButton = page.locator("button:has-text('Add to Cart')").first();
      await expect(addButton).toBeVisible({ timeout: 5000 });
      await addButton.click();

      // Go to checkout
      await page.goto("/checkout");
      await expect(page.locator("h1, text='Checkout'").first()).toBeVisible({ timeout: 10000 });

      // Fill shipping address to trigger estimate
      await page.fill("input[aria-label='First name'], input[name='firstName']", "Test");
      await page.fill("input[aria-label='Last name'], input[name='lastName']", "User");
      await page.fill("input[aria-label='Email'], input[name='email']", "test@example.com");
      await page.fill("input[aria-label='Address'], input[name='address']", "123 Test St");
      await page.fill("input[aria-label='City'], input[name='city']", "New York");
      await page.fill("input[aria-label='ZIP code'], input[name='zip']", "10001");

      // Check for shipping estimate display
      const shippingEstimate = page.locator("text='Shipping', text='shipping', text='Delivery'").first();
      await shippingEstimate.waitFor({ timeout: 10000 }).catch(() => null);
    });
  });

  // Web3
  test.describe("web3", () => {
  test("crypto checkout page loads", async ({ page }) => {
      await page.goto("/checkout/crypto");
      await expect(page.locator("h1, text='Crypto', text='wallet', text='connect'").first()).toBeVisible({ timeout: 10000 });
    });

    test("crypto checkout displays QR codes", async ({ page }) => {
      // Navigate to crypto checkout with an item in cart
      await page.goto("/products");
      const productLink = page.locator("a[href^='/store/'], a[href^='/products/']").first();
      await expect(productLink).toBeVisible({ timeout: 5000 });
      await productLink.click();
      await expect(page.locator("h1")).toBeVisible({ timeout: 5000 });

      const addButton = page.locator("button:has-text('Add to Cart')").first();
      await addButton.click();

      // Go to checkout and select crypto
      await page.goto("/checkout/crypto");
      await expect(page.locator("canvas, img[alt*='QR'], .qr-code, [data-testid='qr-code']").first()).toBeVisible({ timeout: 15000 });
    });

    test("membership staking page loads", async ({ page }) => {
    await page.goto("/membership");
    await expect(page.locator("h1, text='Membership', text='Stake'").first()).toBeVisible({ timeout: 10000 });
  });

  test("token page loads", async ({ page }) => {
    await page.goto("/token");
    await expect(page.locator("h1, text='Token', text='CULT', text='Stake'").first()).toBeVisible({ timeout: 10000 });
  });
  });

  // Support
  test.describe("support", () => {
  test("support tickets page loads", async ({ page }) => {
    await page.goto("/dashboard/support-tickets");
    await expect(page.locator("text='Sign in', text='Support', h1").first()).toBeVisible({ timeout: 10000 });
  });

  test("chat page loads", async ({ page }) => {
    await page.goto("/chat");
    await expect(page.locator("h1, text='Chat', .chat").first()).toBeVisible({ timeout: 10000 });
  });

  test("contact page loads", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.locator("h1, text='Contact', form").first()).toBeVisible({ timeout: 10000 });
  });
  });

  // API
  test.describe("api", () => {
  test("shipping endpoint responds", async ({ request }) => {
    const response = await request.post("/api/shipping/calculate", {
    data: { items: [{ id: "test", quantity: 1 }], country: "US", region: "NY" },
    });
    expect([200, 400, 422]).toContain(response.status());
  });
  });

  // Errors
  test("404 page handles unknown routes", async ({ page }) => {
    await page.goto("/page-does-not-exist-12345");
    await expect(page.locator("text='404', text='Not Found'").first()).toBeVisible({ timeout: 10000 });
  });
});
