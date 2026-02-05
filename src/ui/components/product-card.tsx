"use client";

import { Heart, ShoppingCart, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import * as React from "react";

import { cn } from "~/lib/cn";
import { useCountryCurrency } from "~/lib/hooks/use-country-currency";
import { useShippingCountry } from "~/lib/hooks/use-shipping-country";
import { isShippingExcluded } from "~/lib/shipping-restrictions";
import { CryptoPrice } from "~/ui/components/CryptoPrice";
import { FiatPrice } from "~/ui/components/FiatPrice";
import { Badge } from "~/ui/primitives/badge";
import { Button } from "~/ui/primitives/button";
import { Card, CardContent, CardFooter } from "~/ui/primitives/card";

type ProductCardProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onError"
> & {
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
  const [isHovered, setIsHovered] = React.useState(false);
  const [isAddingToCart, setIsAddingToCart] = React.useState(false);
  const [localWishlist, setLocalWishlist] = React.useState(false);
  const isInWishlist =
    typeof isInWishlistProp === "boolean" ? isInWishlistProp : localWishlist;

  const handleAddToCart = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (onAddToCart) {
        setIsAddingToCart(true);
        setTimeout(() => {
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
    <div className={cn("group", className)} {...props}>
      <Link href={`/${product.slug ?? product.id}`}>
        <Card
          className={cn(
            `
              relative h-full overflow-hidden rounded-lg py-0 transition-all
              duration-200 ease-in-out will-change-transform
              hover:shadow-md hover:-translate-y-0.5
            `,
            isHovered && "ring-1 ring-primary/20",
          )}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="relative aspect-square overflow-hidden rounded-t-lg">
            {product.image && (
              <Image
                alt={product.name}
                className={cn(
                  "object-cover transition-transform duration-300 ease-in-out",
                  isHovered && "scale-105",
                )}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                src={product.image}
              />
            )}

            {/* Category badge */}
            <Badge
              className={`
                absolute top-2 left-2 bg-background/80 backdrop-blur-sm
              `}
              variant="outline"
            >
              {product.category}
            </Badge>

            {/* Discount badge */}
            {discount > 0 && (
              <Badge
                className={`
                absolute top-2 right-2 bg-destructive
                text-destructive-foreground
              `}
              >
                {discount}% OFF
              </Badge>
            )}

            {/* Wishlist button */}
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
          </div>

          <CardContent className="p-4 pt-4">
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

          {variant === "default" && (
            <CardFooter className="p-4 pt-0">
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

          {variant === "compact" && (
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

          {!product.inStock && (
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
    </div>
  );
}

/** Memoized ProductCard to prevent unnecessary re-renders in lists */
export const ProductCard = React.memo(ProductCardInner);
