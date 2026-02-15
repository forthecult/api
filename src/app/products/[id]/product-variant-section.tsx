"use client";

import * as React from "react";

import { cn } from "~/lib/cn";
import { useCountryCurrency } from "~/lib/hooks/use-country-currency";
import { isShippingExcluded } from "~/lib/shipping-restrictions";
import { sortClothingSizes } from "~/lib/sort-clothing-sizes";
import {
  getPhoneBrand,
  groupPhoneModelsByBrand,
  isPhoneModelsOption,
  type PhoneBrand,
} from "~/lib/sort-phone-models";

import type { ProductOptionDefinition, ProductVariantOption } from "./types";

import { ProductActions, ProductPriceDisplay } from "./product-detail-client";
import { useProductVariantImage } from "./product-variant-image-context";
import { SecureCheckoutLine } from "./secure-checkout-line";

const SELECT_STYLES =
  "w-full min-w-0 rounded-md border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-2 text-sm text-[#F5F1EB] focus:border-[#C4873A] focus:outline-none focus:ring-1 focus:ring-[#C4873A]";

export interface ProductVariantSectionProps {
  /** Handling (fulfillment) days max from product for shipping estimate. */
  handlingDaysMax?: null | number;
  /** Handling (fulfillment) days min from product for shipping estimate. */
  handlingDaysMin?: null | number;
  hasVariants: boolean;
  optionDefinitions: ProductOptionDefinition[];
  product: {
    /** When non-empty, product ships only to these countries (ISO 2-letter). */
    availableCountryCodes?: string[];
    category: string;
    /** When true, product can be purchased regardless of stock (POD/made-to-order). */
    continueSellingWhenOutOfStock?: boolean;
    id: string;
    image: string;
    inStock: boolean;
    name: string;
    originalPrice?: number;
    price: number;
    slug?: string;
  };
  variants: ProductVariantOption[];
}

export function ProductVariantSection({
  handlingDaysMax,
  handlingDaysMin,
  hasVariants,
  optionDefinitions: optionDefinitionsProp,
  product,
  variants,
}: ProductVariantSectionProps) {
  const unavailableInCountry = useUnavailableInCountry(product);

  // Use option definitions from API, or derive from variants when missing (e.g. after fulfillment sync)
  const optionDefinitions =
    optionDefinitionsProp.length > 0
      ? optionDefinitionsProp
      : hasVariants && variants.length > 1
        ? deriveOptionDefinitionsFromVariants(variants)
        : [];

  // Auto-select single-value options (e.g. only "White" for Color) so they are defaulted on the backend and hidden from the UI
  const [selectedByIndex, setSelectedByIndex] = React.useState<
    Record<number, string>
  >(() => {
    const initial: Record<number, string> = {};
    optionDefinitions.forEach((opt, idx) => {
      const values = (opt.values ?? []).filter(Boolean);
      if (values.length === 1) initial[idx] = values[0]!;
    });
    return initial;
  });

  // Options with only one value are hidden; customer selection defaults to that value. Multiple options (even if only one in stock) are always shown.

  const selectedVariant =
    hasVariants && optionDefinitions.length > 0 && variants.length > 0
      ? findVariant(variants, selectedByIndex)
      : null;

  // Depend on primitive fields to avoid infinite re-renders from new object references
  const selectedVariantId = selectedVariant?.id ?? null;
  const selectedVariantImageUrl = selectedVariant?.imageUrl ?? null;

  const { setSelectedVariant } = useProductVariantImage();
  React.useEffect(() => {
    setSelectedVariant(
      selectedVariantId
        ? {
            id: selectedVariantId,
            imageUrl: selectedVariantImageUrl ?? undefined,
          }
        : null,
    );
  }, [selectedVariantId, selectedVariantImageUrl, setSelectedVariant]);

  const displayPrice =
    selectedVariant != null ? selectedVariant.priceCents / 100 : product.price;
  const displayOriginalPrice = product.originalPrice;
  // Stock: POD always in stock; with variants, use selected variant stock or "any variant in stock"; otherwise product.inStock
  const displayInStock = product.continueSellingWhenOutOfStock
    ? true
    : selectedVariant != null
      ? (selectedVariant.stockQuantity ?? 0) > 0
      : variants.some((v) => (v.stockQuantity ?? 0) > 0);

  const handleOptionSelect = (optionIndex: number, value: string) => {
    setSelectedByIndex((prev) => ({ ...prev, [optionIndex]: value }));
  };

  // Default phone model option to first brand's latest model when unset (so dropdowns have a valid selection)
  React.useEffect(() => {
    let updates: null | Record<number, string> = null;
    optionDefinitions.forEach((opt, optionIndex) => {
      const values = (opt.values ?? []).filter(Boolean);
      if (values.length <= 1) return;
      if (!isPhoneModelsOption(opt.name, values)) return;
      const groups = groupPhoneModelsByBrand(values);
      const first = groups[0];
      if (first?.models[0]) {
        if (!updates) updates = {};
        updates[optionIndex] = first.models[0];
      }
    });
    if (updates) setSelectedByIndex((prev) => ({ ...prev, ...updates }));
    // Only run on mount so we don't override user selection when other options change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!hasVariants || optionDefinitions.length === 0 || variants.length === 0) {
    return (
      <>
        <div className="mt-2">
          <ProductPriceDisplay
            originalPrice={product.originalPrice}
            price={product.price}
          />
        </div>
        <div aria-atomic="true" aria-live="polite" className="mt-2 mb-6">
          {unavailableInCountry ? (
            <p className="text-sm font-medium text-[#B5594E]">
              Not available in your country
            </p>
          ) : product.inStock ? (
            <p className="text-sm font-medium text-[#C4873A]">In Stock</p>
          ) : (
            <p className="text-sm font-medium text-[#B5594E]">Out of Stock</p>
          )}
        </div>
        <div className="mb-6">
          <ProductActions
            product={{
              ...product,
              inStock: product.inStock,
              price: product.price,
            }}
          />
        </div>
        <SecureCheckoutLine
          handlingDaysMax={handlingDaysMax}
          handlingDaysMin={handlingDaysMin}
        />
      </>
    );
  }

  return (
    <>
      {/* Variant option rows: hide options with only one value (e.g. Color when only White); they are auto-selected and defaulted on the backend */}
      <div className="mb-4 space-y-4">
        {optionDefinitions
          .map((opt, optionIndex) => ({ opt, optionIndex }))
          .filter(({ opt }) => (opt.values ?? []).filter(Boolean).length > 1)
          .map(({ opt, optionIndex }) => {
            const values = (opt.values ?? []).filter(Boolean);
            const isPhoneModels = isPhoneModelsOption(opt.name, values);
            const groups = isPhoneModels ? groupPhoneModelsByBrand(values) : [];

            return (
              <div key={optionIndex}>
                <span className="mb-2 block text-sm font-medium text-foreground">
                  {opt.name}
                </span>
                {isPhoneModels && groups.length > 0 ? (
                  <PhoneModelDropdowns
                    continueSellingWhenOutOfStock={
                      product.continueSellingWhenOutOfStock
                    }
                    findVariantForValue={(value) =>
                      findVariant(variants, {
                        ...selectedByIndex,
                        [optionIndex]: value,
                      })
                    }
                    groups={groups}
                    onSelect={(value) => handleOptionSelect(optionIndex, value)}
                    optionIndex={optionIndex}
                    selectedValue={selectedByIndex[optionIndex]}
                  />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(opt.name === "Size" ||
                    opt.name.toLowerCase().includes("size")
                      ? sortClothingSizes(values)
                      : values
                    ).map((value) => {
                      const isSelected = selectedByIndex[optionIndex] === value;
                      const testSelection = {
                        ...selectedByIndex,
                        [optionIndex]: value,
                      };
                      const variantForValue = findVariant(
                        variants,
                        testSelection,
                      );
                      const outOfStock =
                        !product.continueSellingWhenOutOfStock &&
                        variantForValue != null &&
                        (variantForValue.stockQuantity ?? 0) <= 0;
                      return (
                        <button
                          aria-disabled={outOfStock}
                          aria-pressed={isSelected}
                          className={cn(
                            `
                              rounded-md border px-3 py-2 text-sm font-medium
                              transition-all duration-200
                            `,
                            isSelected
                              ? `
                                border-[#C4873A] bg-[#C4873A] text-[#111111]
                                shadow-sm shadow-[#C4873A]/20
                              `
                              : outOfStock
                                ? `
                                  cursor-not-allowed border-[#2A2A2A]
                                  bg-[#1A1A1A] text-[#8A857E]/50
                                `
                                : `
                                  border-[#2A2A2A] bg-[#1A1A1A] text-[#F5F1EB]
                                  hover:border-[#C4873A]/50 hover:bg-[#1E1E1E]
                                `,
                          )}
                          disabled={outOfStock}
                          key={value}
                          onClick={() => handleOptionSelect(optionIndex, value)}
                          type="button"
                        >
                          {value}
                          {outOfStock && (
                            <span className="ml-1 text-sm">(out of stock)</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Variant-specific price */}
      <div className="mb-2">
        <ProductPriceDisplay
          originalPrice={displayOriginalPrice}
          price={displayPrice}
        />
      </div>

      {/* Stock / country availability */}
      <div aria-atomic="true" aria-live="polite" className="mb-6">
        {unavailableInCountry ? (
          <p className="text-sm font-medium text-[#B5594E]">
            Not available in your country
          </p>
        ) : displayInStock ? (
          <p className="text-sm font-medium text-[#C4873A]">In Stock</p>
        ) : (
          <p className="text-sm font-medium text-[#B5594E]">Out of Stock</p>
        )}
      </div>

      {/* Add to cart with selected variant */}
      <div className="mb-6">
        <ProductActions
          product={{
            ...product,
            inStock: displayInStock,
            price: product.price,
          }}
          selectedVariant={
            selectedVariant
              ? {
                  id: selectedVariant.id,
                  imageUrl: selectedVariant.imageUrl,
                  priceCents: selectedVariant.priceCents,
                  stockQuantity: selectedVariant.stockQuantity,
                }
              : undefined
          }
          variantLabel={
            selectedVariant
              ? getVariantDisplayLabel(selectedVariant)
              : undefined
          }
          variantRequired
        />
      </div>
      <div className="w-full min-w-0">
        <SecureCheckoutLine
          handlingDaysMax={handlingDaysMax}
          handlingDaysMin={handlingDaysMin}
        />
      </div>
    </>
  );
}

/** Build option definitions from variant size/color/label when optionDefinitions are missing (e.g. legacy sync). */
function deriveOptionDefinitionsFromVariants(
  variants: ProductVariantOption[],
): ProductOptionDefinition[] {
  const sizeValues = new Set<string>();
  const colorValues = new Set<string>();
  const otherOptionValues = new Set<string>();
  const labelValues = new Set<string>();
  for (const v of variants) {
    if (v.size?.trim()) sizeValues.add(v.size.trim());
    if (v.color?.trim()) colorValues.add(v.color.trim());
    if (v.gender?.trim()) otherOptionValues.add(v.gender.trim());
    if (v.label?.trim()) labelValues.add(v.label.trim());
  }
  const opts: ProductOptionDefinition[] = [];
  if (colorValues.size > 0)
    opts.push({ name: "Color", values: [...colorValues].sort() });
  // "gender" column holds any "other" option (Grind, Device, Model, etc.) — use neutral label until re-sync restores real name
  if (otherOptionValues.size > 0)
    opts.push({ name: "Option", values: [...otherOptionValues].sort() });
  if (sizeValues.size > 0)
    opts.push({ name: "Size", values: sortClothingSizes([...sizeValues]) });
  if (opts.length === 0 && labelValues.size > 0)
    opts.push({ name: "Variant", values: [...labelValues].sort() });
  return opts;
}

/**
 * Find variant by matching the set of selected option values to the variant's
 * field values. Option names (Brand, Model, Finishes, etc.) are not tied to
 * specific columns — any option values can live in color/size/gender/label.
 * Uses set equality when sizes match; otherwise allows variant set to be a
 * subset of selected (e.g. UI has Brand + Model but variant only stores full model name).
 */
function findVariant(
  variants: ProductVariantOption[],
  selectedByIndex: Record<number, string>,
): null | ProductVariantOption {
  const selectedSet = new Set(
    Object.values(selectedByIndex)
      .filter(Boolean)
      .map((s) => String(s).trim()),
  );
  if (selectedSet.size === 0) return null;
  // Exact match: variant's values exactly equal selected
  const match = variants.find((v) => {
    const variantSet = getVariantValueSet(v);
    if (variantSet.size !== selectedSet.size) return false;
    for (const s of selectedSet) {
      if (!variantSet.has(s)) return false;
    }
    return true;
  });
  if (match) return match;
  // Subset match: variant's values all appear in selected (e.g. Brand+Model in UI, variant has only model name)
  let best: null | ProductVariantOption = null;
  let bestSize = 0;
  for (const v of variants) {
    const variantSet = getVariantValueSet(v);
    if (variantSet.size > bestSize && variantSet.size <= selectedSet.size) {
      let allIn = true;
      for (const x of variantSet) {
        if (!selectedSet.has(x)) {
          allIn = false;
          break;
        }
      }
      if (allIn) {
        best = v;
        bestSize = variantSet.size;
      }
    }
  }
  return best;
}

/** Build a single display label for a variant (e.g. "Black / M" or "iPhone 16 Pro"). */
function getVariantDisplayLabel(v: ProductVariantOption): string {
  if (v.label?.trim()) return v.label.trim();
  const parts = [v.color, v.size, v.gender]
    .filter(Boolean)
    .map((s) => s!.trim());
  return parts.join(" / ") || "";
}

/** Set of non-empty variant field values. Splits combined values like "Charcoal Heather / L" so they match UI selections. */
function getVariantValueSet(v: ProductVariantOption): Set<string> {
  const parts: string[] = [];
  for (const raw of [v.color, v.size, v.gender, v.label]) {
    if (raw == null || String(raw).trim() === "") continue;
    const s = String(raw).trim();
    for (const p of s.split(/\s*\/\s*/)) {
      const t = p.trim();
      if (t) parts.push(t);
    }
  }
  return new Set(parts);
}

function PhoneModelDropdowns({
  continueSellingWhenOutOfStock,
  findVariantForValue,
  groups,
  onSelect,
  selectedValue,
}: {
  continueSellingWhenOutOfStock?: boolean;
  findVariantForValue: (value: string) => null | ProductVariantOption;
  groups: { brand: PhoneBrand; models: string[] }[];
  onSelect: (value: string) => void;
  optionIndex: number;
  selectedValue: string | undefined;
}) {
  const currentBrand = selectedValue
    ? getPhoneBrand(selectedValue)
    : (groups[0]?.brand ?? null);
  const currentGroup = groups.find((g) => g.brand === currentBrand);
  const models = currentGroup?.models ?? [];
  const displayModel =
    selectedValue && currentGroup?.models.includes(selectedValue)
      ? selectedValue
      : (models[0] ?? "");

  // Keep parent selection in sync when we're showing a fallback model (e.g. after brand switch or initial load)
  React.useEffect(() => {
    if (displayModel && displayModel !== selectedValue) onSelect(displayModel);
  }, [displayModel, selectedValue, onSelect]);

  return (
    <div
      className={`
      flex flex-col gap-3
      sm:flex-row sm:items-center
    `}
    >
      <div
        className={`
        flex flex-col gap-1.5
        sm:min-w-[10rem]
      `}
      >
        <label className="text-xs text-muted-foreground" htmlFor="phone-brand">
          Brand
        </label>
        <select
          aria-label="Phone brand"
          className={SELECT_STYLES}
          id="phone-brand"
          onChange={(e) => {
            const brand = e.target.value as PhoneBrand;
            const group = groups.find((g) => g.brand === brand);
            if (group?.models[0]) onSelect(group.models[0]);
          }}
          value={currentBrand ?? ""}
        >
          {groups.map((g) => (
            <option key={g.brand} value={g.brand}>
              {g.brand}
            </option>
          ))}
        </select>
      </div>
      <div
        className={`
        flex flex-col gap-1.5
        sm:min-w-[12rem]
      `}
      >
        <label className="text-xs text-muted-foreground" htmlFor="phone-model">
          Model
        </label>
        <select
          aria-label="Phone model"
          className={SELECT_STYLES}
          id="phone-model"
          onChange={(e) => onSelect(e.target.value)}
          value={displayModel}
        >
          {models.map((model) => {
            const variant = findVariantForValue(model);
            const outOfStock =
              !continueSellingWhenOutOfStock &&
              variant != null &&
              (variant.stockQuantity ?? 0) <= 0;
            return (
              <option disabled={outOfStock} key={model} value={model}>
                {model}
                {outOfStock ? " (out of stock)" : ""}
              </option>
            );
          })}
        </select>
      </div>
    </div>
  );
}

/** Same country-availability logic as ProductActions: excluded globally or product restricted and current country not in list. */
function useUnavailableInCountry(product: {
  availableCountryCodes?: string[];
}) {
  const { selectedCountry: footerCountry } = useCountryCurrency();
  const allowedCountries = product.availableCountryCodes ?? [];
  const hasCountryRestriction = allowedCountries.length > 0;
  const currentCountryUpper =
    footerCountry?.trim().toUpperCase().slice(0, 2) ?? "";
  const notInAllowedCountries =
    hasCountryRestriction &&
    currentCountryUpper.length === 2 &&
    !allowedCountries.some(
      (c) => c?.trim().toUpperCase().slice(0, 2) === currentCountryUpper,
    );
  return (
    (currentCountryUpper.length === 2 &&
      isShippingExcluded(currentCountryUpper)) ||
    notInAllowedCountries
  );
}
