"use client";

import * as React from "react";

import { cn } from "~/lib/cn";
import { useCountryCurrency } from "~/lib/hooks/use-country-currency";
import { isShippingExcluded } from "~/lib/shipping-restrictions";
import { sortClothingSizes } from "~/lib/sort-clothing-sizes";
import { useProductVariantImage } from "./product-variant-image-context";
import { ProductActions, ProductPriceDisplay } from "./product-detail-client";
import { SecureCheckoutLine } from "./secure-checkout-line";
import type { ProductOptionDefinition, ProductVariantOption } from "./types";

/** Map option definition to variant field: "color" | "size" | "gender". */
function getVariantKey(
  optionName: string,
  index: number,
): "color" | "size" | "gender" {
  const lower = optionName.toLowerCase();
  if (lower.includes("color")) return "color";
  if (lower.includes("size")) return "size";
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
}: ProductVariantSectionProps) {
  const [selectedByIndex, setSelectedByIndex] = React.useState<
    Record<number, string>
  >({});

  const unavailableInCountry = useUnavailableInCountry(product);

  // Use option definitions from API, or derive from variants when missing (e.g. after Printful sync fix)
  const optionDefinitions =
    optionDefinitionsProp.length > 0
      ? optionDefinitionsProp
      : hasVariants && variants.length > 1
        ? deriveOptionDefinitionsFromVariants(variants)
        : [];

  // No auto-selection: customer must choose size/color/etc. before adding to cart.

  const selectedVariant =
    hasVariants && optionDefinitions.length > 0 && variants.length > 0
      ? findVariant(variants, optionDefinitions, selectedByIndex)
      : null;

  const { setSelectedVariant } = useProductVariantImage();
  React.useEffect(() => {
    setSelectedVariant(
      selectedVariant
        ? { id: selectedVariant.id, imageUrl: selectedVariant.imageUrl }
        : null,
    );
  }, [selectedVariant, setSelectedVariant]);

  const displayPrice =
    selectedVariant != null ? selectedVariant.priceCents / 100 : product.price;
  const displayOriginalPrice = product.originalPrice;
  // Stock logic: if continueSellingWhenOutOfStock is true (POD products), always show in stock
  const displayInStock = product.continueSellingWhenOutOfStock
    ? true
    : selectedVariant != null
      ? (selectedVariant.stockQuantity ?? 0) > 0
      : product.inStock;

  const handleOptionSelect = (optionIndex: number, value: string) => {
    setSelectedByIndex((prev) => ({ ...prev, [optionIndex]: value }));
  };

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
            <p className="text-sm font-medium text-amber-600">
              Not available in your country
            </p>
          ) : product.inStock ? (
            <p className="text-sm font-medium text-green-600">
              Stock Available
            </p>
          ) : (
            <p className="text-sm font-medium text-red-500">Out of Stock</p>
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
        <SecureCheckoutLine />
      </>
    );
  }

  return (
    <>
      {/* Variant option rows */}
      <div className="mb-4 space-y-4">
        {optionDefinitions.map((opt, optionIndex) => (
          <div key={optionIndex}>
            <span className="mb-2 block text-sm font-medium text-foreground">
              {opt.name}
            </span>
            <div className="flex flex-wrap gap-2">
              {(opt.name === "Size" || opt.name.toLowerCase().includes("size")
                ? sortClothingSizes((opt.values ?? []).filter(Boolean))
                : (opt.values ?? []).filter(Boolean)
              ).map((value) => {
                const isSelected = selectedByIndex[optionIndex] === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleOptionSelect(optionIndex, value)}
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                      isSelected
                        ? "border-foreground bg-foreground text-background"
                        : "border-input bg-background hover:border-foreground/50 hover:bg-muted/50",
                    )}
                    aria-pressed={isSelected}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
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
          <p className="text-sm font-medium text-amber-600">
            Not available in your country
          </p>
        ) : displayInStock ? (
          <p className="text-sm font-medium text-green-600">Stock Available</p>
        ) : (
          <p className="text-sm font-medium text-red-500">Out of Stock</p>
        )}
      </div>

      {/* Add to cart with selected variant */}
      <div className="mb-6">
        <ProductActions
          product={{
            ...product,
            price: product.price,
            inStock: product.inStock,
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
        />
      </div>
      <div className="w-full min-w-0">
        <SecureCheckoutLine />
      </div>
    </>
  );
}
