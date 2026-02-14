"use client";

import { Eye, ExternalLink, Heart, Minus, Plus, ShoppingCart } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { cn } from "~/lib/cn";
import {
  getPhoneBrand,
  groupPhoneModelsByBrand,
  isPhoneModelsOption,
  type PhoneBrand,
} from "~/lib/sort-phone-models";
import { sortClothingSizes } from "~/lib/sort-clothing-sizes";
import { isShippingExcluded } from "~/lib/shipping-restrictions";
import { useCart } from "~/lib/hooks/use-cart";
import { useCountryCurrency } from "~/lib/hooks/use-country-currency";
import { useWishlist } from "~/lib/hooks/use-wishlist";
import { CryptoPrice } from "~/ui/components/CryptoPrice";
import { FiatPrice } from "~/ui/components/FiatPrice";
import { Badge } from "~/ui/primitives/badge";
import { Button } from "~/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "~/ui/primitives/dialog";
import { Skeleton } from "~/ui/primitives/skeleton";

/* -------------------------------------------------------------------------- */
/*                                   Types                                     */
/* -------------------------------------------------------------------------- */

interface QuickViewVariant {
  id: string;
  size?: string;
  color?: string;
  gender?: string;
  label?: string;
  priceCents: number;
  stockQuantity?: number;
  imageUrl?: string;
}

interface OptionDefinition {
  name: string;
  values: string[];
}

interface QuickViewProduct {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  category: string;
  price: { usd: number };
  compareAtPriceCents?: number;
  imageUrl?: string;
  images?: string[];
  features?: string[];
  inStock: boolean;
  hasVariants: boolean;
  optionDefinitions?: OptionDefinition[];
  variants?: QuickViewVariant[];
  availableCountryCodes?: string[];
}

interface ProductQuickViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Slug or ID of the product to preview. */
  productSlugOrId: string | null;
}

/* -------------------------------------------------------------------------- */
/*                              Mini Gallery                                   */
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
  const isExternal = /^https?:\/\//i.test(mainSrc);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-white">
        <Image
          alt={productName}
          className="object-contain"
          fill
          sizes="(max-width: 640px) 100vw, 400px"
          src={mainSrc}
          unoptimized={isExternal}
          onError={() =>
            setFailedUrls((prev) => new Set(prev).add(list[selectedIndex] ?? ""))
          }
        />
      </div>
      {list.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {list.slice(0, 6).map((src, i) => {
            const thumbSrc = failedUrls.has(src)
              ? "/placeholder.svg"
              : src;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedIndex(i)}
                className={cn(
                  "relative h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 transition-colors",
                  selectedIndex === i
                    ? "border-primary"
                    : "border-transparent hover:border-muted-foreground/50",
                )}
              >
                <Image
                  alt=""
                  className="object-cover"
                  fill
                  sizes="56px"
                  src={thumbSrc}
                  unoptimized={/^https?:\/\//i.test(thumbSrc)}
                  onError={() =>
                    setFailedUrls((prev) => new Set(prev).add(src))
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
/*                         Variant Selector (simplified)                       */
/* -------------------------------------------------------------------------- */

/** Map option definition name to variant field (same as product-variant-section). */
function getVariantKey(
  optionName: string,
  index: number,
): "color" | "size" | "gender" | "label" {
  const lower = optionName.toLowerCase();
  if (lower.includes("color") || lower.includes("finish")) return "color";
  if (lower.includes("size")) return "size";
  if (lower === "option") return "gender";
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
  if (lower === "variant") return "label";
  return index === 0 ? "color" : index === 1 ? "gender" : "size";
}

function VariantSelector({
  optionDefinitions,
  variants,
  selectedVariant,
  onSelectVariant,
}: {
  optionDefinitions: OptionDefinition[];
  variants: QuickViewVariant[];
  selectedVariant: QuickViewVariant | null;
  onSelectVariant: (v: QuickViewVariant | null) => void;
}) {
  const [selectedByIndex, setSelectedByIndex] = React.useState<
    Record<number, string>
  >({});

  // Auto-select single-value options; for phone models use first brand's latest model, else first value
  React.useEffect(() => {
    const initial: Record<number, string> = {};
    optionDefinitions.forEach((opt, idx) => {
      const values = (opt.values ?? []).filter(Boolean);
      if (values.length < 1) return;
      if (isPhoneModelsOption(opt.name, values)) {
        const groups = groupPhoneModelsByBrand(values);
        const first = groups[0]?.models[0];
        if (first) initial[idx] = first;
      } else {
        initial[idx] = values[0]!;
      }
    });
    if (Object.keys(initial).length > 0) setSelectedByIndex(initial);
  }, [optionDefinitions]);

  // When selections change, find matching variant (use getVariantKey so "Men/Women" -> gender, etc.)
  React.useEffect(() => {
    if (
      Object.keys(selectedByIndex).length < optionDefinitions.length
    ) {
      onSelectVariant(null);
      return;
    }
    const match = variants.find((v) => {
      return optionDefinitions.every((opt, idx) => {
        const sel = selectedByIndex[idx];
        if (!sel) return false;
        if (opt.name === "Variant") return (v.label ?? "") === sel;
        const key = getVariantKey(opt.name, idx);
        const variantValue =
          key === "color"
            ? v.color
            : key === "size"
              ? v.size
              : key === "gender"
                ? v.gender
                : v.label;
        return (variantValue ?? "") === sel;
      });
    });
    onSelectVariant(match ?? null);
  }, [selectedByIndex, optionDefinitions, variants, onSelectVariant]);

  // Sync phone option selection when displayed fallback model differs from current (e.g. brand switch)
  React.useEffect(() => {
    optionDefinitions.forEach((opt, idx) => {
      const values = (opt.values ?? []).filter(Boolean);
      if (values.length <= 1 || !isPhoneModelsOption(opt.name, values)) return;
      const groups = groupPhoneModelsByBrand(values);
      const currentVal = selectedByIndex[idx];
      const currentBrand = currentVal ? getPhoneBrand(currentVal) : groups[0]?.brand;
      const currentGroup = groups.find((g) => g.brand === currentBrand);
      const models = currentGroup?.models ?? [];
      const fallback = models[0];
      if (fallback && currentVal !== fallback && !currentGroup?.models.includes(currentVal ?? "")) {
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
            : groups[0]?.brand ?? null;
          const currentGroup = groups.find((g) => g.brand === currentBrand);
          const models = currentGroup?.models ?? [];
          const displayModel =
            selectedValue && currentGroup?.models.includes(selectedValue)
              ? selectedValue
              : models[0] ?? "";

          return (
            <div key={opt.name} className="space-y-2">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {opt.name}
              </span>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex flex-col gap-1 sm:min-w-[8rem]">
                  <label
                    htmlFor={`qv-brand-${idx}`}
                    className="text-xs text-muted-foreground"
                  >
                    Brand
                  </label>
                  <select
                    id={`qv-brand-${idx}`}
                    value={currentBrand ?? ""}
                    onChange={(e) => {
                      const brand = e.target.value as PhoneBrand;
                      const group = groups.find((g) => g.brand === brand);
                      if (group?.models[0])
                        setSelectedByIndex((prev) => ({
                          ...prev,
                          [idx]: group.models[0],
                        }));
                    }}
                    className={selectStyles}
                    aria-label="Phone brand"
                  >
                    {groups.map((g) => (
                      <option key={g.brand} value={g.brand}>
                        {g.brand}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1 sm:min-w-[10rem]">
                  <label
                    htmlFor={`qv-model-${idx}`}
                    className="text-xs text-muted-foreground"
                  >
                    Model
                  </label>
                  <select
                    id={`qv-model-${idx}`}
                    value={displayModel}
                    onChange={(e) =>
                      setSelectedByIndex((prev) => ({
                        ...prev,
                        [idx]: e.target.value,
                      }))
                    }
                    className={selectStyles}
                    aria-label="Phone model"
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
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {opt.name}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {sortedValues.map((val) => (
                <Button
                  key={val}
                  variant={
                    selectedByIndex[idx] === val ? "default" : "outline"
                  }
                  size="sm"
                  className="min-w-[2.5rem]"
                  onClick={() =>
                    setSelectedByIndex((prev) => ({ ...prev, [idx]: val }))
                  }
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

/* -------------------------------------------------------------------------- */
/*                              Loading Skeleton                               */
/* -------------------------------------------------------------------------- */

function QuickViewSkeleton() {
  return (
    <div className="flex flex-col md:flex-row md:max-h-[85vh]">
      <div className="w-full md:w-[45%] shrink-0 bg-muted/50">
        <Skeleton className="aspect-square w-full rounded-none md:rounded-l-lg" />
      </div>
      <div className="flex flex-1 flex-col gap-4 p-6 md:p-8">
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
/*                             Main Component                                  */
/* -------------------------------------------------------------------------- */

export function ProductQuickView({
  open,
  onOpenChange,
  productSlugOrId,
}: ProductQuickViewProps) {
  const { addItem } = useCart();
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();

  const [product, setProduct] = React.useState<QuickViewProduct | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] =
    React.useState<QuickViewVariant | null>(null);
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
    product?.hasVariants &&
    (product.optionDefinitions?.length ?? 0) > 0;

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
  }, [product, selectedVariant, variantRequired, addItem, currentPrice, quantity]);

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

  const productUrl = product
    ? `/${product.slug ?? product.id}`
    : "#";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className={cn(
          "max-w-[calc(100vw-2rem)] p-0 gap-0 overflow-hidden rounded-xl border shadow-2xl",
          "sm:max-w-4xl",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        )}
      >
        <DialogTitle className="sr-only">
          {product?.name ?? "Quick View"}
        </DialogTitle>

        {loading && <QuickViewSkeleton />}

        {error && (
          <div className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        )}

        {product && !loading && (
          <div className="flex max-h-[90vh] flex-col md:flex-row">
            {/* Left: image gallery */}
            <div className="w-full shrink-0 md:w-[48%] md:max-h-[90vh] bg-muted/30">
              <div className="sticky top-0 p-4 md:p-5">
                <MiniGallery
                  images={product.images ?? [product.imageUrl ?? "/placeholder.svg"]}
                  productName={product.name}
                />
              </div>
            </div>

            {/* Right: details — scrollable (pr/pt leave room for dialog close button) */}
            <div className="flex flex-1 flex-col overflow-y-auto pr-14 pt-14 md:max-h-[90vh]">
              <div className="flex flex-col gap-4 px-6 pb-6 md:gap-5 md:px-8 md:pb-8">
                {/* Category + badges */}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="font-medium">
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
                <h2 className="text-xl font-semibold leading-tight tracking-tight md:text-2xl">
                  {product.name}
                </h2>

                {/* Price */}
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <FiatPrice
                      usdAmount={currentPrice}
                      className="text-2xl font-bold md:text-3xl"
                    />
                    {originalPrice && originalPrice > currentPrice && (
                      <FiatPrice
                        usdAmount={originalPrice}
                        className="text-base text-muted-foreground line-through"
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

                {/* Description */}
                {product.description && (
                  <p className="text-sm leading-relaxed text-muted-foreground line-clamp-4">
                    {product.description}
                  </p>
                )}

                {/* Features */}
                {product.features && product.features.length > 0 && (
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    {product.features.slice(0, 4).map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        {f}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Variant selector */}
                {variantRequired &&
                  product.optionDefinitions &&
                  product.variants && (
                    <VariantSelector
                      optionDefinitions={product.optionDefinitions}
                      variants={product.variants}
                      selectedVariant={selectedVariant}
                      onSelectVariant={setSelectedVariant}
                    />
                  )}

                {/* Quantity + Add to Cart row */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <div className="flex items-center rounded-lg border border-input">
                    <Button
                      aria-label="Decrease quantity"
                      disabled={quantity <= 1}
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      size="icon"
                      variant="ghost"
                      className="h-10 w-10 rounded-r-none"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="min-w-[2.5rem] text-center text-sm font-medium tabular-nums">
                      {quantity}
                    </span>
                    <Button
                      aria-label="Increase quantity"
                      onClick={() => setQuantity((q) => q + 1)}
                      size="icon"
                      variant="ghost"
                      className="h-10 w-10 rounded-l-none"
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
                      inWishlist ? "Remove from wishlist" : "Add to wishlist"
                    }
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={handleWishlistToggle}
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
                  href={productUrl}
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                  onClick={() => onOpenChange(false)}
                >
                  <ExternalLink className="h-4 w-4" />
                  View full product page
                </Link>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*                          Quick View Trigger Button                          */
/* -------------------------------------------------------------------------- */

/**
 * Small eye icon button used on product cards to open Quick View.
 * Accepts onClick handler from parent — prevents card Link navigation.
 */
export function QuickViewButton({
  onClick,
  className,
}: {
  onClick: (e: React.MouseEvent) => void;
  className?: string;
}) {
  return (
    <Button
      className={cn(
        "rounded-full bg-background/80 backdrop-blur-sm transition-opacity duration-300",
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
      aria-label="Quick view"
    >
      <Eye className="h-4 w-4 text-muted-foreground" />
    </Button>
  );
}
