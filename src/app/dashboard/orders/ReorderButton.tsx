"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { useCart } from "~/lib/hooks/use-cart";
import { Button } from "~/ui/primitives/button";
import { Spinner } from "~/ui/primitives/spinner";

interface ReorderButtonProps {
  children?: React.ReactNode;
  className?: string;
  orderId: string;
  size?: "default" | "icon" | "lg" | "sm";
  variant?:
    | "default"
    | "destructive"
    | "ghost"
    | "link"
    | "outline"
    | "secondary";
}

export function ReorderButton({
  children,
  className,
  orderId,
  size = "sm",
  variant = "outline",
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
        items: {
          available: boolean;
          category: string;
          image: string;
          name: string;
          priceUsd: number;
          productId: string;
          productVariantId?: string;
          quantity: number;
          slug?: string;
          unavailableReason?: string;
        }[];
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
            productId: item.productId,
            productVariantId: item.productVariantId,
            slug: item.slug,
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
      className={className}
      disabled={loading}
      onClick={handleReorder}
      size={size}
      type="button"
      variant={variant}
    >
      {loading ? (
        <>
          <Spinner className="mr-1.5 size-3.5" variant="inline" />
          Loading…
        </>
      ) : (
        (children ?? (
          <>
            <RotateCcw aria-hidden className="mr-1.5 size-3.5" />
            Reorder
          </>
        ))
      )}
    </Button>
  );
}
