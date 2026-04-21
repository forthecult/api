"use client";

import type { Stripe } from "@stripe/stripe-js";

import {
  Elements,
  ExpressCheckoutElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { OrderPayload } from "../checkout-shared";
import type { ShippingAddressFormRef } from "./ShippingAddressForm";

import { getStripePromise, setStripePromiseFromLoad } from "../stripe-preload";

const STRIPE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

export interface ExpressCheckoutProps {
  buildOrderPayload: () => OrderPayload;
  setNavigatingToPay: (v: boolean) => void;
  setValidationErrors: (errors: string[]) => void;
  shippingFormRef: React.RefObject<null | ShippingAddressFormRef>;
  stripeEnabled: boolean;
  totalCents: number;
}

export function ExpressCheckout({
  buildOrderPayload,
  setNavigatingToPay,
  setValidationErrors,
  shippingFormRef,
  stripeEnabled,
  totalCents,
}: ExpressCheckoutProps) {
  // Use preloaded Stripe promise if available; otherwise load when visible and enabled.
  const [stripePromise, setStripePromise] =
    useState<null | Promise<null | Stripe>>(() => getStripePromise() ?? null);
  useEffect(() => {
    if (!stripeEnabled || !STRIPE_PUBLISHABLE_KEY || totalCents <= 0) return;
    if (stripePromise) return;
    let cancelled = false;
    import("@stripe/stripe-js").then(({ loadStripe }) => {
      if (!cancelled) {
        const p = loadStripe(STRIPE_PUBLISHABLE_KEY);
        setStripePromiseFromLoad(p);
        setStripePromise(p);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [stripeEnabled, totalCents, stripePromise]);

  const elementsOptions = useMemo(
    () =>
      totalCents > 0
        ? {
            amount: totalCents,
            currency: "usd",
            mode: "payment" as const,
          }
        : undefined,
    [totalCents],
  );

  if (
    !stripeEnabled ||
    !STRIPE_PUBLISHABLE_KEY ||
    !stripePromise ||
    !elementsOptions
  ) {
    return null;
  }

  return (
    <Elements options={elementsOptions} stripe={stripePromise}>
      <ExpressCheckoutInner
        buildOrderPayload={buildOrderPayload}
        setNavigatingToPay={setNavigatingToPay}
        setValidationErrors={setValidationErrors}
        shippingFormRef={shippingFormRef}
      />
    </Elements>
  );
}

/** Inner component that has access to useStripe / useElements. */
function ExpressCheckoutInner({
  buildOrderPayload,
  setNavigatingToPay,
  setValidationErrors,
  shippingFormRef,
}: {
  buildOrderPayload: () => OrderPayload;
  setNavigatingToPay: (v: boolean) => void;
  setValidationErrors: (errors: string[]) => void;
  shippingFormRef: React.RefObject<null | ShippingAddressFormRef>;
}) {
  const stripe = useStripe();
  const elements = useElements();

  const handleConfirm = useCallback(
    async (_event: unknown) => {
      if (!stripe || !elements) return;

      const errs = shippingFormRef.current?.validate?.() ?? [];
      if (errs.length > 0) {
        setValidationErrors(errs);
        return;
      }
      setValidationErrors([]);
      setNavigatingToPay(true);

      const { error: submitError } = await elements.submit();
      if (submitError) {
        setNavigatingToPay(false);
        setValidationErrors([
          submitError.message ?? "Please check your details.",
        ]);
        return;
      }

      try {
        const payload = buildOrderPayload();
        const form = payload.form;
        if (!form?.email?.trim()) {
          setValidationErrors(["Email is required."]);
          setNavigatingToPay(false);
          return;
        }

        const res = await fetch("/api/payments/stripe/create-payment-intent", {
          body: JSON.stringify({
            affiliateCode:
              typeof payload.commonBody?.affiliateCode === "string"
                ? payload.commonBody.affiliateCode
                : undefined,
            email: form.email.trim(),
            lineItems: payload.orderItems.map((item) => ({
              productId: item.productId,
              productVariantId: item.productVariantId,
              quantity: item.quantity,
            })),
            shipping: form?.street?.trim()
              ? {
                  address1: form.street?.trim() || undefined,
                  address2: form.apartment?.trim() || undefined,
                  city: form.city?.trim() || undefined,
                  countryCode: form.country?.trim() || undefined,
                  firstName: form.firstName?.trim() || undefined,
                  lastName: form.lastName?.trim() || undefined,
                  phone: form.phone?.trim() || undefined,
                  stateCode: form.state?.trim() || undefined,
                  zip: form.zip?.trim() || undefined,
                }
              : undefined,
            userId: (payload.commonBody?.userId as string) ?? undefined,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });

        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          setValidationErrors([data.error ?? "Could not start payment."]);
          setNavigatingToPay(false);
          return;
        }

        const data = (await res.json()) as {
          clientSecret: string;
          confirmationToken?: string;
          orderId: string;
        };
        const { clientSecret, confirmationToken, orderId } = data;
        if (!clientSecret) {
          setValidationErrors(["Could not start payment."]);
          setNavigatingToPay(false);
          return;
        }

        if (confirmationToken) {
          try {
            sessionStorage.setItem(`checkout_ct_${orderId}`, confirmationToken);
          } catch {}
        }

        const baseUrl =
          typeof window !== "undefined" ? window.location.origin : "";
        const { error } = await stripe.confirmPayment({
          clientSecret,
          confirmParams: {
            return_url: `${baseUrl}/checkout/success?orderId=${encodeURIComponent(orderId)}`,
          },
          elements,
        });

        if (error) {
          setValidationErrors([error.message ?? "Payment failed."]);
        }
      } catch {
        setValidationErrors(["Something went wrong. Please try again."]);
      } finally {
        setNavigatingToPay(false);
      }
    },
    [
      stripe,
      elements,
      buildOrderPayload,
      shippingFormRef,
      setValidationErrors,
      setNavigatingToPay,
    ],
  );

  return <ExpressCheckoutElement onConfirm={handleConfirm} />;
}
