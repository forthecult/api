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

/**
 * Fetch all Printify blueprints (list only, no variants/specs).
 */
export async function fetchPrintifyBlueprintsList(): Promise<
  CatalogBlueprint[]
> {
  const raw = await fetchPrintifyBlueprints();
  return raw.map((b) => ({
    ...blueprintToCatalogBlueprint(b),
    printSpecs: [],
    variants: [],
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

function blueprintToCatalogBlueprint(
  b: PrintifyBlueprint,
): Omit<CatalogBlueprint, "printSpecs" | "variants"> {
  return {
    brand: b.brand ?? "",
    description: b.description ?? "",
    id: String(b.id),
    images: b.images ?? [],
    provider: PROVIDER,
    title: b.title,
  };
}

function placeholderToPrintSpec(placeholder: {
  height: number;
  position: string;
  width: number;
}): PrintSpec {
  return {
    dpi: 150,
    height: placeholder.height,
    position: placeholder.position,
    width: placeholder.width,
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
    color,
    id: v.id,
    priceCents: costCents,
    printSpecs,
    size,
    title: v.title,
  };
}
