"use client";

import { useCallback, useEffect, useState } from "react";

type WishlistItem = {
  productId: string;
  product: { id: string };
};

export function useWishlist() {
  const [productIds, setProductIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const fetchWishlist = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/wishlist", { credentials: "include" });
      if (!res.ok) {
        setProductIds(new Set());
        return;
      }
      const data = (await res.json()) as { items?: WishlistItem[] };
      const ids = new Set<string>(
        (data.items ?? []).map((i) => i.product?.id ?? i.productId),
      );
      setProductIds(ids);
    } catch {
      setProductIds(new Set());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWishlist();
  }, [fetchWishlist]);

  const addToWishlist = useCallback(async (productId: string) => {
    try {
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ productId }),
      });
      if (res.ok) {
        setProductIds((prev) => new Set(prev).add(productId));
        return { ok: true };
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: data.error };
    } catch {
      return { ok: false, error: "Request failed" };
    }
  }, []);

  const removeFromWishlist = useCallback(async (productId: string) => {
    try {
      const res = await fetch(
        `/api/wishlist?productId=${encodeURIComponent(productId)}`,
        { method: "DELETE", credentials: "include" },
      );
      if (res.ok) {
        setProductIds((prev) => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
        return { ok: true };
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: data.error };
    } catch {
      return { ok: false, error: "Request failed" };
    }
  }, []);

  const isInWishlist = useCallback(
    (productId: string) => productIds.has(productId),
    [productIds],
  );

  return {
    wishlistProductIds: productIds,
    isInWishlist,
    addToWishlist,
    removeFromWishlist,
    isLoading,
    refetch: fetchWishlist,
  };
}
