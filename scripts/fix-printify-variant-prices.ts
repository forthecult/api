/**
 * Push all Printify product variant prices to Printify with the negative-margin fix:
 * every variant (enabled or disabled) gets price >= cost + 1 cent so no variant
 * shows negative margin in Printify.
 *
 * Run once after deploying the printify-sync fix, or whenever you see negative
 * margins in Printify.
 *
 * Run: cd webapp && NEXT_PUBLIC_APP_URL=https://forthecult.store ADMIN_AI_API_KEY=<key> bun run scripts/fix-printify-variant-prices.ts
 */

import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envLocal = resolve(process.cwd(), ".env.local");
if (existsSync(envLocal)) {
  dotenvConfig({ path: envLocal, override: true });
}

const API_BASE = (
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.MAIN_APP_URL ||
  "http://localhost:3000"
).replace(/\/$/, "");
const API_KEY =
  process.env.ADMIN_AI_API_KEY?.trim() || process.env.ADMIN_API_KEY?.trim();
if (!API_KEY) {
  console.error("Set ADMIN_AI_API_KEY or ADMIN_API_KEY.");
  process.exit(1);
}

const headers: Record<string, string> = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
};

async function main() {
  console.log("Pushing all Printify product prices (with margin fix)...");
  const res = await fetch(`${API_BASE}/api/admin/printify/sync`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "export_all" }),
  });
  if (!res.ok) {
    console.error("Failed:", res.status, await res.text());
    process.exit(1);
  }
  const data = (await res.json()) as {
    errors?: string[];
    success?: boolean;
    summary?: { errors: number; skipped: number; updated: number };
  };
  const summary = data.summary;
  if (summary) {
    console.log("Updated:", summary.updated, "| Skipped:", summary.skipped);
    if (summary.errors > 0) console.log("Errors count:", summary.errors);
  }
  if (data.errors?.length) console.error("Errors:", data.errors);
  console.log("Done. Check Printify; variant prices should be >= cost + 1¢.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
