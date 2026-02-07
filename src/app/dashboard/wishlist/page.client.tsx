"use client";

import { Heart, Loader2, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { CryptoPrice } from "~/ui/components/CryptoPrice";
import { FiatPrice } from "~/ui/components/FiatPrice";
import { Button } from "~/ui/primitives/button";
import { Card, CardContent } from "~/ui/primitives/card";
import { cn } from "~/lib/cn";

type WishlistItem = {
  productId: string;
  createdAt: string;
  product: {
    id: string;
    slug?: string;
    name: string;
    imageUrl: string | null;
    priceCents: number;
  };
};

export function WishlistPageClient() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

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
            method: "DELETE",
            credentials: "include",
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

  if (loading) {
    return (
      <>
        <div className="flex items-center gap-2">
          <Heart className="h-7 w-7" />
          <h1 className="text-2xl font-semibold tracking-tight">
            My Wish List
          </h1>
        </div>
        <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
        </div>
      </div>
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
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">Your wishlist is empty.</p>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/products">Browse products</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {items.map((item) => (
            <li key={item.productId} className="min-w-0">
              <Card className="flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md">
                <CardContent className="flex flex-col p-0">
                  <Link
                    href={`/${item.product.slug ?? item.product.id}`}
                    className="block shrink-0 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <div className="relative h-48 w-full shrink-0 overflow-hidden bg-muted">
                      {item.product.imageUrl ? (
                        <Image
                          src={item.product.imageUrl}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                      ) : (
                        <span className="flex size-full items-center justify-center text-muted-foreground">
                          No image
                        </span>
                      )}
                    </div>
                  </Link>
                  <div className="flex flex-col gap-2 p-4">
                    <Link
                      href={`/${item.product.slug ?? item.product.id}`}
                      className="font-medium hover:underline"
                    >
                      {item.product.name}
                    </Link>
                    <div className="flex flex-col gap-0.5">
                      <FiatPrice
                        usdAmount={item.product.priceCents / 100}
                        className="text-sm font-medium tabular-nums"
                      />
                      <CryptoPrice
                        usdAmount={item.product.priceCents / 100}
                        className="text-sm text-muted-foreground"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/${item.product.slug ?? item.product.id}`}>
                          View product
                        </Link>
                      </Button>
                      <button
                        type="button"
                        disabled={removingId === item.productId}
                        onClick={(e) => {
                          e.preventDefault();
                          void removeFromWishlist(item.productId);
                        }}
                        className={cn(
                          "rounded p-2 text-muted-foreground transition-colors",
                          "hover:bg-destructive/10 hover:text-destructive",
                          "disabled:opacity-50",
                        )}
                        aria-label={`Remove ${item.product.name} from wishlist`}
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
