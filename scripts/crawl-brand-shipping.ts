/**
 * Crawl brand websites for shipping info and create shipping_option rows by brand.
 *
 * Tries common shipping page paths (e.g. /pages/shipping, /shipping), parses
 * tables for region, order value, cost, and estimated delivery, then inserts
 * shipping options linked to the brand.
 *
 * Run: bun run db:crawl-brand-shipping
 *
 * Options (env):
 *   DRY_RUN=1  - Log what would be created, do not insert.
 *   BRAND_ID=  - Only crawl this brand id (optional).
 */

import "dotenv/config";

import * as cheerio from "cheerio";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";

import { db } from "../src/db";
import { brandTable, shippingOptionsTable } from "../src/db/schema";

const DRY_RUN = process.env.DRY_RUN === "1";
const BRAND_ID_FILTER = process.env.BRAND_ID?.trim() || null;

const SHIPPING_PATHS = [
  "/pages/shipping",
  "/shipping",
  "/pages/delivery",
  "/delivery",
  "/help/shipping",
  "/info/shipping",
  "/policies/shipping-policy",
];

const REGION_TO_COUNTRY: Record<string, string> = {
  us: "US",
  "united states": "US",
  usa: "US",
  canada: "CA",
  ca: "CA",
  uk: "GB",
  "united kingdom": "GB",
  gb: "GB",
  europe: "EU",
  eu: "EU",
  "hong kong": "HK",
  hk: "HK",
  international: null as unknown as string,
};

function normalizeRegion(s: string): string | null {
  const t = s.trim().toLowerCase().replace(/\s+/g, " ");
  return REGION_TO_COUNTRY[t] ?? REGION_TO_COUNTRY[t.replace(/&/g, " and ")] ?? null;
}

function parseDollars(s: string): number | null {
  const m = s.replace(/,/g, "").match(/\$?\s*([\d.]+)/);
  if (!m) return null;
  const n = Number.parseFloat(m[1]);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function parseMinOrderCents(s: string): number | null {
  const t = s.trim().toLowerCase();
  const over = /over\s*\$?\s*([\d.]+)/.exec(t);
  if (over) {
    const n = Number.parseFloat(over[1]);
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  }
  const min = /\$\s*([\d.]+)\s*\+?/.exec(t);
  if (min) {
    const n = Number.parseFloat(min[1]);
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  }
  return null;
}

function isFreeCost(s: string): boolean {
  const t = s.trim().toLowerCase();
  return t === "free" || t === "$0" || t === "0";
}

type ParsedOption = {
  name: string;
  countryCode: string | null;
  minOrderCents: number | null;
  maxOrderCents: number | null;
  type: "flat" | "free";
  amountCents: number | null;
  estimatedDaysText: string | null;
};

function parseMaxOrderCents(s: string): number | null {
  const t = s.trim().toLowerCase();
  const under = /under\s*\$?\s*([\d.]+)/.exec(t);
  if (under) {
    const n = Number.parseFloat(under[1]);
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  }
  return null;
}

function parseShippingTable(
  $: cheerio.CheerioAPI,
  brandName: string,
  sourceUrl: string,
): ParsedOption[] {
  const options: ParsedOption[] = [];
  const tables = $("table").toArray();

  for (const table of tables) {
    const rows = $(table).find("tr").toArray();
    if (rows.length < 2) continue;

    const headerCells = $(rows[0])
      .find("th, td")
      .toArray()
      .map((el) => $(el).text().trim().toLowerCase());
    const colRegion = headerCells.findIndex(
      (h) =>
        h.includes("region") ||
        h.includes("country") ||
        h.includes("shipping region"),
    );
    const colOrderValue = headerCells.findIndex(
      (h) =>
        h.includes("order") ||
        h.includes("value") ||
        h.includes("order value"),
    );
    const colCost = headerCells.findIndex(
      (h) => h.includes("cost") || h.includes("price") || h.includes("rate"),
    );
    const colEstimated = headerCells.findIndex(
      (h) =>
        h.includes("estimated") ||
        h.includes("delivery") ||
        h.includes("arrival") ||
        h.includes("days"),
    );

    if (colCost < 0 && colOrderValue < 0) continue;

    let currentRegion: string | null = null;
    let currentEstimated: string | null = null;

    for (let i = 1; i < rows.length; i++) {
      const cells = $(rows[i])
        .find("th, td")
        .toArray()
        .map((el) => $(el).text().trim());
      if (cells.length === 0) continue;

      // Rows can have fewer cells (e.g. continuation row: "Under $49", "$8.99")
      const isShortRow = cells.length <= 2;
      const regionText =
        !isShortRow && colRegion >= 0 && cells[colRegion] !== undefined
          ? cells[colRegion]
          : "";
      const orderValueText =
        colOrderValue >= 0 && cells[colOrderValue] !== undefined
          ? cells[colOrderValue]
          : isShortRow
            ? cells[0]
            : "";
      const costText =
        colCost >= 0 && cells[colCost] !== undefined
          ? cells[colCost]
          : isShortRow
            ? cells[1]
            : "";
      const estimatedText =
        !isShortRow &&
        colEstimated >= 0 &&
        cells[colEstimated] !== undefined
          ? cells[colEstimated]
          : "";

      if (regionText) {
        const code = normalizeRegion(regionText);
        if (code) currentRegion = code;
        else currentRegion = regionText.slice(0, 20);
      }
      if (estimatedText) currentEstimated = estimatedText.slice(0, 100);

      const minOrderCents = parseMinOrderCents(orderValueText);
      const maxOrderCents = parseMaxOrderCents(orderValueText);
      const free = isFreeCost(costText);
      const amountCents = free ? null : parseDollars(costText);

      if (!free && amountCents == null && !orderValueText) continue;
      if (
        free &&
        minOrderCents == null &&
        !orderValueText.toLowerCase().includes("over")
      )
        continue;

      const regionLabel = currentRegion || "General";
      const orderLabel =
        orderValueText ||
        (minOrderCents
          ? `Over $${(minOrderCents / 100).toFixed(0)}`
          : maxOrderCents
            ? `Under $${(maxOrderCents / 100).toFixed(0)}`
            : "");
      const name = `${brandName} ${regionLabel} ${orderLabel} ${free ? "Free" : costText}`.trim();
      options.push({
        name: name.slice(0, 255),
        countryCode:
          typeof currentRegion === "string" && currentRegion.length === 2
            ? currentRegion
            : null,
        minOrderCents,
        maxOrderCents: maxOrderCents ?? null,
        type: free ? "free" : "flat",
        amountCents,
        estimatedDaysText: currentEstimated,
      });
    }
  }

  return options;
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; BrandShippingCrawler/1.0; +https://github.com/relivator)",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

async function main() {
  console.log(DRY_RUN ? "[DRY RUN] No rows will be inserted.\n" : "");

  const brandCondition = BRAND_ID_FILTER
    ? eq(brandTable.id, BRAND_ID_FILTER)
    : undefined;
  const brands = await db
    .select({ id: brandTable.id, name: brandTable.name, websiteUrl: brandTable.websiteUrl })
    .from(brandTable)
    .where(brandCondition);

  const brandsWithUrl = brands.filter(
    (b) => typeof b.websiteUrl === "string" && b.websiteUrl.trim() !== "",
  );
  if (brandsWithUrl.length === 0) {
    console.log("No brands with websiteUrl found.");
    return;
  }

  for (const brand of brandsWithUrl) {
    const baseUrl = (brand.websiteUrl as string).replace(/\/+$/, "");
    let html: string | null = null;
    let resolvedUrl = "";

    for (const path of SHIPPING_PATHS) {
      const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
      html = await fetchHtml(url);
      if (html) {
        resolvedUrl = url;
        break;
      }
    }

    if (!html) {
      console.log(`[${brand.name}] No shipping page found.`);
      continue;
    }

    const $ = cheerio.load(html);
    const options = parseShippingTable($, brand.name, resolvedUrl);

    // Ensure worldwide fallback: if no option has countryCode null, add one so every country is covered
    const hasWorldwide = options.some((o) => o.countryCode == null);
    if (!hasWorldwide && options.length > 0) {
      options.push({
        name: `${brand.name} International`,
        countryCode: null,
        minOrderCents: null,
        maxOrderCents: null,
        type: "flat",
        amountCents: null,
        estimatedDaysText: "Varies by destination",
      });
    }
    if (options.length === 0) {
      // No table parsed: add a single worldwide option so the brand still ships everywhere
      options.push({
        name: `${brand.name} Worldwide`,
        countryCode: null,
        minOrderCents: null,
        maxOrderCents: null,
        type: "flat",
        amountCents: null,
        estimatedDaysText: null,
      });
      console.log(`[${brand.name}] No shipping table; added Worldwide fallback.`);
    } else {
      console.log(`[${brand.name}] ${resolvedUrl} → ${options.length} option(s)`);
    }

    const now = new Date();
    for (const opt of options) {
      const id = createId();
      const row = {
        id,
        name: opt.name,
        countryCode: opt.countryCode,
        minOrderCents: opt.minOrderCents,
        maxOrderCents: opt.maxOrderCents ?? null,
        minQuantity: null,
        maxQuantity: null,
        minWeightGrams: null,
        maxWeightGrams: null,
        type: opt.type,
        amountCents: opt.amountCents,
        priority: 0,
        brandId: brand.id,
        sourceUrl: resolvedUrl,
        estimatedDaysText: opt.estimatedDaysText,
        createdAt: now,
        updatedAt: now,
      };
      if (DRY_RUN) {
        console.log("  Would create:", row.name, opt.type, opt.amountCents != null ? `$${(opt.amountCents / 100).toFixed(2)}` : "Free");
      } else {
        await db.insert(shippingOptionsTable).values(row);
        console.log("  Created:", row.name);
      }
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
