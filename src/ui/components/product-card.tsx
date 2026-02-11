"use client";

import { Heart, Lock, ShoppingCart, Star, Wallet } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { cn } from "~/lib/cn";
import { useCountryCurrency } from "~/lib/hooks/use-country-currency";
import { useShippingCountry } from "~/lib/hooks/use-shipping-country";
import { isShippingExcluded } from "~/lib/shipping-restrictions";
import { CryptoPrice } from "~/ui/components/CryptoPrice";
import { FiatPrice } from "~/ui/components/FiatPrice";
import { TokenGateGuard } from "~/ui/components/token-gate/TokenGateGuard";
import { Badge } from "~/ui/primitives/badge";
import { Button } from "~/ui/primitives/button";
import { Card, CardContent, CardFooter } from "~/ui/primitives/card";
import {
  Dialog,
  DialogContent,
} from "~/ui/primitives/dialog";

type ProductCardProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onError"
> & {
  /** When "wide", thumbnail uses 4/3 aspect so the image area is wider. Default "square". */
  imageAspect?: "square" | "wide";
  onAddToCart?: (productId: string) => void;
  onAddToWishlist?: (productId: string) => void;
  onRemoveFromWishlist?: (productId: string) => void;
  isInWishlist?: boolean;
  product: {
    category: string;
    id: string;
    image: string;
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
  rating,
  productId,
}: {
  rating: number;
  productId: string;
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
        <span className="ml-1 text-xs text-muted-foreground">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
});

function ProductCardInner({
  className,
  imageAspect = "square",
  onAddToCart,
  onAddToWishlist,
  onRemoveFromWishlist,
  isInWishlist: isInWishlistProp,
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
  const [tokenGateOpen, setTokenGateOpen] = React.useState(false);
  const addToCartTimerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => {
    return () => clearTimeout(addToCartTimerRef.current);
  }, []);
  const isInWishlist =
    typeof isInWishlistProp === "boolean" ? isInWishlistProp : localWishlist;

  /** Show lock overlay only when token-gated and user has not passed the gate. */
  const isGated = Boolean(product.tokenGated && !product.tokenGatePassed);

  React.useEffect(() => {
    setImageError(false);
  }, [product.id, product.image]);

  /** External URLs: load in browser directly (like admin) to avoid Next Image proxy/CDN issues. */
  const isExternalImage =
    typeof product.image === "string" && /^https?:\/\//i.test(product.image);
  const imageSrc =
    imageError || !product.image
      ? "/placeholder.svg"
      : product.image;

  const handleAddToCart = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (onAddToCart) {
        setIsAddingToCart(true);
        addToCartTimerRef.current = setTimeout(() => {
          onAddToCart(product.id);
          setIsAddingToCart(false);
        }, 600);
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
              relative flex h-full flex-col overflow-hidden rounded-lg py-0
              transition-all duration-200 ease-in-out will-change-transform
              hover:shadow-md hover:-translate-y-0.5
            `,
            isHovered && "ring-1 ring-primary/20",
          )}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div
            className={cn(
              "relative overflow-hidden",
              imageAspect === "wide" ? "aspect-[4/3]" : "aspect-square",
              isGated ? "rounded-lg" : "rounded-t-lg",
            )}
          >
            {(imageSrc === "/placeholder.svg" || product.image) && (
              <Image
                alt={product.name}
                className={cn(
                  "object-cover transition-transform duration-300 ease-in-out",
                  isHovered && !isGated && "scale-105",
                )}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                src={imageSrc}
                unoptimized={isExternalImage}
                onError={() => setImageError(true)}
              />
            )}

            {/* Token-gated: strong overlay, message, and ungate from thumbnail */}
            {isGated && (
              <div
                role="button"
                tabIndex={0}
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-muted p-4 text-center"
                aria-label={
                  product.tokenGateSummary
                    ? `Token-gated. You need: ${product.tokenGateSummary}`
                    : "Token-gated product. Connect wallet to view."
                }
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
              >
                <div className="flex size-14 items-center justify-center rounded-full bg-background shadow-lg">
                  <Lock className="h-7 w-7 text-primary" aria-hidden />
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
                  type="button"
                  size="sm"
                  className="gap-2"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setTokenGateOpen(true);
                  }}
                >
                  <Wallet className="h-4 w-4" />
                  Unlock
                </Button>
              </div>
            )}

            {/* Category badge (hidden for token-gated) */}
            {!isGated && (
              <Badge
                className={`
                  absolute top-2 left-2 bg-background/80 backdrop-blur-sm
                `}
                variant="outline"
              >
                {product.category}
              </Badge>
            )}

            {/* Discount badge */}
            {!isGated && discount > 0 && (
              <Badge
                className={`
                absolute top-2 right-2 bg-destructive
                text-destructive-foreground
              `}
              >
                {discount}% OFF
              </Badge>
            )}

            {/* Wishlist button (hidden for token-gated) */}
            {!isGated && (
              <Button
                className={cn(
                  `
                    absolute right-2 bottom-2 z-10 rounded-full bg-background/80
                    backdrop-blur-sm transition-opacity duration-300
                  `,
                  !isHovered && !isInWishlist && "opacity-0",
                )}
                onClick={handleWishlistClick}
                size="icon"
                type="button"
                variant="outline"
                aria-pressed={isInWishlist}
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
            )}
          </div>

          {!isGated && (
          <CardContent className="flex flex-1 flex-col p-4 pt-4 min-h-0">
            {/* Product name with line clamp */}
            <h3
              className={`
                line-clamp-2 text-base font-medium transition-colors
                group-hover:text-primary
              `}
            >
              {product.name}
            </h3>

            {variant === "default" && (
              <>
                <div className="mt-1.5">
                  <StarRating
                    rating={product.rating ?? 0}
                    productId={product.id}
                  />
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <FiatPrice
                    usdAmount={product.price}
                    className="font-medium text-foreground"
                  />
                  {product.originalPrice ? (
                    <FiatPrice
                      usdAmount={product.originalPrice}
                      className="text-sm text-muted-foreground line-through"
                    />
                  ) : null}
                </div>
                <CryptoPrice
                  usdAmount={product.price}
                  className="mt-0.5 text-sm text-muted-foreground"
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
                  isAddingToCart && "opacity-70",
                )}
                disabled={isAddingToCart}
                onClick={handleAddToCart}
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
                Add to Cart
              </Button>
            </CardFooter>
          )}

          {!isGated && variant === "compact" && (
            <CardFooter className="p-4 pt-0">
              <div className="flex w-full items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <FiatPrice
                      usdAmount={product.price}
                      className="font-medium text-foreground"
                    />
                    {product.originalPrice ? (
                      <FiatPrice
                        usdAmount={product.originalPrice}
                        className="text-sm text-muted-foreground line-through"
                      />
                    ) : null}
                  </div>
                  <CryptoPrice usdAmount={product.price} />
                </div>
                {unavailableInCountry ? (
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                    Unavailable in your country
                  </span>
                ) : (
                  <Button
                    className="h-8 w-8 rounded-full"
                    disabled={isAddingToCart}
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

          {!isGated && !product.inStock && (
            <div
              className={`
                absolute inset-0 flex items-center justify-center
                bg-background/80 backdrop-blur-sm
              `}
            >
              <Badge className="px-3 py-1 text-sm" variant="destructive">
                Out of Stock
              </Badge>
            </div>
          )}
        </Card>
      </Link>

      {product.tokenGated && (
        <Dialog open={tokenGateOpen} onOpenChange={setTokenGateOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
            <TokenGateGuard
              resourceType="product"
              resourceId={product.slug ?? product.id}
              className="min-h-0 py-0"
              onValidated={() => {
                setTokenGateOpen(false);
                router.push(`/${product.slug ?? product.id}`);
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/** Memoized ProductCard to prevent unnecessary re-renders in lists */
export const ProductCard = React.memo(ProductCardInner);
