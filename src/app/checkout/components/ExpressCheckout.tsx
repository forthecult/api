"use client";

import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  ExpressCheckoutElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { useCallback, useMemo, useState } from "react";
import type { OrderPayload } from "../checkout-shared";
import type { ShippingAddressFormRef } from "./ShippingAddressForm";

const STRIPE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

export interface ExpressCheckoutProps {
  stripeEnabled: boolean;
  totalCents: number;
  buildOrderPayload: () => OrderPayload;
  setValidationErrors: (errors: string[]) => void;
  shippingFormRef: React.RefObject<ShippingAddressFormRef | null>;
  setNavigatingToPay: (v: boolean) => void;
}

/** Inner component that has access to useStripe / useElements. */
function ExpressCheckoutInner({
  buildOrderPayload,
  setValidationErrors,
  shippingFormRef,
  setNavigatingToPay,
}: {
  buildOrderPayload: () => OrderPayload;
  setValidationErrors: (errors: string[]) => void;
  shippingFormRef: React.RefObject<ShippingAddressFormRef | null>;
  setNavigatingToPay: (v: boolean) => void;
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
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lineItems: payload.orderItems.map((item) => ({
              productId: item.productId,
              productVariantId: item.productVariantId,
              quantity: item.quantity,
            })),
            email: form.email.trim(),
            userId: (payload.commonBody?.userId as string) ?? undefined,
            affiliateCode:
              typeof payload.commonBody?.affiliateCode === "string"
                ? payload.commonBody.affiliateCode
                : undefined,
            shipping: form?.street?.trim()
              ? {
                  firstName: form.firstName?.trim() || undefined,
                  lastName: form.lastName?.trim() || undefined,
                  address1: form.street?.trim() || undefined,
                  address2: form.apartment?.trim() || undefined,
                  city: form.city?.trim() || undefined,
                  stateCode: form.state?.trim() || undefined,
                  countryCode: form.country?.trim() || undefined,
                  zip: form.zip?.trim() || undefined,
                  phone: form.phone?.trim() || undefined,
                }
              : undefined,
          }),
        });

        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          setValidationErrors([data.error ?? "Could not start payment."]);
          setNavigatingToPay(false);
          return;
        }

        const data = (await res.json()) as {
          clientSecret: string;
          orderId: string;
          confirmationToken?: string;
        };
        const { clientSecret, orderId, confirmationToken } = data;
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
          elements,
          clientSecret,
          confirmParams: {
            return_url: `${baseUrl}/checkout/success?orderId=${encodeURIComponent(orderId)}`,
          },
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

export function ExpressCheckout({
  stripeEnabled,
  totalCents,
  buildOrderPayload,
  setValidationErrors,
  shippingFormRef,
  setNavigatingToPay,
}: ExpressCheckoutProps) {
  const [stripePromise] = useState(() =>
    STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null,
  );

  const elementsOptions = useMemo(
    () =>
      totalCents > 0
        ? {
            mode: "payment" as const,
            amount: totalCents,
            currency: "usd",
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
    <Elements stripe={stripePromise} options={elementsOptions}>
      <ExpressCheckoutInner
        buildOrderPayload={buildOrderPayload}
        setValidationErrors={setValidationErrors}
        shippingFormRef={shippingFormRef}
        setNavigatingToPay={setNavigatingToPay}
      />
    </Elements>
  );
}
