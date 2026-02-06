"use client";

import { PackageSearch } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { Button } from "~/ui/primitives/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/primitives/card";
import { Input } from "~/ui/primitives/input";
import { Label } from "~/ui/primitives/label";

const inputClass =
  "flex min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 placeholder:text-muted-foreground disabled:opacity-50";

export function TrackOrderForm() {
  const router = useRouter();
  const [orderId, setOrderId] = useState("");
  const [email, setEmail] = useState("");
  const [paymentAddress, setPaymentAddress] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const oid = orderId.trim();
      const em = email.trim();
      const addr = paymentAddress.trim();
      if (!oid) {
        setErrorMessage("Please enter your Order ID.");
        setStatus("error");
        return;
      }
      if (!em && !addr) {
        setErrorMessage("Please enter either your billing email or payment address.");
        setStatus("error");
        return;
      }
      setStatus("loading");
      setErrorMessage("");
      try {
        const res = await fetch("/api/orders/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: oid,
            ...(em && { email: em }),
            ...(addr && { paymentAddress: addr }),
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          token?: string;
          orderId?: string;
          error?: { code?: string; message?: string };
        };
        if (!res.ok) {
          setStatus("error");
          setErrorMessage(
            data.error?.message ?? "Order not found or details don't match. Please try again.",
          );
          return;
        }
        if (data.token && data.orderId) {
          const url = `/track-order/${encodeURIComponent(data.orderId)}?t=${encodeURIComponent(data.token)}`;
          router.push(url);
          return;
        }
        setStatus("error");
        setErrorMessage("Something went wrong. Please try again.");
      } catch {
        setStatus("error");
        setErrorMessage("Something went wrong. Please try again.");
      }
    },
    [orderId, email, paymentAddress, router],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <PackageSearch className="size-5" />
          Look up your order
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Enter your Order ID and either the billing email or the payment (wallet) address used at checkout.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="track-order-id">Order ID</Label>
            <Input
              id="track-order-id"
              className={inputClass}
              type="text"
              placeholder="e.g. ord_abc123..."
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              autoComplete="off"
              disabled={status === "loading"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="track-email">Billing email</Label>
            <Input
              id="track-email"
              className={inputClass}
              type="email"
              placeholder="Email used at checkout"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={status === "loading"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="track-payment-address">Payment address (optional)</Label>
            <Input
              id="track-payment-address"
              className={inputClass}
              type="text"
              placeholder="Wallet address if you paid with crypto"
              value={paymentAddress}
              onChange={(e) => setPaymentAddress(e.target.value)}
              autoComplete="off"
              disabled={status === "loading"}
            />
            <p className="text-xs text-muted-foreground">
              If you paid with card, use billing email above. If you paid with crypto, you can use the wallet address instead.
            </p>
          </div>
          {errorMessage && (
            <p className="text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          )}
          <Button type="submit" disabled={status === "loading"} className="w-full sm:w-auto">
            {status === "loading" ? "Looking up…" : "Track"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
