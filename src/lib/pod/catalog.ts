/**
 * Unified POD catalog interface.
 * Fetches blueprints/products from Printify and Printful and normalizes to CatalogBlueprint.
 */

import type { CatalogBlueprint, PodProvider } from "./types";

import {
  fetchPrintfulBlueprintWithSpecs,
  fetchPrintfulCatalogList,
} from "./catalog-printful";
import {
  fetchPrintifyBlueprintsList,
  fetchPrintifyBlueprintWithSpecs,
} from "./catalog-printify";

export interface FetchBlueprintsOptions {
  category?: string;
  limit?: number;
  offset?: number;
  provider?: "all" | PodProvider;
  search?: string;
}

/**
 * Fetch blueprints (product templates) from one or both providers.
 * Returns list view without full variant/spec details.
 */
export async function fetchBlueprints(
  options: FetchBlueprintsOptions = {},
): Promise<CatalogBlueprint[]> {
  const { limit = 50, offset = 0, provider = "all", search } = options;
  const results: CatalogBlueprint[] = [];

  if (provider === "printify" || provider === "all") {
    try {
      const list = await fetchPrintifyBlueprintsList();
      results.push(...list);
    } catch (err) {
      console.warn("Printify catalog fetch failed:", err);
    }
  }

  if (provider === "printful" || provider === "all") {
    try {
      const list = await fetchPrintfulCatalogList({ limit, offset });
      results.push(...list);
    } catch (err) {
      console.warn("Printful catalog fetch failed:", err);
    }
  }

  let filtered = results;
  if (search?.trim()) {
    const q = search.trim().toLowerCase();
    filtered = results.filter(
      (b) =>
        b.title.toLowerCase().includes(q) || b.brand.toLowerCase().includes(q),
    );
  }

  return filtered.slice(offset, offset + (limit ?? 50));
}

/**
 * Fetch a single blueprint with full print specs and variants.
 * For Printify, printProviderId is required.
 */
export async function fetchBlueprintWithSpecs(
  provider: PodProvider,
  blueprintId: string,
  printProviderId?: number,
): Promise<CatalogBlueprint> {
  if (provider === "printify") {
    if (printProviderId == null) {
      throw new Error("printProviderId is required for Printify blueprints");
    }
    return fetchPrintifyBlueprintWithSpecs(blueprintId, printProviderId);
  }
  return fetchPrintfulBlueprintWithSpecs(blueprintId);
}

/**
 * Search blueprints across providers (convenience wrapper).
 */
export async function searchBlueprints(
  query: string,
  providers: PodProvider[] = ["printify", "printful"],
): Promise<CatalogBlueprint[]> {
  const providerParam = providers.length === 2 ? "all" : providers[0];
  return fetchBlueprints({
    limit: 100,
    provider: providerParam as FetchBlueprintsOptions["provider"],
    search: query,
  });
}

export { getPrintifyPrintProviders } from "./catalog-printify";
