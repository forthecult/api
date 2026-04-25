"use client";

import { Lock, Minus, Plus, ShoppingCart, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Activity } from "react";
import * as React from "react";

import { prefetchCheckout } from "~/app/checkout/prefetch-checkout";
import { cn } from "~/lib/cn";
import { useCart } from "~/lib/hooks/use-cart";
import { useMediaQuery } from "~/lib/hooks/use-media-query";
import { CryptoPrice } from "~/ui/components/CryptoPrice";
import { FiatPrice } from "~/ui/components/FiatPrice";
import { Badge } from "~/ui/primitives/badge";
import { Button } from "~/ui/primitives/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTrigger,
} from "~/ui/primitives/drawer";
import { Separator } from "~/ui/primitives/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/ui/primitives/sheet";

interface CartClientProps {
  className?: string;
}

/** Show only the size/variant (e.g. "2XL", "M") in cart — strip title/category before " / ". */
function variantDisplayOnly(
  _productName: string,
  variantLabel: string,
): string {
  if (!variantLabel?.trim()) return variantLabel ?? "";
  const lastSlash = variantLabel.lastIndexOf(" / ");
  if (lastSlash >= 0) {
    const after = variantLabel.slice(lastSlash + 3).trim();
    if (after) return after;
  }
  return variantLabel;
}

const CART_PLACEHOLDER = "/placeholder.svg";

export function CartClient({ className }: CartClientProps) {
  const [isMounted, setIsMounted] = React.useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const {
    cartOpen: isOpen,
    failedImageIds,
    itemCount: totalItems,
    items: cartItems,
    markImageFailed,
    removeItem,
    setCartOpen: setIsOpen,
    subtotal,
    updateQuantity,
  } = useCart();

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  React.useEffect(() => {
    if (isOpen) prefetchCheckout();
  }, [isOpen]);

  // Once the user opens the cart a first time, flip `keepCartMounted` on — this
  // lets us pass `forceMount` to Radix's desktop Sheet so the cart tree stays
  // alive between open→close cycles. We wrap that tree in <Activity> below so
  // React 19.2 unmounts effects while the cart is closed but preserves state
  // (scroll position, any local UI flags) for the next open. The mobile Drawer
  // (vaul) keeps its default mount/unmount behaviour — mobile sessions rarely
  // flip-flop the cart and the DOM cost matters more on low-end devices.
  const [keepCartMounted, setKeepCartMounted] = React.useState(false);
  React.useEffect(() => {
    if (isOpen && !keepCartMounted) setKeepCartMounted(true);
  }, [isOpen, keepCartMounted]);

  // Flip Activity back to `hidden` only *after* Radix's slide-out animation
  // has finished. Activity `hidden` applies `display: none` to its subtree, so
  // flipping synchronously with `isOpen=false` would cause the exit transition
  // to animate an empty container. Opening is synchronous (visible) — if we
  // were to lag it, the first frame after click would render an empty sheet.
  // We seed `hasLaggedClose` to `true` so on first render the value equals
  // `isOpen` (hidden when closed, visible when open); the lag only kicks in
  // on subsequent close transitions.
  const [hasLaggedClose, setHasLaggedClose] = React.useState(true);
  React.useEffect(() => {
    if (isOpen) {
      setHasLaggedClose(false);
      return;
    }
    // Matches the Sheet's data-[state=closed]:duration-300 slide-out + a small
    // safety buffer; see src/ui/primitives/sheet.tsx.
    const timeout = setTimeout(() => setHasLaggedClose(true), 400);
    return () => clearTimeout(timeout);
  }, [isOpen]);
  const activityMode: "hidden" | "visible" =
    isOpen || !hasLaggedClose ? "visible" : "hidden";

  const handleUpdateQuantity = (id: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    updateQuantity(id, newQuantity);
  };

  const handleRemoveItem = (id: string) => {
    removeItem(id);
  };

  const CartTrigger = (
    <Button
      aria-label="Open cart"
      className="relative h-9 w-9 rounded-full text-foreground"
      size="icon"
      variant="outline"
    >
      <ShoppingCart className="h-4 w-4" />
      {totalItems > 0 && (
        <Badge
          className={`
            absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary p-0
            text-[10px] font-bold text-primary-foreground
          `}
          variant="default"
        >
          {totalItems}
        </Badge>
      )}
    </Button>
  );

  const CartContent = (
    <>
      <div
        className={`
          flex h-full max-h-[100dvh] flex-col
          md:max-h-full
        `}
      >
        {/* Fixed header */}
        <div className="shrink-0 border-b px-6 py-4">
          <div>
            <div className="text-xl font-semibold">Your Cart</div>
            <div className="text-base text-muted-foreground">
              {totalItems === 0
                ? "Your cart is empty"
                : `You have ${totalItems} item${totalItems !== 1 ? "s" : ""} in your cart`}
            </div>
          </div>
        </div>

        {/* Scrollable items area */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6">
          {cartItems.length === 0 ? (
            <div
              className={`
                flex flex-col items-center justify-center py-12 duration-200
                animate-in fade-in
              `}
            >
              <div
                className={`
                  mb-4 flex h-20 w-20 items-center justify-center rounded-full
                  bg-muted
                `}
              >
                <ShoppingCart className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="mb-2 text-lg font-medium">Your cart is empty</h3>
              <p className="mb-6 text-center text-base text-muted-foreground">
                Looks like you haven&apos;t added anything to your cart yet.
              </p>
              {isDesktop ? (
                <SheetClose asChild>
                  <Link href="/products">
                    <Button>Browse Products</Button>
                  </Link>
                </SheetClose>
              ) : (
                <DrawerClose asChild>
                  <Link href="/products">
                    <Button>Browse Products</Button>
                  </Link>
                </DrawerClose>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4 py-4">
              {cartItems.map((item) => (
                <div
                  className={`
                    group relative flex rounded-lg border bg-card p-2
                    transition-colors duration-200 animate-in fade-in
                    slide-in-from-bottom-2
                    hover:bg-accent/50
                  `}
                  key={item.id}
                >
                  <div
                    className={`
                      relative h-20 w-20 overflow-hidden rounded bg-white
                    `}
                  >
                    {failedImageIds.has(item.id) || !item.image?.trim() ? (
                      <Image
                        alt={item.name}
                        className="object-contain"
                        fill
                        sizes="80px"
                        src={CART_PLACEHOLDER}
                      />
                    ) : (
                      <Image
                        alt={item.name}
                        className="object-contain"
                        fill
                        onError={() => markImageFailed(item.id)}
                        sizes="80px"
                        src={item.image!.trim()}
                        unoptimized={
                          item.image!.startsWith("data:") ||
                          item.image!.startsWith("http://")
                        }
                      />
                    )}
                  </div>
                  <div className="ml-4 flex flex-1 flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between">
                        <Link
                          className={`
                            line-clamp-2 text-sm font-medium
                            group-hover:text-primary
                          `}
                          href={`/${item.slug ?? item.id}`}
                          onClick={() => setIsOpen(false)}
                        >
                          {item.name}
                        </Link>
                        <button
                          className={`
                            -mt-1 -mr-1 ml-2 rounded-full p-1
                            text-muted-foreground transition-colors
                            hover:bg-muted hover:text-destructive
                          `}
                          onClick={() => handleRemoveItem(item.id)}
                          type="button"
                        >
                          <X className="h-4 w-4" />
                          <span className="sr-only">Remove item</span>
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {item.variantLabel
                          ? `${variantDisplayOnly(item.name, item.variantLabel)}${item.category ? ` · ${item.category}` : ""}`
                          : item.category}
                      </p>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center rounded-md border">
                        <button
                          className={`
                            flex h-7 w-7 items-center justify-center
                            rounded-l-md border-r text-muted-foreground
                            transition-colors
                            hover:bg-muted hover:text-foreground
                          `}
                          disabled={item.quantity <= 1}
                          onClick={() =>
                            handleUpdateQuantity(item.id, item.quantity - 1)
                          }
                          type="button"
                        >
                          <Minus className="h-3 w-3" />
                          <span className="sr-only">Decrease quantity</span>
                        </button>
                        <input
                          aria-label="Quantity"
                          className={`
                            h-7 w-12 border-0 bg-transparent text-center text-xs
                            font-medium
                            [appearance:textfield]
                            focus:ring-1 focus:ring-primary focus:outline-none
                            focus:ring-inset
                            [&::-webkit-inner-spin-button]:appearance-none
                            [&::-webkit-outer-spin-button]:appearance-none
                          `}
                          min={1}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!Number.isNaN(val) && val >= 1) {
                              handleUpdateQuantity(item.id, val);
                            }
                          }}
                          type="number"
                          value={item.quantity}
                        />
                        <button
                          className={`
                            flex h-7 w-7 items-center justify-center
                            rounded-r-md border-l text-muted-foreground
                            transition-colors
                            hover:bg-muted hover:text-foreground
                          `}
                          onClick={() =>
                            handleUpdateQuantity(item.id, item.quantity + 1)
                          }
                          type="button"
                        >
                          <Plus className="h-3 w-3" />
                          <span className="sr-only">Increase quantity</span>
                        </button>
                      </div>
                      <div className="text-sm font-medium">
                        <FiatPrice usdAmount={item.price * item.quantity} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fixed footer with checkout button */}
        {cartItems.length > 0 && (
          <div className="shrink-0 border-t px-6 py-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">
                  <FiatPrice usdAmount={subtotal} />
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Shipping</span>
                <span className="font-medium">Calculated at checkout</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold">Total</span>
                <span className="flex flex-col items-end">
                  <span className="text-base font-semibold">
                    <FiatPrice usdAmount={subtotal} />
                  </span>
                  <CryptoPrice
                    className="text-sm font-normal text-muted-foreground"
                    usdAmount={subtotal}
                  />
                </span>
              </div>
              <div className="space-y-6 pt-1">
                {isDesktop ? (
                  <SheetClose asChild>
                    <Link
                      href="/checkout"
                      onClick={() => setIsOpen(false)}
                      onFocus={() => prefetchCheckout()}
                      onMouseEnter={() => prefetchCheckout()}
                    >
                      <Button className="w-full" size="lg">
                        Checkout
                      </Button>
                    </Link>
                  </SheetClose>
                ) : (
                  <DrawerClose asChild>
                    <Link
                      href="/checkout"
                      onClick={() => setIsOpen(false)}
                      onFocus={() => prefetchCheckout()}
                      onMouseEnter={() => prefetchCheckout()}
                    >
                      <Button className="w-full" size="lg">
                        Checkout
                      </Button>
                    </Link>
                  </DrawerClose>
                )}
                <p
                  className={`
                    mt-4 flex items-center justify-center gap-1.5 text-center
                    text-sm text-muted-foreground
                  `}
                >
                  <Lock aria-hidden className="size-4" />
                  Secure Checkout
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );

  if (!isMounted) {
    return (
      <div className={cn("relative", className)}>
        <Button
          aria-label="Open cart"
          className="relative h-9 w-9 rounded-full"
          size="icon"
          variant="outline"
        >
          <ShoppingCart className="h-4 w-4" />
          {totalItems > 0 && (
            <Badge
              className={`
                absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-[10px]
              `}
              variant="default"
            >
              {totalItems}
            </Badge>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {isDesktop ? (
        <Sheet onOpenChange={setIsOpen} open={isOpen}>
          <SheetTrigger asChild>{CartTrigger}</SheetTrigger>
          <SheetContent
            className="flex w-[400px] flex-col p-0"
            // forceMount is wired up on the first open so the cart sheet DOM
            // (and its Activity subtree) survive close animations. Radix still
            // drives the slide-in/out via data-state on this element's CSS, so
            // visual behaviour is unchanged.
            {...(keepCartMounted ? { forceMount: true } : {})}
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Your cart</SheetTitle>
            </SheetHeader>
            <Activity mode={activityMode} name="cart-drawer">
              {CartContent}
            </Activity>
          </SheetContent>
        </Sheet>
      ) : (
        <Drawer onOpenChange={setIsOpen} open={isOpen}>
          <DrawerTrigger asChild>{CartTrigger}</DrawerTrigger>
          <DrawerContent className="max-h-[85dvh]">
            <Activity mode={activityMode} name="cart-drawer">
              {CartContent}
            </Activity>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
}
