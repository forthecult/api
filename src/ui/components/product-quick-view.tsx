"use client";

import {
  ExternalLink,
  Eye,
  Heart,
  Minus,
  Plus,
  ShoppingCart,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { cn } from "~/lib/cn";
import { useCart } from "~/lib/hooks/use-cart";
import { sanitizeProductDescription } from "~/lib/sanitize-product-description";
import { useCountryCurrency } from "~/lib/hooks/use-country-currency";
import { useWishlist } from "~/lib/hooks/use-wishlist";
import { isShippingExcluded } from "~/lib/shipping-restrictions";
import { sortClothingSizes } from "~/lib/sort-clothing-sizes";
import {
  getPhoneBrand,
  groupPhoneModelsByBrand,
  isPhoneModelsOption,
  type PhoneBrand,
} from "~/lib/sort-phone-models";
import { CryptoPrice } from "~/ui/components/CryptoPrice";
import { FiatPrice } from "~/ui/components/FiatPrice";
import { Badge } from "~/ui/primitives/badge";
import { Button } from "~/ui/primitives/button";
import { Dialog, DialogContent, DialogTitle } from "~/ui/primitives/dialog";
import { Skeleton } from "~/ui/primitives/skeleton";

/* -------------------------------------------------------------------------- */
/*                                   Types                                     */
/* -------------------------------------------------------------------------- */

interface OptionDefinition {
  name: string;
  values: string[];
}

interface ProductQuickViewProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  /** Slug or ID of the product to preview. */
  productSlugOrId: null | string;
}

interface QuickViewProduct {
  availableCountryCodes?: string[];
  category: string;
  compareAtPriceCents?: number;
  description?: string;
  features?: string[];
  hasVariants: boolean;
  id: string;
  images?: string[];
  imageUrl?: string;
  inStock: boolean;
  name: string;
  optionDefinitions?: OptionDefinition[];
  price: { usd: number };
  slug?: string;
  variants?: QuickViewVariant[];
}

interface QuickViewVariant {
  color?: string;
  gender?: string;
  id: string;
  imageUrl?: string;
  label?: string;
  priceCents: number;
  size?: string;
  stockQuantity?: number;
}

/* -------------------------------------------------------------------------- */
/*                              Mini Gallery                                   */
/* -------------------------------------------------------------------------- */

export function ProductQuickView({
  onOpenChange,
  open,
  productSlugOrId,
}: ProductQuickViewProps) {
  const { addItem } = useCart();
  const { addToWishlist, isInWishlist, removeFromWishlist } = useWishlist();

  const [product, setProduct] = React.useState<null | QuickViewProduct>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<null | string>(null);
  const [selectedVariant, setSelectedVariant] =
    React.useState<null | QuickViewVariant>(null);
  const [quantity, setQuantity] = React.useState(1);
  const [isAdding, setIsAdding] = React.useState(false);

  // Fetch product data when opened
  React.useEffect(() => {
    if (!open || !productSlugOrId) {
      setProduct(null);
      setError(null);
      setSelectedVariant(null);
      setQuantity(1);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/products/${encodeURIComponent(productSlugOrId)}`, {
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Product not found");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setProduct(data as QuickViewProduct);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load product",
          );
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, productSlugOrId]);

  // Country availability check (same logic as product-variant-section)
  const { selectedCountry: footerCountry } = useCountryCurrency();
  const unavailableInCountry = React.useMemo(() => {
    if (!product) return false;
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
  }, [product, footerCountry]);

  const inWishlist = product ? isInWishlist(product.id) : false;

  const currentPrice = selectedVariant
    ? selectedVariant.priceCents / 100
    : (product?.price.usd ?? 0);
  const originalPrice =
    product?.compareAtPriceCents != null
      ? product.compareAtPriceCents / 100
      : undefined;
  const discount =
    originalPrice && originalPrice > currentPrice
      ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
      : 0;

  const variantRequired =
    product?.hasVariants && (product.optionDefinitions?.length ?? 0) > 0;

  const handleAddToCart = React.useCallback(() => {
    if (!product) return;
    if (variantRequired && !selectedVariant) return;
    setIsAdding(true);

    const lineId = selectedVariant
      ? `${product.id}__${selectedVariant.id}`
      : product.id;
    const variantLabel = selectedVariant
      ? selectedVariant.label?.trim() ||
        [selectedVariant.color, selectedVariant.size, selectedVariant.gender]
          .filter(Boolean)
          .map((s) => s!.trim())
          .join(" / ") ||
        ""
      : undefined;
    addItem(
      {
        category: product.category,
        id: lineId,
        ...(selectedVariant && {
          productId: product.id,
          productVariantId: selectedVariant.id,
          ...(variantLabel && { variantLabel }),
        }),
        image:
          selectedVariant?.imageUrl ?? product.imageUrl ?? "/placeholder.svg",
        name: product.name,
        price: currentPrice,
        ...(product.slug && { slug: product.slug }),
      },
      quantity,
    );
    toast.success(`${product.name} added to cart`);
    setQuantity(1);
    setTimeout(() => setIsAdding(false), 300);
  }, [
    product,
    selectedVariant,
    variantRequired,
    addItem,
    currentPrice,
    quantity,
  ]);

  const handleWishlistToggle = React.useCallback(async () => {
    if (!product) return;
    if (inWishlist) {
      const result = await removeFromWishlist(product.id);
      if (result.ok) toast.success("Removed from wishlist");
      else toast.error(result.error ?? "Could not remove");
    } else {
      const result = await addToWishlist(product.id);
      if (result.ok) toast.success("Added to wishlist");
      else {
        if (result.error?.toLowerCase().includes("unauthorized"))
          toast.error("Sign in to add to wishlist");
        else toast.error(result.error ?? "Could not add");
      }
    }
  }, [product, inWishlist, addToWishlist, removeFromWishlist]);

  const productUrl = product ? `/${product.slug ?? product.id}` : "#";

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        aria-describedby={undefined}
        className={cn(
          `
            max-w-[calc(100vw-2rem)] gap-0 overflow-hidden rounded-xl border p-0
            shadow-2xl
          `,
          "sm:max-w-4xl",
          `
            data-[state=open]:animate-in data-[state=open]:fade-in-0
            data-[state=open]:zoom-in-95
          `,
          `
            data-[state=closed]:animate-out data-[state=closed]:fade-out-0
            data-[state=closed]:zoom-out-95
          `,
          "quickview-dialog",
          "[&_[data-slot=dialog-close]]:flex [&_[data-slot=dialog-close]]:items-center [&_[data-slot=dialog-close]]:justify-center",
          "[&_[data-slot=dialog-close]]:size-9 [&_[data-slot=dialog-close]]:rounded-full",
          "[&_[data-slot=dialog-close]]:border [&_[data-slot=dialog-close]]:border-border",
          "[&_[data-slot=dialog-close]]:bg-background [&_[data-slot=dialog-close]]:opacity-100",
          "[&_[data-slot=dialog-close]]:shadow-md",
          "sm:[&_[data-slot=dialog-close]]:size-8",
          "sm:[&_[data-slot=dialog-close]]:border-0 sm:[&_[data-slot=dialog-close]]:bg-transparent sm:[&_[data-slot=dialog-close]]:shadow-none",
          "[&_[data-slot=dialog-close]]:hover:bg-muted",
          "sm:[&_[data-slot=dialog-close]]:hover:bg-accent",
        )}
      >
        <DialogTitle className="sr-only">
          {product?.name ?? "Quick View"}
        </DialogTitle>

        {loading && <QuickViewSkeleton />}

        {error && (
          <div
            className={`
            flex flex-col items-center justify-center gap-4 px-6 py-16
            text-center
          `}
          >
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button
              onClick={() => onOpenChange(false)}
              size="sm"
              variant="outline"
            >
              Close
            </Button>
          </div>
        )}

        {product &&
          !loading &&
          (() => {
            const baseImages = (
              product.images ?? (product.imageUrl ? [product.imageUrl] : [])
            ).filter(Boolean) as string[];
            const variantImage = selectedVariant?.imageUrl?.trim();
            const galleryImages = variantImage
              ? [
                  variantImage,
                  ...baseImages.filter((u) => u?.trim() !== variantImage),
                ]
              : baseImages.length > 0
                ? baseImages
                : ["/placeholder.svg"];
            return (
              <div
                className={`
                flex max-h-[90vh] flex-col
                md:flex-row
              `}
              >
                {/* Left: image gallery — show selected variant image when it has one */}
                <div
                  className={`
                  w-full shrink-0 bg-muted/30
                  md:max-h-[90vh] md:w-[48%]
                `}
                >
                  <div
                    className={`
                    sticky top-0 p-4
                    md:p-5
                  `}
                  >
                    <MiniGallery
                      images={galleryImages}
                      productName={product.name}
                    />
                  </div>
                </div>

                {/* Right: details — scrollable (pr/pt leave room for dialog close button) */}
                <div
                  className={`
                  flex flex-1 flex-col overflow-y-auto pt-14 pr-14
                  md:max-h-[90vh]
                `}
                >
                  <div
                    className={`
                    flex flex-col gap-4 px-6 pb-6
                    md:gap-5 md:px-8 md:pb-8
                  `}
                  >
                    {/* Category + badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="font-medium" variant="secondary">
                        {product.category}
                      </Badge>
                      {discount > 0 && (
                        <Badge variant="destructive">{discount}% OFF</Badge>
                      )}
                      {!product.inStock && (
                        <Badge variant="destructive">Out of Stock</Badge>
                      )}
                    </div>

                    {/* Product title */}
                    <h2
                      className={`
                      text-xl leading-tight font-semibold tracking-tight
                      md:text-2xl
                    `}
                    >
                      {product.name}
                    </h2>

                    {/* Price */}
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <FiatPrice
                          className={`
                            text-2xl font-bold
                            md:text-3xl
                          `}
                          usdAmount={currentPrice}
                        />
                        {originalPrice && originalPrice > currentPrice && (
                          <FiatPrice
                            className={`
                              text-base text-muted-foreground line-through
                            `}
                            usdAmount={originalPrice}
                          />
                        )}
                      </div>
                      <CryptoPrice
                        className="text-sm text-muted-foreground"
                        usdAmount={currentPrice}
                      />
                    </div>

                    {/* Country availability */}
                    {unavailableInCountry && (
                      <p className="text-sm font-medium text-[#B5594E]">
                        Not available in your country
                      </p>
                    )}

                    {/* Features */}
                    {product.features && product.features.length > 0 && (
                      <ul className="space-y-1.5 text-sm text-muted-foreground">
                        {product.features.slice(0, 4).map((f, i) => (
                          <li className="flex items-start gap-2" key={i}>
                            <span
                              className={`
                              mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full
                              bg-primary
                            `}
                            />
                            {f}
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Description — sanitized HTML so inline tags (e.g. from Printify) render correctly */}
                    {product.description && (
                      <div
                        className={`
                        line-clamp-4 text-sm leading-relaxed
                        text-muted-foreground
                        [&_a]:underline [&_a]:hover:no-underline
                      `}
                        dangerouslySetInnerHTML={{
                          __html: sanitizeProductDescription(
                            product.description,
                          ),
                        }}
                      />
                    )}

                    {/* Variant selector — key by product id so state resets when opening a different product */}
                    {variantRequired &&
                      product.optionDefinitions &&
                      product.variants && (
                        <VariantSelector
                          key={product.id}
                          onSelectVariant={setSelectedVariant}
                          optionDefinitions={product.optionDefinitions}
                          selectedVariant={selectedVariant}
                          variants={product.variants}
                        />
                      )}

                    {/* Quantity + Add to Cart row */}
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <div
                        className={`
                        flex items-center rounded-lg border border-input
                      `}
                      >
                        <Button
                          aria-label="Decrease quantity"
                          className="h-10 w-10 rounded-r-none"
                          disabled={quantity <= 1}
                          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                          size="icon"
                          variant="ghost"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span
                          className={`
                          min-w-[2.5rem] text-center text-sm font-medium
                          tabular-nums
                        `}
                        >
                          {quantity}
                        </span>
                        <Button
                          aria-label="Increase quantity"
                          className="h-10 w-10 rounded-l-none"
                          onClick={() => setQuantity((q) => q + 1)}
                          size="icon"
                          variant="ghost"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>

                      <Button
                        className="min-w-[140px] flex-1 gap-2"
                        disabled={
                          !product.inStock ||
                          isAdding ||
                          unavailableInCountry ||
                          (variantRequired && !selectedVariant)
                        }
                        onClick={handleAddToCart}
                        size="lg"
                      >
                        <ShoppingCart className="h-4 w-4" />
                        {unavailableInCountry
                          ? "Unavailable"
                          : isAdding
                            ? "Adding…"
                            : variantRequired && !selectedVariant
                              ? "Select options"
                              : "Add to Cart"}
                      </Button>

                      <Button
                        aria-label={
                          inWishlist
                            ? "Remove from wishlist"
                            : "Add to wishlist"
                        }
                        className="h-10 w-10 shrink-0"
                        onClick={handleWishlistToggle}
                        size="icon"
                        variant="outline"
                      >
                        <Heart
                          className={cn(
                            "h-4 w-4",
                            inWishlist
                              ? "fill-destructive text-destructive"
                              : "text-muted-foreground",
                          )}
                        />
                      </Button>
                    </div>

                    {/* View full details */}
                    <Link
                      className={`
                        inline-flex items-center gap-2 text-sm font-medium
                        text-primary
                        hover:underline
                      `}
                      href={productUrl}
                      onClick={() => onOpenChange(false)}
                    >
                      <ExternalLink className="h-4 w-4" />
                      View full product page
                    </Link>
                  </div>
                </div>
              </div>
            );
          })()}
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*                         Variant Selector (simplified)                       */
/* -------------------------------------------------------------------------- */

/**
 * Small eye icon button used on product cards to open Quick View.
 * Accepts onClick handler from parent — prevents card Link navigation.
 */
export function QuickViewButton({
  className,
  onClick,
}: {
  className?: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <Button
      aria-label="Quick view"
      className={cn(
        `
          rounded-full bg-background/80 backdrop-blur-sm transition-opacity
          duration-300
        `,
        className,
      )}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick(e);
      }}
      size="icon"
      type="button"
      variant="outline"
    >
      <Eye className="h-4 w-4 text-muted-foreground" />
    </Button>
  );
}

/** e.g. "8M/10W" -> ["8m", "10w"]. So variant size "10W" matches selected "8M/10W". */
function expandSizeValueForMatching(val: string): string[] {
  const lower = val.trim().toLowerCase();
  if (!lower) return [];
  const parts = lower.split(/\s*\/\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 2 && /^\d+(\.\d+)?[mw]$/.test(parts[0]!) && /^\d+(\.\d+)?[mw]$/.test(parts[1]!))
    return [lower, parts[0]!, parts[1]!];
  return [lower];
}

function expandedSelectedSet(selectedSet: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const s of selectedSet) {
    const lower = s.toLowerCase();
    out.add(lower);
    expandSizeValueForMatching(s).forEach((e) => out.add(e));
  }
  return out;
}

/** True if selected value s is contained in variantSet (exact, or when s contains " / ", all parts of s are in variantSet — Printify-style combined values). */
function selectedValueInVariantSet(s: string, variantSet: Set<string>): boolean {
  const sLower = s.toLowerCase().trim();
  const variantLower = new Set([...variantSet].map((v) => v.toLowerCase()));
  if (variantSet.has(s) || variantLower.has(sLower)) return true;
  const expanded = expandSizeValueForMatching(s);
  if (expanded.some((e) => variantSet.has(e) || variantLower.has(e))) return true;
  const parts = s.split(/\s*\/\s*/).map((p) => p.trim().toLowerCase()).filter(Boolean);
  if (parts.length > 1 && parts.every((p) => variantLower.has(p))) return true;
  return false;
}

/**
 * Find variant by matching the set of selected option values to the variant's
 * field values. Option names are not tied to specific columns.
 * Combined sizes like "8M/10W" match variant "10W" or "8M".
 */
function findVariant(
  variants: QuickViewVariant[],
  selectedByIndex: Record<number, string>,
): null | QuickViewVariant {
  const selectedSet = new Set(
    Object.values(selectedByIndex)
      .filter(Boolean)
      .map((s) => String(s).trim()),
  );
  if (selectedSet.size === 0) return null;
  const selectedExpanded = expandedSelectedSet(selectedSet);

  const match = variants.find((v) => {
    const variantSet = getVariantValueSet(v);
    if (variantSet.size !== selectedSet.size) return false;
    for (const vVal of variantSet) {
      const vLower = vVal.toLowerCase();
      if (!selectedSet.has(vVal) && !selectedSet.has(vLower) && !selectedExpanded.has(vLower))
        return false;
    }
    return true;
  });
  if (match) return match;
  // 2. Subset: variant set ⊆ selected (phone cases: variant has "iPhone 16 Pro Max", selected has that)
  let best: null | QuickViewVariant = null;
  let bestSize = 0;
  for (const v of variants) {
    const variantSet = getVariantValueSet(v);
    if (variantSet.size > bestSize && variantSet.size <= selectedSet.size) {
      let allIn = true;
      for (const x of variantSet) {
        const xLower = x.toLowerCase();
        if (
          !selectedSet.has(x) &&
          !selectedSet.has(xLower) &&
          !selectedExpanded.has(xLower)
        ) {
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
  if (best) return best;

  // 3. Superset: selected set ⊆ variant (apparel: Size "L"; Printify: option "8\" x 0.75\" / 38 - 40 mm" matches variant parts)
  for (const v of variants) {
    const variantSet = getVariantValueSet(v);
    let allSelectedInVariant = true;
    for (const s of selectedSet) {
      if (!selectedValueInVariantSet(s, variantSet)) {
        allSelectedInVariant = false;
        break;
      }
    }
    if (allSelectedInVariant) return v;
  }

  return null;
}

/** Set of non-empty variant field values. Splits combined values like "Charcoal Heather / L" so they match UI selections. */
function getVariantValueSet(v: QuickViewVariant): Set<string> {
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

/* -------------------------------------------------------------------------- */
/*                              Loading Skeleton                               */
/* -------------------------------------------------------------------------- */

function MiniGallery({
  images,
  productName,
}: {
  images: string[];
  productName: string;
}) {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [failedUrls, setFailedUrls] = React.useState<Set<string>>(
    () => new Set(),
  );

  React.useEffect(() => {
    setSelectedIndex(0);
    setFailedUrls(new Set());
  }, [images]);

  const list = images.length > 0 ? images : ["/placeholder.svg"];
  const mainSrc = failedUrls.has(list[selectedIndex] ?? "")
    ? "/placeholder.svg"
    : (list[selectedIndex] ?? "/placeholder.svg");
  const isExternal =
    mainSrc.startsWith("data:") || mainSrc.startsWith("http://");

  return (
    <div className="flex flex-col gap-3">
      <div
        className={`
        relative aspect-square overflow-hidden rounded-xl bg-white
      `}
      >
        <Image
          alt={productName}
          className="object-contain"
          fill
          onError={() =>
            setFailedUrls((prev) =>
              new Set(prev).add(list[selectedIndex] ?? ""),
            )
          }
          sizes="(max-width: 640px) 100vw, 400px"
          src={mainSrc}
          unoptimized={isExternal}
        />
      </div>
      {list.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {list.slice(0, 6).map((src, i) => {
            const thumbSrc = failedUrls.has(src) ? "/placeholder.svg" : src;
            return (
              <button
                className={cn(
                  `
                    relative h-14 w-14 shrink-0 overflow-hidden rounded-md
                    border-2 transition-colors
                  `,
                  selectedIndex === i
                    ? "border-primary"
                    : `
                      border-transparent
                      hover:border-muted-foreground/50
                    `,
                )}
                key={i}
                onClick={() => setSelectedIndex(i)}
                type="button"
              >
                <Image
                  alt=""
                  className="object-cover"
                  fill
                  onError={() =>
                    setFailedUrls((prev) => new Set(prev).add(src))
                  }
                  sizes="56px"
                  src={thumbSrc}
                  unoptimized={
                    thumbSrc.startsWith("data:") || thumbSrc.startsWith("http://")
                  }
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                             Main Component                                  */
/* -------------------------------------------------------------------------- */

function QuickViewSkeleton() {
  return (
    <div
      className={`
      flex flex-col
      md:max-h-[85vh] md:flex-row
    `}
    >
      <div
        className={`
        w-full shrink-0 bg-muted/50
        md:w-[45%]
      `}
      >
        <Skeleton
          className={`
          aspect-square w-full rounded-none
          md:rounded-l-lg
        `}
        />
      </div>
      <div
        className={`
        flex flex-1 flex-col gap-4 p-6
        md:p-8
      `}
      >
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-6 w-1/4" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                          Quick View Trigger Button                          */
/* -------------------------------------------------------------------------- */

function VariantSelector({
  onSelectVariant,
  optionDefinitions,
  selectedVariant,
  variants,
}: {
  onSelectVariant: (v: null | QuickViewVariant) => void;
  optionDefinitions: OptionDefinition[];
  selectedVariant: null | QuickViewVariant;
  variants: QuickViewVariant[];
}) {
  const [selectedByIndex, setSelectedByIndex] = React.useState<
    Record<number, string>
  >({});

  // Auto-select only single-value options (hidden from UI); do not pre-select any multi-value option — customer must choose
  React.useEffect(() => {
    const initial: Record<number, string> = {};
    optionDefinitions.forEach((opt, idx) => {
      const values = (opt.values ?? []).filter(Boolean);
      if (values.length !== 1) return;
      initial[idx] = values[0]!;
    });
    if (Object.keys(initial).length > 0) setSelectedByIndex(initial);
  }, [optionDefinitions]);

  // Require a selection for every multi-value option before we consider any variant (same as product detail page).
  const allMultiValueOptionsSelected = optionDefinitions.every((opt, idx) => {
    const values = (opt.values ?? []).filter(Boolean);
    if (values.length <= 1) return true;
    return Boolean(selectedByIndex[idx]?.trim());
  });

  // When selections change, find matching variant by value set (option names not tied to columns)
  React.useEffect(() => {
    if (!allMultiValueOptionsSelected) {
      onSelectVariant(null);
      return;
    }
    const match = findVariant(variants, selectedByIndex);
    onSelectVariant(match);
  }, [selectedByIndex, allMultiValueOptionsSelected, variants, onSelectVariant]);

  // Sync phone option selection when displayed fallback model differs from current (e.g. brand switch)
  React.useEffect(() => {
    optionDefinitions.forEach((opt, idx) => {
      const values = (opt.values ?? []).filter(Boolean);
      if (values.length <= 1 || !isPhoneModelsOption(opt.name, values)) return;
      const groups = groupPhoneModelsByBrand(values);
      const currentVal = selectedByIndex[idx];
      const currentBrand = currentVal
        ? getPhoneBrand(currentVal)
        : groups[0]?.brand;
      const currentGroup = groups.find((g) => g.brand === currentBrand);
      const models = currentGroup?.models ?? [];
      const fallback = models[0];
      if (
        fallback &&
        currentVal !== fallback &&
        !currentGroup?.models.includes(currentVal ?? "")
      ) {
        setSelectedByIndex((prev) => ({ ...prev, [idx]: fallback }));
      }
    });
  }, [optionDefinitions, selectedByIndex]);

  const selectStyles =
    "w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";

  return (
    <div className="space-y-3">
      {optionDefinitions.map((opt, idx) => {
        const values = (opt.values ?? []).filter(Boolean);
        if (values.length <= 1) return null;

        const isPhoneModels = isPhoneModelsOption(opt.name, values);
        const groups = isPhoneModels ? groupPhoneModelsByBrand(values) : [];

        if (isPhoneModels && groups.length > 0) {
          const selectedValue = selectedByIndex[idx];
          const currentBrand = selectedValue
            ? getPhoneBrand(selectedValue)
            : (groups[0]?.brand ?? null);
          const currentGroup = groups.find((g) => g.brand === currentBrand);
          const models = currentGroup?.models ?? [];
          const displayModel =
            selectedValue && currentGroup?.models.includes(selectedValue)
              ? selectedValue
              : (models[0] ?? "");

          return (
            <div className="space-y-2" key={opt.name}>
              <span
                className={`
                mb-1.5 block text-xs font-medium tracking-wide
                text-muted-foreground uppercase
              `}
              >
                {opt.name}
              </span>
              <div
                className={`
                flex flex-col gap-2
                sm:flex-row sm:items-end
              `}
              >
                <div
                  className={`
                  flex flex-col gap-1
                  sm:min-w-[8rem]
                `}
                >
                  <label
                    className="text-xs text-muted-foreground"
                    htmlFor={`qv-brand-${idx}`}
                  >
                    Brand
                  </label>
                  <select
                    aria-label="Phone brand"
                    className={selectStyles}
                    id={`qv-brand-${idx}`}
                    onChange={(e) => {
                      const brand = e.target.value as PhoneBrand;
                      const group = groups.find((g) => g.brand === brand);
                      if (group?.models[0])
                        setSelectedByIndex((prev) => ({
                          ...prev,
                          [idx]: group.models[0],
                        }));
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
                  flex flex-col gap-1
                  sm:min-w-[10rem]
                `}
                >
                  <label
                    className="text-xs text-muted-foreground"
                    htmlFor={`qv-model-${idx}`}
                  >
                    Model
                  </label>
                  <select
                    aria-label="Phone model"
                    className={selectStyles}
                    id={`qv-model-${idx}`}
                    onChange={(e) =>
                      setSelectedByIndex((prev) => ({
                        ...prev,
                        [idx]: e.target.value,
                      }))
                    }
                    value={displayModel}
                  >
                    {models.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          );
        }

        const sortedValues =
          opt.name.toLowerCase() === "size"
            ? sortClothingSizes([...values])
            : values;
        return (
          <div key={opt.name}>
            <span
              className={`
              mb-1.5 block text-xs font-medium tracking-wide
              text-muted-foreground uppercase
            `}
            >
              {opt.name}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {sortedValues.map((val) => (
                <Button
                  className="min-w-[2.5rem]"
                  key={val}
                  onClick={() =>
                    setSelectedByIndex((prev) => ({ ...prev, [idx]: val }))
                  }
                  size="sm"
                  variant={selectedByIndex[idx] === val ? "default" : "outline"}
                >
                  {val}
                </Button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
