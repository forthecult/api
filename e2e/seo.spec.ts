import { expect, test } from "@playwright/test";

/**
 * SEO canary. Validates JSON-LD structured data parses cleanly on surfaces
 * that drive organic conversion (PDP, homepage, products listing). Catches
 * template regressions, HTML injection into ld+json, and accidental deletion
 * of the `<StructuredData />` component.
 */

const SURFACES: readonly { name: string; path: string }[] = [
  { name: "homepage", path: "/" },
  { name: "products listing", path: "/products" },
];

for (const { name, path } of SURFACES) {
  test(`${name} emits valid JSON-LD`, async ({ page }) => {
    await page.goto(path);
    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();

    expect(blocks.length).toBeGreaterThan(0);
    for (const raw of blocks) {
      expect(() => JSON.parse(raw)).not.toThrow();
    }
  });
}

test("PDP exposes Product or ItemList schema", async ({ page }) => {
  await page.goto("/products");
  const firstProduct = page.locator('a[href^="/products/"]').first();
  await expect(firstProduct).toBeVisible();
  await firstProduct.click();
  await expect(page.getByRole("heading").first()).toBeVisible();

  const blocks = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  expect(blocks.length).toBeGreaterThan(0);

  const types = blocks.flatMap((raw) => {
    const parsed = JSON.parse(raw) as unknown;
    return extractTypes(parsed);
  });
  expect(types).toEqual(
    expect.arrayContaining([expect.stringMatching(/Product|ItemList/i)]),
  );
});

function extractTypes(node: unknown): string[] {
  if (node === null || typeof node !== "object") return [];
  const out: string[] = [];
  const obj = node as Record<string, unknown>;
  const t = obj["@type"];
  if (typeof t === "string") out.push(t);
  if (Array.isArray(t))
    for (const x of t) if (typeof x === "string") out.push(x);
  if (Array.isArray(obj["@graph"]))
    for (const child of obj["@graph"]) out.push(...extractTypes(child));
  if (Array.isArray(obj.itemListElement))
    for (const child of obj.itemListElement) out.push(...extractTypes(child));
  return out;
}
