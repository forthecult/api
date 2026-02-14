"use client";

import { Eye, ExternalLink, Heart, Minus, Plus, ShoppingCart } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { cn } from "~/lib/cn";
import { useCart } from "~/lib/hooks/use-cart";
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
      <div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
        <Image
          alt={productName}
          className="object-cover"
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

const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];

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

  // Auto-select single-value options
  React.useEffect(() => {
    const auto: Record<number, string> = {};
    optionDefinitions.forEach((opt, idx) => {
      if (opt.values.length === 1) auto[idx] = opt.values[0]!;
    });
    if (Object.keys(auto).length > 0) setSelectedByIndex(auto);
  }, [optionDefinitions]);

  // When selections change, find matching variant
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
        const key = opt.name.toLowerCase() as keyof QuickViewVariant;
        return (
          String(v[key] ?? v.label ?? "").toLowerCase() === sel.toLowerCase()
        );
      });
    });
    onSelectVariant(match ?? null);
  }, [selectedByIndex, optionDefinitions, variants, onSelectVariant]);

  return (
    <div className="space-y-3">
      {optionDefinitions.map((opt, idx) => {
        if (opt.values.length <= 1) return null;
        const values =
          opt.name.toLowerCase() === "size"
            ? [...opt.values].sort(
                (a, b) =>
                  (SIZE_ORDER.indexOf(a.toUpperCase()) === -1
                    ? 99
                    : SIZE_ORDER.indexOf(a.toUpperCase())) -
                  (SIZE_ORDER.indexOf(b.toUpperCase()) === -1
                    ? 99
                    : SIZE_ORDER.indexOf(b.toUpperCase())),
              )
            : opt.values;
        return (
          <div key={opt.name}>
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {opt.name}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {values.map((val) => (
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
    addItem(
      {
        category: product.category,
        id: lineId,
        ...(selectedVariant && {
          productId: product.id,
          productVariantId: selectedVariant.id,
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
                      (variantRequired && !selectedVariant)
                    }
                    onClick={handleAddToCart}
                    size="lg"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    {isAdding
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
