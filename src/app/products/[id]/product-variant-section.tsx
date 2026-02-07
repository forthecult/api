"use client";

import * as React from "react";

import { cn } from "~/lib/cn";
import { useCountryCurrency } from "~/lib/hooks/use-country-currency";
import { isShippingExcluded } from "~/lib/shipping-restrictions";
import { useProductVariantImage } from "./product-variant-image-context";
import { ProductActions, ProductPriceDisplay } from "./product-detail-client";
import { SecureCheckoutLine } from "./secure-checkout-line";
import type { ProductOptionDefinition, ProductVariantOption } from "./page";

/** Map option definition to variant field: "color" | "size". */
function getVariantKey(optionName: string, index: number): "color" | "size" {
  const lower = optionName.toLowerCase();
  if (lower.includes("color")) return "color";
  if (lower.includes("size")) return "size";
  return index === 0 ? "color" : "size";
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
      const key = getVariantKey(opt.name, idx);
      const variantValue = key === "color" ? v.color : v.size;
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

export function ProductVariantSection({
  product,
  hasVariants,
  optionDefinitions,
  variants,
}: ProductVariantSectionProps) {
  const [selectedByIndex, setSelectedByIndex] = React.useState<
    Record<number, string>
  >({});

  const unavailableInCountry = useUnavailableInCountry(product);

  // Initialize selection from first variant so we always have a valid combination
  React.useEffect(() => {
    if (!hasVariants || optionDefinitions.length === 0 || variants.length === 0)
      return;
    const first = variants[0];
    if (!first) return;
    const initial: Record<number, string> = {};
    optionDefinitions.forEach((opt, idx) => {
      const key = getVariantKey(opt.name, idx);
      const value = key === "color" ? first.color : first.size;
      if (value) initial[idx] = value;
    });
    setSelectedByIndex((prev) =>
      Object.keys(initial).length > 0 ? initial : prev,
    );
  }, [hasVariants, optionDefinitions, variants]);

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
              {(opt.values ?? []).filter(Boolean).map((value) => {
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
