"use client";

import { createQR } from "@solana/pay";
import { Check, Loader2, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef } from "react";

import type { SolanaPayStatus } from "~/lib/hooks/use-solana-pay-polling";

import { cn } from "~/lib/cn";
import { Button } from "~/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/ui/primitives/dialog";

interface SolanaPayDialogProps {
  amountUsd: number;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  orderId?: string;
  paymentUrl: null | string;
  recipientAddress?: string;
  status: SolanaPayStatus;
  tokenLogoSrc?: string;
  tokenSymbol: string;
}

/**
 * Reusable Solana Pay QR code dialog component.
 */
export function SolanaPayDialog({
  amountUsd,
  onOpenChange,
  open,
  orderId,
  paymentUrl,
  recipientAddress,
  status,
  tokenLogoSrc = "/crypto/usdc/usdc-logo.svg",
  tokenSymbol,
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
      case "confirmed":
        return "Payment confirmed!";
      case "connection-error":
        return "Connection error - please try again";
      case "error":
        return "Payment verification failed";
      case "polling":
        return "Waiting for payment...";
      default:
        return "Scan the QR code to pay";
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "confirmed":
        return <Check className="h-5 w-5 text-green-500" />;
      case "connection-error":
      case "error":
        return <X className="h-5 w-5 text-red-500" />;
      case "polling":
        return <Loader2 className="h-5 w-5 animate-spin" />;
      default:
        return null;
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {tokenLogoSrc && (
              <Image
                alt={tokenSymbol}
                className="rounded-full"
                height={24}
                src={tokenLogoSrc}
                width={24}
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
            className={cn(
              `
                flex h-64 w-64 items-center justify-center rounded-lg bg-white
                p-2
              `,
              status === "confirmed" && "opacity-50",
            )}
            ref={qrContainerRef}
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
              <p className="font-mono text-xs break-all">{recipientAddress}</p>
            </div>
          )}

          {/* Order ID (if provided) */}
          {orderId && (
            <p className="text-xs text-muted-foreground">Order: {orderId}</p>
          )}

          {/* Cancel button */}
          {status !== "confirmed" && (
            <Button className="w-full" onClick={handleClose} variant="outline">
              Cancel
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
