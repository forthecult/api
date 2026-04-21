"use client";

import { Heart, Loader2, ShoppingCart, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { cn } from "~/lib/cn";
import { useCart } from "~/lib/hooks/use-cart";
import { CryptoPrice } from "~/ui/components/CryptoPrice";
import { FiatPrice } from "~/ui/components/FiatPrice";
import { Button } from "~/ui/primitives/button";
import { Card, CardContent } from "~/ui/primitives/card";

interface WishlistItem {
  createdAt: string;
  product: {
    hasVariants?: boolean;
    id: string;
    imageUrl: null | string;
    name: string;
    priceCents: number;
    slug?: string;
  };
  productId: string;
}

export function WishlistPageClient() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<null | string>(null);
  const [addingId, setAddingId] = useState<null | string>(null);
  const { addItem, openCart } = useCart();

  const fetchWishlist = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/wishlist", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load wishlist");
      const data = (await res.json()) as { items: WishlistItem[] };
      setItems(data.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWishlist();
  }, [fetchWishlist]);

  const removeFromWishlist = useCallback(
    async (productId: string) => {
      setRemovingId(productId);
      try {
        const res = await fetch(
          `/api/wishlist?productId=${encodeURIComponent(productId)}`,
          {
            credentials: "include",
            method: "DELETE",
          },
        );
        if (!res.ok) throw new Error("Failed to remove");
        setItems((prev) => prev.filter((i) => i.productId !== productId));
      } catch {
        void fetchWishlist();
      } finally {
        setRemovingId(null);
      }
    },
    [fetchWishlist],
  );

  const handleAddToCart = useCallback(
    (item: WishlistItem) => {
      const p = item.product;
      if (p.hasVariants) {
        // Product has size/color etc — send user to product page to choose
        return;
      }
      setAddingId(p.id);
      addItem(
        {
          category: "Products",
          id: p.id,
          image: p.imageUrl ?? "",
          name: p.name,
          price: p.priceCents / 100,
          productId: p.id,
          ...(p.slug && { slug: p.slug }),
        },
        1,
      );
      toast.success(`${p.name} added to cart`);
      openCart();
      setAddingId(null);
    },
    [addItem, openCart],
  );

  if (loading) {
    return (
      <>
        <div className="flex items-center gap-2">
          <Heart className="h-7 w-7" />
          <h1 className="text-2xl font-semibold tracking-tight">
            My Wish List
          </h1>
        </div>
        <div
          className={`
            flex min-h-[200px] items-center justify-center text-muted-foreground
          `}
        >
          <Loader2 aria-hidden className="h-8 w-8 animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Heart className="h-7 w-7" />
        <h1 className="text-2xl font-semibold tracking-tight">My Wish List</h1>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent
            className={`flex flex-col items-center justify-center py-12`}
          >
            <p className="text-muted-foreground">Your wishlist is empty.</p>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/products">Browse products</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul
          className={`
            grid gap-4
            sm:grid-cols-2
            lg:grid-cols-3
          `}
        >
          {items.map((item) => (
            <li className="min-w-0" key={item.productId}>
              <Card className="flex h-full flex-col overflow-hidden">
                <CardContent className="flex flex-col p-0">
                  <Link
                    className={`
                      block shrink-0
                      focus:ring-2 focus:ring-ring focus:ring-offset-2
                      focus:outline-none
                    `}
                    href={`/${item.product.slug ?? item.product.id}`}
                  >
                    <div
                      className={`
                        relative h-48 w-full shrink-0 overflow-hidden bg-muted
                      `}
                    >
                      {item.product.imageUrl ? (
                        <Image
                          alt=""
                          className="object-cover"
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          src={item.product.imageUrl}
                        />
                      ) : (
                        <span
                          className={`
                            flex size-full items-center justify-center
                            text-muted-foreground
                          `}
                        >
                          No image
                        </span>
                      )}
                    </div>
                  </Link>
                  <div className="flex flex-col gap-2 p-4">
                    <Link
                      className={`
                        font-medium
                        hover:underline
                      `}
                      href={`/${item.product.slug ?? item.product.id}`}
                    >
                      {item.product.name}
                    </Link>
                    <div className="flex flex-col gap-0.5">
                      <FiatPrice
                        className="text-sm font-medium tabular-nums"
                        usdAmount={item.product.priceCents / 100}
                      />
                      <CryptoPrice
                        className="text-sm text-muted-foreground"
                        usdAmount={item.product.priceCents / 100}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      {item.product.hasVariants ? (
                        <Button
                          asChild
                          className="gap-1.5"
                          size="sm"
                          variant="default"
                        >
                          <Link
                            href={`/${item.product.slug ?? item.product.id}`}
                          >
                            <ShoppingCart aria-hidden className="size-3.5" />
                            Select options
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          className="gap-1.5"
                          disabled={addingId === item.product.id}
                          onClick={() => handleAddToCart(item)}
                          size="sm"
                          variant="default"
                        >
                          {addingId === item.product.id ? (
                            <Loader2
                              aria-hidden
                              className="size-3.5 animate-spin"
                            />
                          ) : (
                            <ShoppingCart aria-hidden className="size-3.5" />
                          )}
                          Add to Cart
                        </Button>
                      )}
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/${item.product.slug ?? item.product.id}`}>
                          View product
                        </Link>
                      </Button>
                      <button
                        aria-label={`Remove ${item.product.name} from wishlist`}
                        className={cn(
                          "rounded p-2 text-muted-foreground transition-colors",
                          "hover:bg-destructive/10 hover:text-destructive",
                          "disabled:opacity-50",
                        )}
                        disabled={removingId === item.productId}
                        onClick={(e) => {
                          e.preventDefault();
                          void removeFromWishlist(item.productId);
                        }}
                        type="button"
                      >
                        {removingId === item.productId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
