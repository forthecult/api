"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { trackViewItem } from "~/lib/analytics/ecommerce";

export function ProductViewAnalytics({
  price,
  productId,
  productName,
}: Readonly<{
  price: number;
  productId: string;
  productName: string;
}>) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const variantId = searchParams.get("variant")?.trim() || undefined;
    trackViewItem({
      price,
      productId,
      productName,
      variantId,
    });
  }, [price, productId, productName, searchParams]);

  return null;
}
