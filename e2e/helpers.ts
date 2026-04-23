import { expect, type Page } from "@playwright/test";

/**
 * Shared smoke-test helpers. Prefer role/label/text locators over CSS selector
 * OR chains — they assert that the *right* element exists, not that *any*
 * element matching one of several selectors exists.
 */

/** Add the currently-displayed product to the cart. Requires the PDP shell. */
export async function addCurrentProductToCart(page: Page): Promise<void> {
  const addToCart = page.getByRole("button", { name: /add to cart/i }).first();
  await expect(addToCart).toBeVisible();
  await expect(addToCart).toBeEnabled();
  await addToCart.click();
}

/** Click the first PDP link from the products listing and wait for the page. */
export async function gotoFirstProduct(page: Page): Promise<void> {
  await page.goto("/products");
  const productLink = page.locator('a[href^="/products/"]').first();
  await expect(productLink).toBeVisible();
  await productLink.click();
  await expect(page.getByRole("heading").first()).toBeVisible();
}

/** Hostname PostHog will send to, honoring the Railway proxy override. */
export function posthogIngestHost(): string {
  return (
    process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() ||
    "https://albertjaynock.forthecult.store"
  );
}

/** True when PostHog is wired via `NEXT_PUBLIC_POSTHOG_KEY`. */
export function posthogIsEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim());
}
