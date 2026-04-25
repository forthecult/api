import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Accessibility smoke. Blocks net-new WCAG 2.1 A / AA violations on
 * conversion-critical surfaces. Keeps the rule set narrow — this is a smoke,
 * not a full audit — and excludes known third-party widgets we do not own.
 */

const SURFACES: readonly { name: string; path: string }[] = [
  { name: "homepage", path: "/" },
  { name: "products", path: "/products" },
  { name: "checkout", path: "/checkout" },
  { name: "login", path: "/login" },
];

for (const { name, path } of SURFACES) {
  test(`${name} has no WCAG A/AA violations`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading").first()).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      // Third-party embeds (chat widget, payment iframes) live outside our
      // control. Scope the scan to app-owned roots.
      .exclude("iframe")
      .analyze();

    expect(results.violations, formatViolations(results.violations)).toEqual(
      [],
    );
  });
}

function formatViolations(
  violations: readonly {
    id: string;
    impact?: null | string;
    nodes: unknown[];
  }[],
): string {
  if (violations.length === 0) return "";
  return violations
    .map((v) => `${v.impact ?? "minor"}: ${v.id} (${v.nodes.length} nodes)`)
    .join("\n");
}
