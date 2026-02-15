"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "~/ui/primitives/button";

interface CancelOrderButtonProps {
  orderId: string;
  orderShortId: string;
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

/**
 * Trash button for unpaid orders. Calls POST /api/orders/{orderId}/cancel,
 * then refreshes the page so the order shows as Cancelled.
 */
export function CancelOrderButton({
  orderId,
  orderShortId,
  size = "sm",
  className,
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: "{}",
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: { code?: string; message?: string };
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
      type="button"
      variant="ghost"
      size={size}
      className={`text-muted-foreground hover:text-destructive ${className ?? ""}`}
      onClick={handleCancel}
      disabled={loading}
      aria-label={`Remove unpaid order ${orderShortId}`}
      title="Remove unpaid order"
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Trash2 className="size-4" aria-hidden />
      )}
    </Button>
  );
}
