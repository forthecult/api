"use client";

import * as React from "react";

import { cn } from "~/lib/cn";
import { useCountryCurrency } from "~/lib/hooks/use-country-currency";
import { isShippingExcluded } from "~/lib/shipping-restrictions";
import {
  getPhoneBrand,
  groupPhoneModelsByBrand,
  isPhoneModelsOption,
  type PhoneBrand,
} from "~/lib/sort-phone-models";
import { sortClothingSizes } from "~/lib/sort-clothing-sizes";
import { useProductVariantImage } from "./product-variant-image-context";
import { ProductActions, ProductPriceDisplay } from "./product-detail-client";
import { SecureCheckoutLine } from "./secure-checkout-line";
import type { ProductOptionDefinition, ProductVariantOption } from "./types";

/** Map option definition to variant field: "color" | "size" | "gender" | "label". */
function getVariantKey(
  optionName: string,
  index: number,
): "color" | "size" | "gender" | "label" {
  const lower = optionName.toLowerCase();
  if (lower.includes("color") || lower.includes("finish")) return "color";
  if (lower.includes("size")) return "size";
  // Output, connection type, etc. are their own option type (stored in label, or size for legacy)
  if (
    lower.includes("output") ||
    lower.includes("connection") ||
    lower.includes("connector")
  )
    return "label";
  if (lower === "option") return "gender"; // neutral fallback when real label unknown (Grind, Device, etc.)
  if (
    lower.includes("men") ||
    lower.includes("women") ||
    lower.includes("gender") ||
    lower.includes("style") ||
    lower.includes("phone") ||
    lower.includes("model") ||
    lower.includes("device") ||
    lower.includes("grind")
  )
    return "gender";
  return index === 0 ? "color" : index === 1 ? "gender" : "size";
}

const SELECT_STYLES =
  "w-full min-w-0 rounded-md border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-2 text-sm text-[#F5F1EB] focus:border-[#C4873A] focus:outline-none focus:ring-1 focus:ring-[#C4873A]";

function PhoneModelDropdowns({
  groups,
  selectedValue,
  onSelect,
  findVariantForValue,
  continueSellingWhenOutOfStock,
}: {
  groups: { brand: PhoneBrand; models: string[] }[];
  optionIndex: number;
  selectedValue: string | undefined;
  onSelect: (value: string) => void;
  findVariantForValue: (value: string) => ProductVariantOption | null;
  continueSellingWhenOutOfStock?: boolean;
}) {
  const currentBrand = selectedValue
    ? getPhoneBrand(selectedValue)
    : groups[0]?.brand ?? null;
  const currentGroup = groups.find((g) => g.brand === currentBrand);
  const models = currentGroup?.models ?? [];
  const displayModel =
    selectedValue && currentGroup?.models.includes(selectedValue)
      ? selectedValue
      : models[0] ?? "";

  // Keep parent selection in sync when we're showing a fallback model (e.g. after brand switch or initial load)
  React.useEffect(() => {
    if (displayModel && displayModel !== selectedValue) onSelect(displayModel);
  }, [displayModel, selectedValue, onSelect]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex flex-col gap-1.5 sm:min-w-[10rem]">
        <label htmlFor="phone-brand" className="text-xs text-muted-foreground">
          Brand
        </label>
        <select
          id="phone-brand"
          value={currentBrand ?? ""}
          onChange={(e) => {
            const brand = e.target.value as PhoneBrand;
            const group = groups.find((g) => g.brand === brand);
            if (group?.models[0]) onSelect(group.models[0]);
          }}
          className={SELECT_STYLES}
          aria-label="Phone brand"
        >
          {groups.map((g) => (
            <option key={g.brand} value={g.brand}>
              {g.brand}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5 sm:min-w-[12rem]">
        <label htmlFor="phone-model" className="text-xs text-muted-foreground">
          Model
        </label>
        <select
          id="phone-model"
          value={displayModel}
          onChange={(e) => onSelect(e.target.value)}
          className={SELECT_STYLES}
          aria-label="Phone model"
        >
          {models.map((model) => {
            const variant = findVariantForValue(model);
            const outOfStock =
              !continueSellingWhenOutOfStock &&
              variant != null &&
              (variant.stockQuantity ?? 0) <= 0;
            return (
              <option
                key={model}
                value={model}
                disabled={outOfStock}
              >
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

/** Build a single display label for a variant (e.g. "Black / M" or "iPhone 16 Pro"). */
function getVariantDisplayLabel(v: ProductVariantOption): string {
  if (v.label?.trim()) return v.label.trim();
  const parts = [v.color, v.size, v.gender].filter(Boolean).map((s) => s!.trim());
  return parts.join(" / ") || "";
}

function findVariant(
  variants: ProductVariantOption[],
  optionDefinitions: ProductOptionDefinition[],
  selectedByIndex: Record<number, string>,
): ProductVariantOption | null {
  const selected = variants.find((v) => {
    return optionDefinitions.every((opt, idx) => {
      const value = selectedByIndex[idx];
      if (value == null) return false;
      if (opt.name === "Variant") return v.label === value;
      const key = getVariantKey(opt.name, idx);
      const variantValue =
        key === "color"
          ? v.color
          : key === "gender"
            ? v.gender
            : key === "label"
              ? (v.label ?? v.size)
              : v.size;
      return variantValue === value;
    });
  });
  return selected ?? null;
}

export interface ProductVariantSectionProps {
  product: {
    id: string;
    name: string;
    category: string;
    image: string;
    price: number;
    originalPrice?: number;
    inStock: boolean;
    /** When true, product can be purchased regardless of stock (POD/made-to-order). */
    continueSellingWhenOutOfStock?: boolean;
    slug?: string;
    /** When non-empty, product ships only to these countries (ISO 2-letter). */
    availableCountryCodes?: string[];
  };
  hasVariants: boolean;
  optionDefinitions: ProductOptionDefinition[];
  variants: ProductVariantOption[];
  /** Handling (fulfillment) days min from product for shipping estimate. */
  handlingDaysMin?: number | null;
  /** Handling (fulfillment) days max from product for shipping estimate. */
  handlingDaysMax?: number | null;
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

export function ProductVariantSection({
  product,
  hasVariants,
  optionDefinitions: optionDefinitionsProp,
  variants,
  handlingDaysMin,
  handlingDaysMax,
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
      ? findVariant(variants, optionDefinitions, selectedByIndex)
      : null;

  // Depend on primitive fields to avoid infinite re-renders from new object references
  const selectedVariantId = selectedVariant?.id ?? null;
  const selectedVariantImageUrl = selectedVariant?.imageUrl ?? null;

  const { setSelectedVariant } = useProductVariantImage();
  React.useEffect(() => {
    setSelectedVariant(
      selectedVariantId
        ? { id: selectedVariantId, imageUrl: selectedVariantImageUrl ?? undefined }
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
    let updates: Record<number, string> | null = null;
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
            price={product.price}
            originalPrice={product.originalPrice}
          />
        </div>
        <div aria-atomic="true" aria-live="polite" className="mb-6 mt-2">
          {unavailableInCountry ? (
            <p className="text-sm font-medium text-[#B5594E]">
              Not available in your country
            </p>
          ) : product.inStock ? (
            <p className="text-sm font-medium text-[#C4873A]">
              In Stock
            </p>
          ) : (
            <p className="text-sm font-medium text-[#B5594E]">Out of Stock</p>
          )}
        </div>
        <div className="mb-6">
          <ProductActions
            product={{
              ...product,
              price: product.price,
              inStock: product.inStock,
            }}
          />
        </div>
        <SecureCheckoutLine
          handlingDaysMin={handlingDaysMin}
          handlingDaysMax={handlingDaysMax}
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
          .filter(
            ({ opt }) => (opt.values ?? []).filter(Boolean).length > 1,
          )
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
                    groups={groups}
                    optionIndex={optionIndex}
                    selectedValue={selectedByIndex[optionIndex]}
                    onSelect={(value) => handleOptionSelect(optionIndex, value)}
                    findVariantForValue={(value) =>
                      findVariant(variants, optionDefinitions, {
                        ...selectedByIndex,
                        [optionIndex]: value,
                      })
                    }
                    continueSellingWhenOutOfStock={
                      product.continueSellingWhenOutOfStock
                    }
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
                        optionDefinitions,
                        testSelection,
                      );
                      const outOfStock =
                        !product.continueSellingWhenOutOfStock &&
                        variantForValue != null &&
                        (variantForValue.stockQuantity ?? 0) <= 0;
                      return (
                        <button
                          key={value}
                          type="button"
                          disabled={outOfStock}
                          onClick={() => handleOptionSelect(optionIndex, value)}
                          className={cn(
                            "rounded-md border px-3 py-2 text-sm font-medium transition-all duration-200",
                            isSelected
                              ? "border-[#C4873A] bg-[#C4873A] text-[#111111] shadow-sm shadow-[#C4873A]/20"
                              : outOfStock
                                ? "cursor-not-allowed border-[#2A2A2A] bg-[#1A1A1A] text-[#8A857E]/50"
                                : "border-[#2A2A2A] bg-[#1A1A1A] text-[#F5F1EB] hover:border-[#C4873A]/50 hover:bg-[#1E1E1E]",
                          )}
                          aria-pressed={isSelected}
                          aria-disabled={outOfStock}
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
          price={displayPrice}
          originalPrice={displayOriginalPrice}
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
            price: product.price,
            inStock: displayInStock,
          }}
          selectedVariant={
            selectedVariant
              ? {
                  id: selectedVariant.id,
                  priceCents: selectedVariant.priceCents,
                  stockQuantity: selectedVariant.stockQuantity,
                  imageUrl: selectedVariant.imageUrl,
                }
              : undefined
          }
          variantLabel={
            selectedVariant ? getVariantDisplayLabel(selectedVariant) : undefined
          }
          variantRequired
        />
      </div>
      <div className="w-full min-w-0">
        <SecureCheckoutLine
          handlingDaysMin={handlingDaysMin}
          handlingDaysMax={handlingDaysMax}
        />
      </div>
    </>
  );
}
