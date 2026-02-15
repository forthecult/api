"use client";

import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useTheme } from "next-themes";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";

import type { OrderPayload } from "../checkout-shared";
import type { BillingAddressFormRef } from "./BillingAddressForm";
import type { ShippingAddressFormRef } from "./ShippingAddressForm";

const STRIPE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

/* ------------------------------------------------------------------ */
/*  Public ref handle                                                  */
/* ------------------------------------------------------------------ */

export interface StripeCardPaymentRef {
  submit: () => Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  Inner component (has access to useStripe / useElements)            */
/* ------------------------------------------------------------------ */

interface InnerProps {
  billingFormRef: React.RefObject<BillingAddressFormRef | null>;
  buildOrderPayload: () => OrderPayload;
  setNavigatingToPay: (v: boolean) => void;
  setValidationErrors: (errors: string[]) => void;
  shippingFormRef: React.RefObject<null | ShippingAddressFormRef>;
}

const StripeCardPaymentInner = function StripeCardPaymentInner({
  billingFormRef,
  buildOrderPayload,
  ref,
  setNavigatingToPay,
  setValidationErrors,
  shippingFormRef,
}: InnerProps & { ref?: React.RefObject<null | StripeCardPaymentRef> }) {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = useCallback(async () => {
    if (!stripe || !elements) return;

    /* 1. Validate shipping + billing forms */
    const shippingErr = shippingFormRef.current?.validate() ?? [];
    const useShippingAsBilling =
      billingFormRef.current?.getUseShippingAsBilling() ?? true;
    const billingErr = !useShippingAsBilling
      ? (billingFormRef.current?.validate() ?? [])
      : [];
    const allErrors = [...shippingErr, ...billingErr];
    setValidationErrors(allErrors);
    if (allErrors.length > 0) return;

    setNavigatingToPay(true);
    shippingFormRef.current?.persistForm();

    /* 2. Submit the Payment Element (validates card fields) */
    const { error: submitError } = await elements.submit();
    if (submitError) {
      setNavigatingToPay(false);
      setValidationErrors([
        submitError.message ?? "Please check your card details.",
      ]);
      return;
    }

    try {
      /* 3. Build payload & create payment intent */
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
      if (!data.clientSecret) {
        setValidationErrors(["Could not start payment."]);
        setNavigatingToPay(false);
        return;
      }

      if (data.confirmationToken) {
        try {
          sessionStorage.setItem(
            `checkout_ct_${data.orderId}`,
            data.confirmationToken,
          );
        } catch {}
      }

      /* 4. Build billing details from shipping or billing form */
      const billing = billingFormRef.current?.getBilling();
      const billingSource = useShippingAsBilling ? form : billing;
      const billingDetails: Record<string, unknown> = {
        email: payload.email,
      };
      if (billingSource) {
        const firstName =
          "firstName" in billingSource ? billingSource.firstName : "";
        const lastName =
          "lastName" in billingSource ? billingSource.lastName : "";
        const fullName = `${firstName ?? ""} ${lastName ?? ""}`.trim();
        if (fullName) billingDetails.name = fullName;
        if (billingSource.phone?.trim())
          billingDetails.phone = billingSource.phone.trim();
        billingDetails.address = {
          city: billingSource.city?.trim() || undefined,
          country: billingSource.country?.trim() || undefined,
          line1: billingSource.street?.trim() || undefined,
          line2: billingSource.apartment?.trim() || undefined,
          postal_code: billingSource.zip?.trim() || undefined,
          state: billingSource.state?.trim() || undefined,
        };
      }

      /* 5. Confirm payment with Stripe */
      const baseUrl =
        typeof window !== "undefined" ? window.location.origin : "";
      const { error } = await stripe.confirmPayment({
        clientSecret: data.clientSecret,
        confirmParams: {
          payment_method_data: {
            billing_details: billingDetails,
          },
          return_url: `${baseUrl}/checkout/success?orderId=${encodeURIComponent(data.orderId)}`,
        },
        elements,
      });

      if (error) {
        setValidationErrors([error.message ?? "Payment failed."]);
      }
    } catch {
      setValidationErrors([
        "Payment failed. Please try again or use another method.",
      ]);
    } finally {
      setNavigatingToPay(false);
    }
  }, [
    stripe,
    elements,
    buildOrderPayload,
    shippingFormRef,
    billingFormRef,
    setValidationErrors,
    setNavigatingToPay,
  ]);

  useImperativeHandle(ref, () => ({ submit: handleSubmit }), [handleSubmit]);

  return (
    <PaymentElement
      options={{
        fields: {
          billingDetails: {
            address: "never",
            email: "never",
            phone: "never",
          },
        },
      }}
    />
  );
};

/* ------------------------------------------------------------------ */
/*  Outer component (provides <Elements> context)                      */
/* ------------------------------------------------------------------ */

export interface StripeCardPaymentProps {
  billingFormRef: React.RefObject<BillingAddressFormRef | null>;
  buildOrderPayload: () => OrderPayload;
  setNavigatingToPay: (v: boolean) => void;
  setValidationErrors: (errors: string[]) => void;
  shippingFormRef: React.RefObject<null | ShippingAddressFormRef>;
  totalCents: number;
}

export const StripeCardPayment = function StripeCardPayment({
  billingFormRef,
  buildOrderPayload,
  ref,
  setNavigatingToPay,
  setValidationErrors,
  shippingFormRef,
  totalCents,
}: StripeCardPaymentProps & {
  ref?: React.RefObject<null | StripeCardPaymentRef>;
}) {
  const [stripePromise] = useState(() =>
    STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null,
  );
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const elementsOptions = useMemo(
    () =>
      totalCents > 0
        ? {
            amount: totalCents,
            appearance: {
              theme: (isDark ? "night" : "stripe") as "night" | "stripe",
              variables: isDark
                ? {
                    borderRadius: "6px",
                    colorBackground: "#1a1a1a",
                    colorDanger: "#ef4444",
                    colorPrimary: "#C4873A",
                    colorText: "#F5F1EB",
                    colorTextPlaceholder: "#737373",
                    colorTextSecondary: "#a3a3a3",
                  }
                : {
                    borderRadius: "6px",
                    colorBackground: "#FAFAF7",
                    colorDanger: "#B5594E",
                    colorPrimary: "#B07830",
                    colorText: "#1A1611",
                    colorTextPlaceholder: "#a8a29e",
                    colorTextSecondary: "#78716C",
                  },
            },
            currency: "usd",
            mode: "payment" as const,
            paymentMethodTypes: ["card" as const],
          }
        : undefined,
    [totalCents, isDark],
  );

  if (!stripePromise || !elementsOptions) return null;

  return (
    <Elements
      key={isDark ? "dark" : "light"}
      options={elementsOptions}
      stripe={stripePromise}
    >
      <StripeCardPaymentInner
        billingFormRef={billingFormRef}
        buildOrderPayload={buildOrderPayload}
        ref={ref}
        setNavigatingToPay={setNavigatingToPay}
        setValidationErrors={setValidationErrors}
        shippingFormRef={shippingFormRef}
      />
    </Elements>
  );
};
