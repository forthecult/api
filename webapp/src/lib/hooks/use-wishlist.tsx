"use client";

import { useCallback, useEffect, useState } from "react";

interface WishlistItem {
  product: { id: string };
  productId: string;
}

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
        body: JSON.stringify({ productId }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (res.ok) {
        setProductIds((prev) => new Set(prev).add(productId));
        return { ok: true };
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return { error: data.error, ok: false };
    } catch {
      return { error: "Request failed", ok: false };
    }
  }, []);

  const removeFromWishlist = useCallback(async (productId: string) => {
    try {
      const res = await fetch(
        `/api/wishlist?productId=${encodeURIComponent(productId)}`,
        { credentials: "include", method: "DELETE" },
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
      return { error: data.error, ok: false };
    } catch {
      return { error: "Request failed", ok: false };
    }
  }, []);

  const isInWishlist = useCallback(
    (productId: string) => productIds.has(productId),
    [productIds],
  );

  return {
    addToWishlist,
    isInWishlist,
    isLoading,
    refetch: fetchWishlist,
    removeFromWishlist,
    wishlistProductIds: productIds,
  };
}
