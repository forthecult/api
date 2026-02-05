/**
 * Printful catalog implementation for POD unified catalog.
 * Uses Printful V2 catalog API. Print dimensions are derived from product type
 * (Printful Mockup Generator API can be added later for exact printfiles).
 */

import {
  fetchCatalogProduct,
  fetchCatalogProducts,
  fetchCatalogVariants,
  fetchVariantPrices,
  type PrintfulCatalogProduct,
  type PrintfulCatalogVariant,
} from "@/lib/printful";

import type { CatalogBlueprint, CatalogVariant, PodProvider, PrintSpec } from "./types";

const PROVIDER: PodProvider = "printful";

/** Default print area dimensions by product type (pixels at 150 DPI). */
const DEFAULT_PRINT_SPECS_BY_TYPE: Record<string, PrintSpec[]> = {
  default: [
    { position: "front", width: 3600, height: 4800, dpi: 150 },
    { position: "back", width: 3600, height: 4800, dpi: 150 },
  ],
  "t-shirt": [
    { position: "front", width: 3600, height: 4800, dpi: 150 },
    { position: "back", width: 3600, height: 4800, dpi: 150 },
    { position: "left_chest", width: 900, height: 900, dpi: 150 },
  ],
  hoodie: [
    { position: "front", width: 3600, height: 4800, dpi: 150 },
    { position: "back", width: 4500, height: 5400, dpi: 150 },
  ],
  poster: [{ position: "default", width: 3600, height: 5400, dpi: 150 }],
  mug: [{ position: "default", width: 2475, height: 1155, dpi: 150 }],
};

function productTypeKey(type: string | null): string {
  if (!type) return "default";
  const t = type.toLowerCase();
  if (t.includes("t-shirt") || t.includes("tee") || t.includes("shirt")) return "t-shirt";
  if (t.includes("hoodie") || t.includes("sweatshirt")) return "hoodie";
  if (t.includes("poster")) return "poster";
  if (t.includes("mug")) return "mug";
  return "default";
}

function getPrintSpecsForProduct(product: PrintfulCatalogProduct): PrintSpec[] {
  const key = productTypeKey(product.type);
  return DEFAULT_PRINT_SPECS_BY_TYPE[key] ?? DEFAULT_PRINT_SPECS_BY_TYPE.default;
}

/**
 * Fetch Printful catalog products (list) with optional pagination.
 */
export async function fetchPrintfulCatalogList(params?: {
  limit?: number;
  offset?: number;
}): Promise<CatalogBlueprint[]> {
  const limit = params?.limit ?? 50;
  const offset = params?.offset ?? 0;
  const res = await fetchCatalogProducts({ limit, offset });
  return res.data.map((p) => ({
    provider: PROVIDER,
    id: String(p.id),
    title: p.name,
    brand: p.brand ?? "",
    description: p.description ?? "",
    images: p.image ? [p.image] : [],
    printSpecs: getPrintSpecsForProduct(p),
    variants: [],
  }));
}

/**
 * Fetch a single Printful catalog product with variants and print specs.
 */
export async function fetchPrintfulBlueprintWithSpecs(
  catalogProductId: string,
): Promise<CatalogBlueprint> {
  const id = parseInt(catalogProductId, 10);
  if (Number.isNaN(id)) {
    throw new Error(`Invalid Printful catalog product ID: ${catalogProductId}`);
  }
  const [{ data: product }, variantsRes] = await Promise.all([
    fetchCatalogProduct(id),
    fetchCatalogVariants(id),
  ]);

  const printSpecs = getPrintSpecsForProduct(product);
  const catalogVariants: CatalogVariant[] = await Promise.all(
    variantsRes.data.map(async (v) => {
      let priceCents = 0;
      try {
        const priceRes = await fetchVariantPrices(v.id);
        const priceStr = priceRes.data?.variant?.techniques?.[0]?.price;
        if (priceStr) {
          priceCents = Math.round(parseFloat(priceStr) * 100);
        }
      } catch {
        // ignore price fetch errors
      }
      return {
        id: v.id,
        title: v.name,
        color: v.color ?? undefined,
        size: v.size ?? undefined,
        priceCents,
        printSpecs,
      };
    }),
  );

  return {
    provider: PROVIDER,
    id: String(product.id),
    title: product.name,
    brand: product.brand ?? "",
    description: product.description ?? "",
    images: product.image ? [product.image] : [],
    printSpecs,
    variants: catalogVariants,
  };
}
