/**
 * Helpers for phone case variant options: detect brand (iPhone / Samsung) and sort
 * models with latest first. Used to render a two-tier Brand → Model dropdown
 * instead of a long flat list of buttons.
 */

export type PhoneBrand = "iPhone" | "Samsung" | "Other";

/** Classify a variant value (e.g. "iPhone 16 Pro", "Samsung Galaxy S24") into a brand. */
export function getPhoneBrand(value: string): PhoneBrand {
  const v = value.trim();
  if (/^iPhone\s/i.test(v)) return "iPhone";
  if (/^Samsung\s/i.test(v)) return "Samsung";
  return "Other";
}

/**
 * Parse generation number for sorting (latest first).
 * - iPhone: "iPhone 17 Pro Max" -> 17, "iPhone 16" -> 16, "iPhone 6/6s" -> 6.
 * - Samsung: "Samsung Galaxy S25" -> 25, "Galaxy S24" -> 24.
 */
function parseGeneration(value: string, brand: PhoneBrand): number {
  if (brand === "iPhone") {
    const m = value.match(/iPhone\s+(\d+)/i);
    if (m) return parseInt(m[1]!, 10);
    // iPhone X, XR, XS, SE, etc. — put after numbered ones (lower rank = later in list when sorted desc)
    if (/iPhone\s+(X|XR|XS|SE)/i.test(value)) return 10; // treat as gen 10
    if (/iPhone\s+[78]/i.test(value)) return 8;
    if (/iPhone\s+6/i.test(value)) return 6;
    if (/iPhone\s+5/i.test(value)) return 5;
    return 0;
  }
  if (brand === "Samsung") {
    const m = value.match(/Galaxy\s+S(\d+)|S(\d+)\s|Samsung.*\sS(\d+)/i);
    const n = m ? parseInt(m[1] ?? m[2] ?? m[3] ?? "0", 10) : 0;
    if (n > 0) return n;
    if (/S6/i.test(value)) return 6;
    return 0;
  }
  return 0;
}

/**
 * Secondary sort within same generation: Pro Max > Pro > Plus > base > Mini.
 * Lower tierIndex = show first when generation is equal (we sort by -generation then tierIndex).
 */
function iphoneTierIndex(value: string): number {
  const v = value.toLowerCase();
  if (v.includes("pro max")) return 0;
  if (v.includes("pro") && !v.includes("max")) return 1;
  if (v.includes("plus")) return 2;
  if (v.includes("mini")) return 4;
  return 3; // base
}

/** Sort phone model values: latest generation first, then by tier (Pro Max before Pro, etc.). */
export function sortPhoneModelsLatestFirst(values: string[], brand: PhoneBrand): string[] {
  return [...values].sort((a, b) => {
    const genA = parseGeneration(a, brand);
    const genB = parseGeneration(b, brand);
    if (genB !== genA) return genB - genA; // higher generation first
    if (brand === "iPhone") {
      const tierA = iphoneTierIndex(a);
      const tierB = iphoneTierIndex(b);
      return tierA - tierB;
    }
    return a.localeCompare(b);
  });
}

/** Group variant values by brand. Returns only iPhone and Samsung; "Other" is excluded for the two-tier UI. */
export function groupPhoneModelsByBrand(
  values: string[],
): { brand: PhoneBrand; models: string[] }[] {
  const byBrand = new Map<PhoneBrand, string[]>();
  for (const v of values) {
    const brand = getPhoneBrand(v);
    if (brand === "Other") continue;
    if (!byBrand.has(brand)) byBrand.set(brand, []);
    byBrand.get(brand)!.push(v);
  }
  const result: { brand: PhoneBrand; models: string[] }[] = [];
  if (byBrand.has("iPhone"))
    result.push({
      brand: "iPhone",
      models: sortPhoneModelsLatestFirst(byBrand.get("iPhone")!, "iPhone"),
    });
  if (byBrand.has("Samsung"))
    result.push({
      brand: "Samsung",
      models: sortPhoneModelsLatestFirst(byBrand.get("Samsung")!, "Samsung"),
    });
  return result;
}

/**
 * Whether this option looks like "phone models": option name suggests device/model
 * and we have at least one iPhone or Samsung value (so brand + model dropdown makes sense).
 */
export function isPhoneModelsOption(optionName: string, values: string[]): boolean {
  const name = optionName.toLowerCase();
  if (!name.includes("phone") && !name.includes("model") && !name.includes("device")) return false;
  const brands = new Set(values.map(getPhoneBrand));
  return brands.has("iPhone") || brands.has("Samsung");
}
