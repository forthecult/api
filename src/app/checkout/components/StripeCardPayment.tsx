"use client";

import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";

import type { OrderPayload } from "../checkout-shared";
import type { ShippingAddressFormRef } from "./ShippingAddressForm";
import type { BillingAddressFormRef } from "./BillingAddressForm";

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
  buildOrderPayload: () => OrderPayload;
  shippingFormRef: React.RefObject<ShippingAddressFormRef | null>;
  billingFormRef: React.RefObject<BillingAddressFormRef | null>;
  setValidationErrors: (errors: string[]) => void;
  setNavigatingToPay: (v: boolean) => void;
}

const StripeCardPaymentInner = forwardRef<StripeCardPaymentRef, InnerProps>(
  function StripeCardPaymentInner(
    {
      buildOrderPayload,
      shippingFormRef,
      billingFormRef,
      setValidationErrors,
      setNavigatingToPay,
    },
    ref,
  ) {
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

        const res = await fetch(
          "/api/payments/stripe/create-payment-intent",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lineItems: payload.orderItems.map((item) => ({
                productId: item.productId,
                productVariantId: item.productVariantId,
                quantity: item.quantity,
              })),
              email: form.email.trim(),
              userId:
                (payload.commonBody?.userId as string) ?? undefined,
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
          },
        );

        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          setValidationErrors([
            data.error ?? "Could not start payment.",
          ]);
          setNavigatingToPay(false);
          return;
        }

        const data = (await res.json()) as {
          clientSecret: string;
          orderId: string;
          confirmationToken?: string;
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
            "firstName" in billingSource
              ? billingSource.firstName
              : "";
          const lastName =
            "lastName" in billingSource
              ? billingSource.lastName
              : "";
          const fullName =
            `${firstName ?? ""} ${lastName ?? ""}`.trim();
          if (fullName) billingDetails.name = fullName;
          if (billingSource.phone?.trim())
            billingDetails.phone = billingSource.phone.trim();
          billingDetails.address = {
            line1: billingSource.street?.trim() || undefined,
            line2: billingSource.apartment?.trim() || undefined,
            city: billingSource.city?.trim() || undefined,
            state: billingSource.state?.trim() || undefined,
            postal_code: billingSource.zip?.trim() || undefined,
            country: billingSource.country?.trim() || undefined,
          };
        }

        /* 5. Confirm payment with Stripe */
        const baseUrl =
          typeof window !== "undefined"
            ? window.location.origin
            : "";
        const { error } = await stripe.confirmPayment({
          elements,
          clientSecret: data.clientSecret,
          confirmParams: {
            return_url: `${baseUrl}/checkout/success?orderId=${encodeURIComponent(data.orderId)}`,
            payment_method_data: {
              billing_details: billingDetails,
            },
          },
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

    useImperativeHandle(ref, () => ({ submit: handleSubmit }), [
      handleSubmit,
    ]);

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
  },
);

/* ------------------------------------------------------------------ */
/*  Outer component (provides <Elements> context)                      */
/* ------------------------------------------------------------------ */

export interface StripeCardPaymentProps {
  totalCents: number;
  buildOrderPayload: () => OrderPayload;
  shippingFormRef: React.RefObject<ShippingAddressFormRef | null>;
  billingFormRef: React.RefObject<BillingAddressFormRef | null>;
  setValidationErrors: (errors: string[]) => void;
  setNavigatingToPay: (v: boolean) => void;
}

export const StripeCardPayment = forwardRef<
  StripeCardPaymentRef,
  StripeCardPaymentProps
>(function StripeCardPayment(
  {
    totalCents,
    buildOrderPayload,
    shippingFormRef,
    billingFormRef,
    setValidationErrors,
    setNavigatingToPay,
  },
  ref,
) {
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
            paymentMethodTypes: ["card" as const],
          }
        : undefined,
    [totalCents],
  );

  if (!stripePromise || !elementsOptions) return null;

  return (
    <Elements stripe={stripePromise} options={elementsOptions}>
      <StripeCardPaymentInner
        ref={ref}
        buildOrderPayload={buildOrderPayload}
        shippingFormRef={shippingFormRef}
        billingFormRef={billingFormRef}
        setValidationErrors={setValidationErrors}
        setNavigatingToPay={setNavigatingToPay}
      />
    </Elements>
  );
});
