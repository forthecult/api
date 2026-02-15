"use client";

import { Heart, Minus, Plus, ShoppingCart, X } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { useCart } from "~/lib/hooks/use-cart";
import { useCountryCurrency } from "~/lib/hooks/use-country-currency";
import { useShippingCountry } from "~/lib/hooks/use-shipping-country";
import { useWishlist } from "~/lib/hooks/use-wishlist";
import { isShippingExcluded } from "~/lib/shipping-restrictions";
import { CryptoPrice } from "~/ui/components/CryptoPrice";
import { FiatPrice } from "~/ui/components/FiatPrice";
import { Button } from "~/ui/primitives/button";

export interface SelectedVariant {
  id: string;
  imageUrl?: string;
  priceCents: number;
  stockQuantity?: number;
}

interface Product {
  /** When non-empty, product ships only to these countries (ISO 2-letter). */
  availableCountryCodes?: string[];
  category: string;
  /** When true, product can be purchased regardless of stock (POD/made-to-order). */
  continueSellingWhenOutOfStock?: boolean;
  id: string;
  image: string;
  inStock: boolean;
  name: string;
  price: number;
  slug?: string;
}

interface ProductActionsProps {
  product: Product;
  /** When present, price/stock/image and add-to-cart use this variant. */
  selectedVariant?: null | SelectedVariant;
  /** Human-readable variant (e.g. "Medium", "iPhone 16 Pro") for cart/checkout. */
  variantLabel?: string;
  /** When true, Add to Cart is disabled until a variant is selected. */
  variantRequired?: boolean;
}

interface ProductPriceDisplayProps {
  originalPrice?: number;
  price: number;
}

export function ProductActions({
  product,
  selectedVariant,
  variantLabel,
  variantRequired = false,
}: ProductActionsProps) {
  const { addItem } = useCart();
  const { selectedCountry: footerCountry } = useCountryCurrency();
  const { shippingCountry } = useShippingCountry();
  const { addToWishlist, isInWishlist, removeFromWishlist } = useWishlist();

  const [quantity, setQuantity] = React.useState(1);
  const [isAdding, setIsAdding] = React.useState(false);

  // Respect footer selection and geo: excluded globally, or product restricted to specific countries and current country not in list
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
  // Use only the user's selected country (Preferences) so changing region in the modal updates the button immediately.
  // Geo (shippingCountry) is not used here so a saved preference always wins.
  const unavailableInCountry =
    (currentCountryUpper.length === 2 &&
      isShippingExcluded(currentCountryUpper)) ||
    notInAllowedCountries;
  const inWishlist = isInWishlist(product.id);
  const price =
    selectedVariant != null ? selectedVariant.priceCents / 100 : product.price;
  // Stock logic: if continueSellingWhenOutOfStock is true (POD products), always allow purchase
  const inStock = product.continueSellingWhenOutOfStock
    ? true
    : selectedVariant != null
      ? (selectedVariant.stockQuantity ?? 0) > 0
      : product.inStock;
  // Prefer variant image only when non-empty; otherwise product image, then placeholder (avoids broken cart/checkout images)
  const image =
    (selectedVariant?.imageUrl?.trim() || product.image?.trim() || "").trim() ||
    "/placeholder.svg";

  const handleQuantityChange = React.useCallback((newQty: number) => {
    setQuantity((prev) => (newQty >= 1 ? newQty : prev));
  }, []);

  const handleAddToCart = React.useCallback(async () => {
    if (variantRequired && selectedVariant == null) return;
    setIsAdding(true);
    if (selectedVariant != null) {
      const lineId = `${product.id}__${selectedVariant.id}`;
      addItem(
        {
          category: product.category,
          id: lineId,
          productId: product.id,
          productVariantId: selectedVariant.id,
          ...(variantLabel && { variantLabel }),
          image,
          name: product.name,
          price,
          ...(product.slug && { slug: product.slug }),
        },
        quantity,
      );
    } else {
      addItem(
        {
          category: product.category,
          id: product.id,
          image: product.image?.trim() || "/placeholder.svg",
          name: product.name,
          price: product.price,
          ...(product.slug && { slug: product.slug }),
        },
        quantity,
      );
    }
    setQuantity(1);
    toast.success(`${product.name} added to cart`);
    await new Promise((r) => setTimeout(r, 400));
    setIsAdding(false);
  }, [
    addItem,
    product,
    selectedVariant,
    image,
    price,
    quantity,
    variantRequired,
  ]);

  const handleWishlistToggle = React.useCallback(async () => {
    if (inWishlist) {
      const result = await removeFromWishlist(product.id);
      if (result.ok) toast.success("Removed from wishlist");
      else toast.error(result.error ?? "Could not remove from wishlist");
    } else {
      const result = await addToWishlist(product.id);
      if (result.ok) toast.success("Added to wishlist");
      else {
        if (result.error?.toLowerCase().includes("unauthorized")) {
          toast.error("Sign in to add to wishlist");
        } else {
          toast.error(result.error ?? "Could not add to wishlist");
        }
      }
    }
  }, [product.id, inWishlist, addToWishlist, removeFromWishlist]);

  if (unavailableInCountry) {
    return (
      <div
        className={`
        flex flex-col gap-4
        sm:flex-row sm:items-center
      `}
      >
        <div
          className={`
          flex flex-1 flex-col gap-4
          sm:flex-row sm:items-center
        `}
        >
          {/* Quantity controls shown but disabled for layout consistency */}
          <div className="flex items-center opacity-60">
            <Button
              aria-label="Decrease quantity"
              disabled
              size="icon"
              variant="outline"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-12 text-center select-none">1</span>
            <Button
              aria-label="Increase quantity"
              disabled
              size="icon"
              variant="outline"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {/* Unavailability notice in place of Add to cart */}
          <div
            className={`
              flex min-h-[4.5rem] flex-1 items-center gap-3 rounded-lg border
              border-border bg-muted/60 px-4 py-3 text-muted-foreground
            `}
            role="status"
          >
            <span
              aria-hidden
              className={`
                flex h-7 w-7 shrink-0 items-center justify-center rounded-full
                bg-muted
              `}
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <span className="text-sm">
              This item is currently not available in your region
            </span>
          </div>
        </div>
        <Button
          aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
          aria-pressed={inWishlist}
          className="shrink-0"
          onClick={handleWishlistToggle}
          size="icon"
          variant="outline"
        >
          <Heart
            className={
              inWishlist
                ? "h-4 w-4 fill-destructive text-destructive"
                : "h-4 w-4"
            }
          />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={`
      flex flex-col gap-4
      sm:flex-row sm:items-center
    `}
    >
      {/* Quantity */}
      <div className="flex items-center">
        <Button
          aria-label="Decrease quantity"
          disabled={quantity <= 1}
          onClick={() => handleQuantityChange(quantity - 1)}
          size="icon"
          variant="outline"
        >
          <Minus className="h-4 w-4" />
        </Button>

        <span className="w-12 text-center select-none">{quantity}</span>

        <Button
          aria-label="Increase quantity"
          onClick={() => handleQuantityChange(quantity + 1)}
          size="icon"
          variant="outline"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Add to cart */}
      <Button
        className="min-h-[4.5rem] flex-1 text-[#111111]"
        disabled={
          !inStock || isAdding || (variantRequired && selectedVariant == null)
        }
        onClick={handleAddToCart}
      >
        <ShoppingCart className="mr-2 h-4 w-4" />
        {isAdding
          ? "Adding…"
          : variantRequired && selectedVariant == null
            ? "Select options"
            : "Add to Cart"}
      </Button>

      {/* Add to wishlist */}
      <Button
        aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
        aria-pressed={inWishlist}
        className="shrink-0"
        onClick={handleWishlistToggle}
        size="icon"
        variant="outline"
      >
        <Heart
          className={
            inWishlist ? "h-4 w-4 fill-destructive text-destructive" : "h-4 w-4"
          }
        />
      </Button>
    </div>
  );
}

export function ProductPriceDisplay({
  originalPrice,
  price,
}: ProductPriceDisplayProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <FiatPrice className="text-3xl font-bold" usdAmount={price} />
        {originalPrice && (
          <FiatPrice
            className="text-xl text-muted-foreground line-through"
            usdAmount={originalPrice}
          />
        )}
      </div>
      <CryptoPrice className="text-muted-foreground" usdAmount={price} />
    </div>
  );
}
