"use client";

import { Eye, Heart, Lock, ShoppingCart, Star, Wallet } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { cn } from "~/lib/cn";
import { PRELOAD_CART } from "~/ui/components/cart";
import { useCountryCurrency } from "~/lib/hooks/use-country-currency";
import { useShippingCountry } from "~/lib/hooks/use-shipping-country";
import { isShippingExcluded } from "~/lib/shipping-restrictions";
import { CryptoPrice } from "~/ui/components/CryptoPrice";
import { FiatPrice } from "~/ui/components/FiatPrice";
import { TokenGateGuard } from "~/ui/components/token-gate/TokenGateGuard";
import { Badge } from "~/ui/primitives/badge";
import { Button } from "~/ui/primitives/button";
import { Card, CardContent, CardFooter } from "~/ui/primitives/card";
import { Dialog, DialogContent, DialogTitle } from "~/ui/primitives/dialog";

type ProductCardProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onError"
> & {
  /** When "wide", thumbnail uses 4/3 aspect so the image area is wider. Default "square". */
  imageAspect?: "square" | "wide";
  isInWishlist?: boolean;
  onAddToCart?: (productId: string) => void;
  onAddToWishlist?: (productId: string) => void;
  /** Callback when user hovers near the card — use to preload Quick View. */
  onPreloadQuickView?: () => void;
  /** Callback to open Quick View. Receives the product slug or id. */
  onQuickView?: (slugOrId: string) => void;
  onRemoveFromWishlist?: (productId: string) => void;
  /** Hint Next/Image to preload this image (use for above-fold cards). */
  priority?: boolean;
  product: {
    category: string;
    /** ISO date string for when the product was created — used for "New" badge. */
    createdAt?: string;
    /** When true, product requires variant selection before adding to cart. */
    hasVariants?: boolean;
    id: string;
    image: string;
    /** Additional images shown on hover. */
    images?: string[];
    inStock?: boolean;
    name: string;
    originalPrice?: number;
    price: number;
    rating?: number;
    /** Used for URL when present (store.com/[slug]). Falls back to id. */
    slug?: string;
    /** When true, show only thumbnail with lock overlay (no name, price, add to cart). */
    tokenGated?: boolean;
    /** When true and tokenGated, user has passed the gate — show normal product (thumbnail, price, add to cart). */
    tokenGatePassed?: boolean;
    /** When tokenGated, optional requirement text e.g. "≥ 1000 CULT on the Solana network". */
    tokenGateSummary?: string;
  };
  variant?: "compact" | "default";
};

/** Memoized star rating component to prevent re-renders */
const StarRating = React.memo(function StarRating({
  productId,
  rating,
}: {
  productId: string;
  rating: number;
}) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;

  return (
    <div className="flex items-center">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          className={cn(
            "h-4 w-4",
            i < fullStars
              ? "fill-yellow-400 text-yellow-400"
              : i === fullStars && hasHalfStar
                ? "fill-yellow-400/50 text-yellow-400"
                : "stroke-muted/40 text-muted",
          )}
          key={`star-${productId}-position-${i + 1}`}
        />
      ))}
      {rating > 0 && (
        <span className="ml-1 text-sm text-muted-foreground">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
});

/** Number of days a product is considered "New". */
const NEW_PRODUCT_DAYS = 14;

/** Minimal gray blur placeholder to avoid image pop-in flash on category/checkout. */
const BLUR_DATA_URL =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMAAAQ";

function ProductCardInner({
  className,
  imageAspect = "square",
  isInWishlist: isInWishlistProp,
  onAddToCart,
  onAddToWishlist,
  onPreloadQuickView,
  onQuickView,
  onRemoveFromWishlist,
  priority = false,
  product,
  variant = "default",
  ...props
}: ProductCardProps) {
  const { selectedCountry: footerCountry } = useCountryCurrency();
  const { shippingCountry } = useShippingCountry();
  // Respect both footer selection and geo: show Unavailable if either is an excluded country
  const unavailableInCountry =
    isShippingExcluded(footerCountry) ||
    (shippingCountry != null && isShippingExcluded(shippingCountry));
  const router = useRouter();
  const [isHovered, setIsHovered] = React.useState(false);
  const [isAddingToCart, setIsAddingToCart] = React.useState(false);
  const [localWishlist, setLocalWishlist] = React.useState(false);
  const [imageError, setImageError] = React.useState(false);
  const [hoverImageError, setHoverImageError] = React.useState(false);
  const [primaryImageLoaded, setPrimaryImageLoaded] = React.useState(false);
  const [tokenGateOpen, setTokenGateOpen] = React.useState(false);

  const isInWishlist =
    typeof isInWishlistProp === "boolean" ? isInWishlistProp : localWishlist;

  /** Is this product considered "New"? Computed after mount to avoid server/client Date mismatch (hydration #418). */
  const [isNew, setIsNew] = React.useState(false);
  React.useEffect(() => {
    if (!product.createdAt) return;
    const created = new Date(product.createdAt);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - NEW_PRODUCT_DAYS);
    setIsNew(created >= cutoff);
  }, [product.createdAt]);

  /** Secondary image for hover (first image from images array that differs from primary). */
  const hoverImage = React.useMemo(() => {
    if (!product.images?.length) return null;
    return product.images.find((img) => img !== product.image) ?? null;
  }, [product.images, product.image]);

  /** Show lock overlay only when token-gated and user has not passed the gate. */
  const isGated = Boolean(product.tokenGated && !product.tokenGatePassed);

  React.useEffect(() => {
    setImageError(false);
    setHoverImageError(false);
    setPrimaryImageLoaded(false);
  }, [product.id, product.image]);

  /** External URLs: load in browser directly (like admin) to avoid Next Image proxy/CDN issues. */
  const isExternalImage =
    typeof product.image === "string" && /^https?:\/\//i.test(product.image);
  const imageSrc =
    imageError || !product.image ? "/placeholder.svg" : product.image;

  const handleAddToCart = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (onAddToCart) {
        setIsAddingToCart(true);
        onAddToCart(product.id);
        // Brief visual feedback then reset
        requestAnimationFrame(() => {
          setTimeout(() => setIsAddingToCart(false), 300);
        });
      }
    },
    [onAddToCart, product.id],
  );

  const handleWishlistClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isInWishlist && onRemoveFromWishlist) {
        onRemoveFromWishlist(product.id);
      } else if (!isInWishlist && onAddToWishlist) {
        onAddToWishlist(product.id);
        if (typeof isInWishlistProp !== "boolean") setLocalWishlist(true);
      }
    },
    [
      isInWishlist,
      onRemoveFromWishlist,
      onAddToWishlist,
      product.id,
      isInWishlistProp,
    ],
  );

  const discount = React.useMemo(
    () =>
      product.originalPrice
        ? Math.round(
            ((product.originalPrice - product.price) / product.originalPrice) *
              100,
          )
        : 0,
    [product.originalPrice, product.price],
  );

  return (
    <div className={cn("group h-full", className)} {...props}>
      <Link
        className="flex h-full flex-col"
        href={`/${product.slug ?? product.id}`}
      >
        <Card
          className={cn(
            `
              relative flex h-full flex-col overflow-hidden rounded-lg
              border-[#2A2A2A] bg-[#1A1A1A] py-0 transition-all duration-300
              ease-in-out will-change-transform
              hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#C4873A]/5
            `,
            isHovered && "border-[#C4873A]/20 ring-1 ring-[#C4873A]/20",
          )}
          onMouseEnter={() => {
            setIsHovered(true);
            onPreloadQuickView?.();
          }}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div
            className={cn(
              "relative overflow-hidden bg-white",
              imageAspect === "wide" ? "aspect-[4/3]" : "aspect-square",
              isGated ? "rounded-lg" : "rounded-t-lg",
            )}
          >
            {/* Blur layer so real image fades in over it instead of popping over white */}
            {imageSrc !== "/placeholder.svg" && (
              <div
                className="absolute inset-0 bg-cover bg-center opacity-100"
                style={{
                  backgroundImage: `url(${BLUR_DATA_URL})`,
                }}
                aria-hidden
              />
            )}
            {(imageSrc === "/placeholder.svg" || product.image) && (
              <Image
                alt={product.name}
                blurDataURL={
                  imageSrc !== "/placeholder.svg" ? BLUR_DATA_URL : undefined
                }
                className={cn(
                  "object-contain transition-all duration-300 ease-in-out",
                  "transition-opacity duration-300",
                  (imageSrc !== "/placeholder.svg" && !primaryImageLoaded) ||
                    (isHovered && hoverImage && !hoverImageError)
                    ? "opacity-0"
                    : "opacity-100",
                  isHovered && !isGated && "scale-105",
                )}
                fill
                onError={() => setImageError(true)}
                onLoad={() => setPrimaryImageLoaded(true)}
                placeholder={
                  imageSrc !== "/placeholder.svg" ? "blur" : "empty"
                }
                priority={priority}
                sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 320px"
                src={imageSrc}
                unoptimized={isExternalImage}
              />
            )}

            {/* Second image revealed on hover */}
            {hoverImage && !hoverImageError && (
              <Image
                alt={`${product.name} - alternate view`}
                className={cn(
                  `
                    absolute inset-0 object-contain transition-all duration-300
                    ease-in-out
                  `,
                  isHovered ? "scale-105 opacity-100" : "opacity-0",
                )}
                fill
                onError={() => setHoverImageError(true)}
                sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 320px"
                src={hoverImage}
                unoptimized={/^https?:\/\//i.test(hoverImage)}
              />
            )}

            {/* Token-gated: strong overlay, message, and ungate from thumbnail */}
            {isGated && (
              <div
                aria-label={
                  product.tokenGateSummary
                    ? `Token-gated. You need: ${product.tokenGateSummary}`
                    : "Token-gated product. Connect wallet to view."
                }
                className={`
                  absolute inset-0 z-10 flex flex-col items-center
                  justify-center gap-3 bg-muted p-4 text-center
                `}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setTokenGateOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    setTokenGateOpen(true);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div
                  className={`
                  flex size-14 items-center justify-center rounded-full
                  bg-background shadow-lg
                `}
                >
                  <Lock aria-hidden className="h-7 w-7 text-primary" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-base font-semibold text-foreground">
                    Token-gated
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {product.tokenGateSummary ? (
                      <>
                        Connect your wallet and sign to verify you hold the
                        required tokens to view this page. You need:{" "}
                        <span className="font-medium text-foreground">
                          {product.tokenGateSummary}
                        </span>
                      </>
                    ) : (
                      "Connect wallet to view"
                    )}
                  </span>
                </div>
                <Button
                  className="gap-2"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setTokenGateOpen(true);
                  }}
                  size="sm"
                  type="button"
                >
                  <Wallet className="h-4 w-4" />
                  Unlock
                </Button>
              </div>
            )}

            {/* Top-left badges: category + New + Out of stock */}
            {!isGated && (
              <div className="absolute top-2 left-2 z-[5] flex flex-col gap-1">
                <Badge
                  className="bg-background/80 backdrop-blur-sm"
                  variant="outline"
                >
                  {product.category}
                </Badge>
                {isNew && (
                  <Badge
                    className={`
                    bg-[#C4873A] font-semibold text-[#111111]
                    hover:bg-[#C4873A]
                  `}
                  >
                    New
                  </Badge>
                )}
                {product.inStock === false && (
                  <Badge
                    className="bg-destructive/90 text-destructive-foreground"
                    variant="secondary"
                  >
                    Out of stock
                  </Badge>
                )}
              </div>
            )}

            {/* Top-right badges: discount */}
            {!isGated && discount > 0 && (
              <Badge
                className={`
                absolute top-2 right-2 z-[5] bg-destructive
                text-destructive-foreground
              `}
              >
                {discount}% OFF
              </Badge>
            )}

            {/* Action buttons on image (hidden for token-gated) */}
            {!isGated && (
              <div
                className={cn(
                  `
                    absolute right-2 bottom-2 z-10 flex flex-col gap-1.5
                    transition-opacity duration-300
                  `,
                  !isHovered && !isInWishlist && "opacity-0",
                )}
              >
                {onQuickView && (
                  <Button
                    aria-label="Quick view"
                    className="rounded-full bg-background/80 backdrop-blur-sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onQuickView(product.slug ?? product.id);
                    }}
                    size="icon"
                    type="button"
                    variant="outline"
                  >
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
                <Button
                  aria-pressed={isInWishlist}
                  className="rounded-full bg-background/80 backdrop-blur-sm"
                  onClick={handleWishlistClick}
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  <Heart
                    className={cn(
                      "h-4 w-4",
                      isInWishlist
                        ? "fill-destructive text-destructive"
                        : "text-muted-foreground",
                    )}
                  />
                  <span className="sr-only">
                    {isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
                  </span>
                </Button>
              </div>
            )}
          </div>

          {!isGated && (
            <CardContent className="flex min-h-0 flex-1 flex-col p-4 pt-4">
              {/* Product name with line clamp */}
              <h3
                className={`
                  line-clamp-2 text-base font-medium text-[#F5F1EB]
                  transition-colors
                  group-hover:text-[#C4873A]
                `}
              >
                {product.name}
              </h3>

              {variant === "default" && (
                <>
                  {(product.rating ?? 0) > 0 && (
                    <div className="mt-1.5">
                      <StarRating
                        productId={product.id}
                        rating={product.rating ?? 0}
                      />
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-1.5">
                    <FiatPrice
                      className="font-medium text-[#F5F1EB]"
                      usdAmount={product.price}
                    />
                    {product.originalPrice ? (
                      <FiatPrice
                        className="text-sm text-[#F5F1EB]/70 line-through"
                        usdAmount={product.originalPrice}
                      />
                    ) : null}
                  </div>
                  <CryptoPrice
                    className="mt-0.5 text-sm text-[#F5F1EB]/80"
                    usdAmount={product.price}
                  />
                </>
              )}
            </CardContent>
          )}

          {!isGated && variant === "default" && (
            <CardFooter className="mt-auto p-4 pt-0">
              <Button
                className={cn(
                  "w-full gap-2 transition-all",
                  product.hasVariants &&
                    `
                      bg-secondary text-[#1A1611]
                      dark:bg-transparent dark:text-[#F5F1EB]
                      [&_svg]:text-inherit
                    `,
                  isAddingToCart && "opacity-70",
                )}
                disabled={isAddingToCart || product.inStock === false}
                onMouseEnter={() => {
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent(PRELOAD_CART));
                  }
                }}
                onClick={handleAddToCart}
                variant={product.hasVariants ? "outline" : "default"}
              >
                {isAddingToCart ? (
                  <div
                    className={`
                      h-4 w-4 animate-spin rounded-full border-2
                      border-background border-t-transparent
                    `}
                  />
                ) : (
                  <ShoppingCart className="h-4 w-4" />
                )}
                {product.inStock === false
                  ? "Out of stock"
                  : product.hasVariants
                    ? "Select Options"
                    : "Add to Cart"}
              </Button>
            </CardFooter>
          )}

          {!isGated && variant === "compact" && (
            <CardFooter className="p-4 pt-0">
              <div className="flex w-full items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <FiatPrice
                      className="font-medium text-[#F5F1EB]"
                      usdAmount={product.price}
                    />
                    {product.originalPrice ? (
                      <FiatPrice
                        className="text-sm text-[#F5F1EB]/70 line-through"
                        usdAmount={product.originalPrice}
                      />
                    ) : null}
                  </div>
                  <CryptoPrice
                    className="text-[#F5F1EB]/80"
                    usdAmount={product.price}
                  />
                </div>
                {unavailableInCountry ? (
                  <span
                    className={`
                    text-xs font-medium text-amber-700
                    dark:text-amber-400
                  `}
                  >
                    Unavailable in your country
                  </span>
                ) : product.inStock === false ? (
                  <span className="text-xs font-medium text-muted-foreground">
                    Out of stock
                  </span>
                ) : (
                  <Button
                    className="h-8 w-8 rounded-full"
                    disabled={isAddingToCart}
                    onMouseEnter={() => {
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(new CustomEvent(PRELOAD_CART));
                      }
                    }}
                    onClick={handleAddToCart}
                    size="icon"
                    variant="ghost"
                  >
                    {isAddingToCart ? (
                      <div
                        className={`
                          h-4 w-4 animate-spin rounded-full border-2
                          border-primary border-t-transparent
                        `}
                      />
                    ) : (
                      <ShoppingCart className="h-4 w-4" />
                    )}
                    <span className="sr-only">Add to cart</span>
                  </Button>
                )}
              </div>
            </CardFooter>
          )}
        </Card>
      </Link>

      {product.tokenGated && (
        <Dialog onOpenChange={setTokenGateOpen} open={tokenGateOpen}>
          <DialogContent
            className={`
            max-h-[90vh] overflow-y-auto
            sm:max-w-md
          `}
          >
            <DialogTitle className="sr-only">
              {product.name} — sign in to view
            </DialogTitle>
            <TokenGateGuard
              className="min-h-0 py-0"
              onValidated={() => {
                setTokenGateOpen(false);
                router.push(`/${product.slug ?? product.id}`);
              }}
              resourceId={product.slug ?? product.id}
              resourceType="product"
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/** Memoized ProductCard to prevent unnecessary re-renders in lists */
export const ProductCard = React.memo(ProductCardInner);
