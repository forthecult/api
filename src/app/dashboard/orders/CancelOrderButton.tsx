"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "~/ui/primitives/button";
import { Spinner } from "~/ui/primitives/spinner";

interface CancelOrderButtonProps {
  className?: string;
  orderId: string;
  orderShortId: string;
  size?: "default" | "icon" | "lg" | "sm";
}

/**
 * Trash button for unpaid orders. Calls POST /api/orders/{orderId}/cancel,
 * then refreshes the page so the order shows as Cancelled.
 */
export function CancelOrderButton({
  className,
  orderId,
  orderShortId,
  size = "sm",
}: CancelOrderButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleCancel = async () => {
    if (
      !window.confirm(
        `Remove unpaid order #${orderShortId}? This cannot be undone.`,
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        body: "{}",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: { code?: string; message?: string };
        message?: string;
      };
      if (!res.ok) {
        const msg =
          data.error?.message ?? data.message ?? "Failed to remove order";
        toast.error(msg);
        return;
      }
      toast.success("Order removed.");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      aria-label={`Remove unpaid order ${orderShortId}`}
      className={`
        text-muted-foreground
        hover:text-destructive
        ${className ?? ""}
      `}
      disabled={loading}
      onClick={handleCancel}
      size={size}
      title="Remove unpaid order"
      type="button"
      variant="ghost"
    >
      {loading ? (
        <Spinner variant="inline" />
      ) : (
        <Trash2 aria-hidden className="size-4" />
      )}
    </Button>
  );
}
