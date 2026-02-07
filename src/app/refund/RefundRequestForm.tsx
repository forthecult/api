"use client";

import { RotateCcw } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "~/ui/primitives/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/primitives/card";
import { Input } from "~/ui/primitives/input";
import { Label } from "~/ui/primitives/label";

const inputClass =
  "flex min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 placeholder:text-muted-foreground disabled:opacity-50";

export function RefundRequestForm() {
  const [orderId, setOrderId] = useState("");
  const [lookupValue, setLookupValue] = useState("");
  const [refundAddress, setRefundAddress] = useState("");
  const [lookupStatus, setLookupStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [isCrypto, setIsCrypto] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleLookup = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const oid = orderId.trim();
      const value = lookupValue.trim();
      if (!oid) {
        setErrorMessage("Please enter your Order ID.");
        setLookupStatus("error");
        return;
      }
      if (!value) {
        setErrorMessage(
          "Please enter your billing email, payment address, or postal code.",
        );
        setLookupStatus("error");
        return;
      }
      setLookupStatus("loading");
      setErrorMessage("");
      try {
        const res = await fetch("/api/refund/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: oid, lookupValue: value }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          isCrypto?: boolean;
          error?: { code?: string; message?: string };
        };
        if (!res.ok) {
          setLookupStatus("error");
          setErrorMessage(
            data.error?.message ??
              "Order not found or details don't match. Please try again.",
          );
          return;
        }
        setIsCrypto(data.isCrypto ?? false);
        setLookupStatus("success");
      } catch {
        setLookupStatus("error");
        setErrorMessage("Something went wrong. Please try again.");
      }
    },
    [orderId, lookupValue],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const oid = orderId.trim();
      const value = lookupValue.trim();
      const refundAddr = refundAddress.trim();
      if (!oid) {
        setErrorMessage("Please enter your Order ID.");
        setSubmitStatus("error");
        return;
      }
      if (!value) {
        setErrorMessage(
          "Please enter your billing email, payment address, or postal code.",
        );
        setSubmitStatus("error");
        return;
      }
      if (isCrypto && !refundAddr) {
        setErrorMessage(
          "This order was paid with crypto. Please provide the wallet address where you'd like to receive your refund (stablecoin).",
        );
        setSubmitStatus("error");
        return;
      }
      setSubmitStatus("loading");
      setErrorMessage("");
      try {
        const res = await fetch("/api/refund/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: oid,
            lookupValue: value,
            ...(isCrypto && refundAddr && { refundAddress: refundAddr }),
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: { code?: string; message?: string };
        };
        if (!res.ok) {
          setSubmitStatus("error");
          setErrorMessage(
            data.error?.message ?? "Failed to submit. Please try again.",
          );
          return;
        }
        setSubmitStatus("success");
      } catch {
        setSubmitStatus("error");
        setErrorMessage("Failed to submit. Please try again.");
      }
    },
    [orderId, lookupValue, refundAddress, isCrypto],
  );

  const showRefundAddressField = lookupStatus === "success" && isCrypto;
  const canSubmit =
    lookupStatus === "success" && (!isCrypto || refundAddress.trim() !== "");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <RotateCcw className="size-5" />
          Refund request
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Enter your Order ID and one of: your billing email, the payment
          (wallet) address used at checkout, or your shipping postal code. If you paid with crypto, we’ll ask
          for the address where you’d like to receive your refund (in
          stablecoin).
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={lookupStatus !== "success" ? handleLookup : handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="refund-order-id">Order ID</Label>
            <Input
              id="refund-order-id"
              className={inputClass}
              type="text"
              placeholder="e.g. ord_abc123..."
              value={orderId}
              onChange={(e) => {
                setOrderId(e.target.value);
                if (lookupStatus !== "idle") setLookupStatus("idle");
              }}
              autoComplete="off"
              disabled={submitStatus === "loading" || submitStatus === "success"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="refund-lookup">
              Email, payment address, or postal code
            </Label>
            <Input
              id="refund-lookup"
              className={inputClass}
              type="text"
              placeholder="Billing email, wallet address, or shipping postal code"
              value={lookupValue}
              onChange={(e) => {
                setLookupValue(e.target.value);
                if (lookupStatus !== "idle") setLookupStatus("idle");
              }}
              autoComplete="off"
              disabled={submitStatus === "loading" || submitStatus === "success"}
            />
            <p className="text-xs text-muted-foreground">
              Enter any one of these so we can verify your order.
            </p>
          </div>

          {lookupStatus !== "success" && (
            <Button
              type="submit"
              disabled={lookupStatus === "loading"}
              className="w-full sm:w-auto"
            >
              {lookupStatus === "loading" ? "Looking up…" : "Look up order"}
            </Button>
          )}

          {showRefundAddressField && (
            <div className="rounded-md border border-border bg-muted/30 p-4 space-y-2">
              <p className="text-sm font-medium text-foreground">
                This order was paid with crypto
              </p>
              <p className="text-xs text-muted-foreground">
                Refunds are sent in stablecoin only (e.g. USDC) to the address
                you provide below.
              </p>
              <div className="space-y-2 pt-1">
                <Label htmlFor="refund-address">
                  Refund wallet address (stablecoin)
                </Label>
                <Input
                  id="refund-address"
                  className={inputClass}
                  type="text"
                  placeholder="Your wallet address for USDC or other stablecoin"
                  value={refundAddress}
                  onChange={(e) => setRefundAddress(e.target.value)}
                  autoComplete="off"
                  disabled={submitStatus === "loading" || submitStatus === "success"}
                />
              </div>
            </div>
          )}

          {lookupStatus === "success" && (
            <Button
              type="submit"
              disabled={submitStatus === "loading" || !canSubmit}
              className="w-full sm:w-auto"
            >
              {submitStatus === "loading"
                ? "Submitting…"
                : "Submit refund request"}
            </Button>
          )}

          {errorMessage && (
            <p className="text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          )}

          {submitStatus === "success" && (
            <p className="rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-400">
              Your refund request has been submitted. We’ll process it and
              notify you on the channels you’ve selected for transactional
              updates.
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
