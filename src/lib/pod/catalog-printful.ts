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

import type {
  CatalogBlueprint,
  CatalogVariant,
  PodProvider,
  PrintSpec,
} from "./types";

const PROVIDER: PodProvider = "printful";

/** Default print area dimensions by product type (pixels at 150 DPI). */
const DEFAULT_PRINT_SPECS_BY_TYPE: Record<string, PrintSpec[]> = {
  default: [
    { dpi: 150, height: 4800, position: "front", width: 3600 },
    { dpi: 150, height: 4800, position: "back", width: 3600 },
  ],
  hoodie: [
    { dpi: 150, height: 4800, position: "front", width: 3600 },
    { dpi: 150, height: 5400, position: "back", width: 4500 },
  ],
  mug: [{ dpi: 150, height: 1155, position: "default", width: 2475 }],
  poster: [{ dpi: 150, height: 5400, position: "default", width: 3600 }],
  "t-shirt": [
    { dpi: 150, height: 4800, position: "front", width: 3600 },
    { dpi: 150, height: 4800, position: "back", width: 3600 },
    { dpi: 150, height: 900, position: "left_chest", width: 900 },
  ],
};

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
        color: v.color ?? undefined,
        id: v.id,
        priceCents,
        printSpecs,
        size: v.size ?? undefined,
        title: v.name,
      };
    }),
  );

  return {
    brand: product.brand ?? "",
    description: product.description ?? "",
    id: String(product.id),
    images: product.image ? [product.image] : [],
    printSpecs,
    provider: PROVIDER,
    title: product.name,
    variants: catalogVariants,
  };
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
    brand: p.brand ?? "",
    description: p.description ?? "",
    id: String(p.id),
    images: p.image ? [p.image] : [],
    printSpecs: getPrintSpecsForProduct(p),
    provider: PROVIDER,
    title: p.name,
    variants: [],
  }));
}

function getPrintSpecsForProduct(product: PrintfulCatalogProduct): PrintSpec[] {
  const key = productTypeKey(product.type);
  return (
    DEFAULT_PRINT_SPECS_BY_TYPE[key] ?? DEFAULT_PRINT_SPECS_BY_TYPE.default
  );
}

function productTypeKey(type: null | string): string {
  if (!type) return "default";
  const t = type.toLowerCase();
  if (t.includes("t-shirt") || t.includes("tee") || t.includes("shirt"))
    return "t-shirt";
  if (t.includes("hoodie") || t.includes("sweatshirt")) return "hoodie";
  if (t.includes("poster")) return "poster";
  if (t.includes("mug")) return "mug";
  return "default";
}
