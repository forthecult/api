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
  const [lookupValue, setLookupValue] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const oid = orderId.trim();
      const value = lookupValue.trim();
      if (!oid) {
        setErrorMessage("Please enter your Order ID.");
        setStatus("error");
        return;
      }
      if (!value) {
        setErrorMessage(
          "Please enter your billing email, payment address, or postal code.",
        );
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
            lookupValue: value,
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
            data.error?.message ??
              "Order not found or details don't match. Please try again.",
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
    [orderId, lookupValue, router],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <PackageSearch className="size-5" />
          Look up your order
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Enter your Order ID and one of: your billing email, the payment
          (wallet) address used at checkout, or your shipping postal code.
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
            <Label htmlFor="track-lookup">
              Email, payment address, or postal code
            </Label>
            <Input
              id="track-lookup"
              className={inputClass}
              type="text"
              placeholder="Billing email, wallet address, or shipping postal code"
              value={lookupValue}
              onChange={(e) => setLookupValue(e.target.value)}
              autoComplete="off"
              disabled={status === "loading"}
            />
            <p className="text-xs text-muted-foreground">
              Enter any one of these so we can verify your order.
            </p>
          </div>
          {errorMessage && (
            <p className="text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          )}
          <Button
            type="submit"
            disabled={status === "loading"}
            className="w-full sm:w-auto"
          >
            {status === "loading" ? "Looking up…" : "Track"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
