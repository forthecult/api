"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { useCart } from "~/lib/hooks/use-cart";
import { Button } from "~/ui/primitives/button";

interface ReorderButtonProps {
  orderId: string;
  variant?:
    | "default"
    | "outline"
    | "ghost"
    | "link"
    | "destructive"
    | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  children?: React.ReactNode;
}

export function ReorderButton({
  orderId,
  variant = "outline",
  size = "sm",
  className,
  children,
}: ReorderButtonProps) {
  const router = useRouter();
  const { addItem } = useCart();
  const [loading, setLoading] = useState(false);

  const handleReorder = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/reorder`,
        {
          credentials: "include",
        },
      );

      if (!res.ok) {
        const data = (await res.json()) as { error?: { message?: string } };
        toast.error(data.error?.message ?? "Could not load order");
        setLoading(false);
        return;
      }

      const data = (await res.json()) as {
        items: Array<{
          productId: string;
          productVariantId?: string;
          quantity: number;
          name: string;
          image: string;
          slug?: string;
          category: string;
          priceUsd: number;
          available: boolean;
          unavailableReason?: string;
        }>;
      };

      const items = data.items ?? [];
      let added = 0;
      const skipped: string[] = [];

      for (const item of items) {
        if (!item.available) {
          skipped.push(item.name);
          continue;
        }
        const id = item.productVariantId
          ? `${item.productId}__${item.productVariantId}`
          : item.productId;
        addItem(
          {
            category: item.category,
            id,
            image: item.image,
            name: item.name,
            price: item.priceUsd,
            slug: item.slug,
            productId: item.productId,
            productVariantId: item.productVariantId,
          },
          item.quantity,
        );
        added += item.quantity;
      }

      if (skipped.length > 0) {
        toast.warning(
          `${skipped.length} item(s) could not be added (unavailable or out of stock).`,
        );
      }
      if (added > 0) {
        toast.success("Order added to cart");
        router.push("/checkout");
      } else if (items.length > 0 && added === 0) {
        toast.error("No items could be added to cart");
      }
    } catch {
      toast.error("Could not load order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={handleReorder}
      disabled={loading}
    >
      {loading ? (
        <>
          <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />
          Loading…
        </>
      ) : (
        <>
          {children ?? (
            <>
              <RotateCcw className="mr-1.5 size-3.5" aria-hidden />
              Reorder
            </>
          )}
        </>
      )}
    </Button>
  );
}
