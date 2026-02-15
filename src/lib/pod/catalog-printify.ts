/**
 * Printify catalog implementation for POD unified catalog.
 * Uses existing Printify API client to fetch blueprints and normalize to CatalogBlueprint.
 */

import {
  fetchPrintifyBlueprint,
  fetchPrintifyBlueprints,
  fetchPrintifyPrintProviders,
  fetchPrintifyVariants,
  type PrintifyBlueprint,
  type PrintifyVariant,
} from "@/lib/printify";

import type {
  CatalogBlueprint,
  CatalogVariant,
  PodProvider,
  PrintSpec,
} from "./types";

const PROVIDER: PodProvider = "printify";

function placeholderToPrintSpec(placeholder: {
  position: string;
  width: number;
  height: number;
}): PrintSpec {
  return {
    position: placeholder.position,
    width: placeholder.width,
    height: placeholder.height,
    dpi: 150,
  };
}

function variantToCatalogVariant(
  v: PrintifyVariant,
  costCents: number,
): CatalogVariant {
  const printSpecs = v.placeholders.map(placeholderToPrintSpec);
  const color = v.options?.color;
  const size = v.options?.size;
  return {
    id: v.id,
    title: v.title,
    color,
    size,
    priceCents: costCents,
    printSpecs,
  };
}

function blueprintToCatalogBlueprint(
  b: PrintifyBlueprint,
): Omit<CatalogBlueprint, "variants" | "printSpecs"> {
  return {
    provider: PROVIDER,
    id: String(b.id),
    title: b.title,
    brand: b.brand ?? "",
    description: b.description ?? "",
    images: b.images ?? [],
  };
}

/**
 * Fetch all Printify blueprints (list only, no variants/specs).
 */
export async function fetchPrintifyBlueprintsList(): Promise<
  CatalogBlueprint[]
> {
  const raw = await fetchPrintifyBlueprints();
  return raw.map((b) => ({
    ...blueprintToCatalogBlueprint(b),
    variants: [],
    printSpecs: [],
  }));
}

/**
 * Fetch a single Printify blueprint with full variants and print specs for a given print provider.
 */
export async function fetchPrintifyBlueprintWithSpecs(
  blueprintId: string,
  printProviderId: number,
): Promise<CatalogBlueprint> {
  const id = parseInt(blueprintId, 10);
  if (Number.isNaN(id)) {
    throw new Error(`Invalid Printify blueprint ID: ${blueprintId}`);
  }
  const [blueprint, variantsResponse] = await Promise.all([
    fetchPrintifyBlueprint(id),
    fetchPrintifyVariants(id, printProviderId),
  ]);

  const base = blueprintToCatalogBlueprint(blueprint);
  const printSpecsSet = new Map<string, PrintSpec>();
  const catalogVariants: CatalogVariant[] = variantsResponse.variants.map(
    (v) => {
      const cv = variantToCatalogVariant(v, 0);
      cv.printSpecs.forEach((ps) => printSpecsSet.set(ps.position, ps));
      return cv;
    },
  );

  const printSpecs = Array.from(printSpecsSet.values());
  return {
    ...base,
    printSpecs,
    variants: catalogVariants,
  };
}

/**
 * Fetch print providers for a blueprint (for dropdown when creating products).
 */
export async function getPrintifyPrintProviders(blueprintId: string) {
  const id = parseInt(blueprintId, 10);
  if (Number.isNaN(id)) return [];
  return fetchPrintifyPrintProviders(id);
}
