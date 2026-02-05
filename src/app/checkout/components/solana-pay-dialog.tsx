"use client";

import { createQR } from "@solana/pay";
import { Check, Loader2, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef } from "react";

import { cn } from "~/lib/cn";
import type { SolanaPayStatus } from "~/lib/hooks/use-solana-pay-polling";
import { Button } from "~/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/ui/primitives/dialog";

interface SolanaPayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentUrl: string | null;
  status: SolanaPayStatus;
  amountUsd: number;
  tokenSymbol: string;
  tokenLogoSrc?: string;
  recipientAddress?: string;
  orderId?: string;
}

/**
 * Reusable Solana Pay QR code dialog component.
 */
export function SolanaPayDialog({
  open,
  onOpenChange,
  paymentUrl,
  status,
  amountUsd,
  tokenSymbol,
  tokenLogoSrc = "/crypto/usdc/usdc-logo.svg",
  recipientAddress,
  orderId,
}: SolanaPayDialogProps) {
  const qrContainerRef = useRef<HTMLDivElement>(null);

  // Generate QR code when dialog opens
  useEffect(() => {
    if (!open || !paymentUrl) return;

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      const container = qrContainerRef.current;
      if (!container) return;
      // Clear previous QR code using DOM methods
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      const qr = createQR(paymentUrl, 256, "white", "black");
      qr.append(container);
    }, 100);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      // Clear QR code on cleanup
      if (qrContainerRef.current) {
        while (qrContainerRef.current.firstChild) {
          qrContainerRef.current.removeChild(qrContainerRef.current.firstChild);
        }
      }
    };
  }, [open, paymentUrl]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const getStatusMessage = () => {
    switch (status) {
      case "polling":
        return "Waiting for payment...";
      case "confirmed":
        return "Payment confirmed!";
      case "error":
        return "Payment verification failed";
      case "connection-error":
        return "Connection error - please try again";
      default:
        return "Scan the QR code to pay";
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "polling":
        return <Loader2 className="h-5 w-5 animate-spin" />;
      case "confirmed":
        return <Check className="h-5 w-5 text-green-500" />;
      case "error":
      case "connection-error":
        return <X className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {tokenLogoSrc && (
              <Image
                src={tokenLogoSrc}
                alt={tokenSymbol}
                width={24}
                height={24}
                className="rounded-full"
              />
            )}
            Pay with {tokenSymbol}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {/* Amount display */}
          <div className="text-center">
            <p className="text-2xl font-bold">${amountUsd.toFixed(2)} USD</p>
            <p className="text-sm text-muted-foreground">in {tokenSymbol}</p>
          </div>

          {/* QR Code */}
          <div
            ref={qrContainerRef}
            className={cn(
              "flex h-64 w-64 items-center justify-center rounded-lg bg-white p-2",
              status === "confirmed" && "opacity-50",
            )}
          >
            {!paymentUrl && (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 text-sm">
            {getStatusIcon()}
            <span>{getStatusMessage()}</span>
          </div>

          {/* Deposit address (if provided) */}
          {recipientAddress && status !== "confirmed" && (
            <div className="w-full rounded-md bg-muted p-3">
              <p className="text-xs text-muted-foreground">Send to:</p>
              <p className="break-all font-mono text-xs">{recipientAddress}</p>
            </div>
          )}

          {/* Order ID (if provided) */}
          {orderId && (
            <p className="text-xs text-muted-foreground">Order: {orderId}</p>
          )}

          {/* Cancel button */}
          {status !== "confirmed" && (
            <Button variant="outline" onClick={handleClose} className="w-full">
              Cancel
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
