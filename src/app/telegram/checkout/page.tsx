"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "~/ui/primitives/skeleton";

const CheckoutClient = dynamic(
  () => import("~/app/checkout/CheckoutClient").then((m) => m.CheckoutClient),
  {
    loading: () => (
      <div className="space-y-6 px-4 py-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
        <div
          className={`
            grid gap-6
            md:grid-cols-2
          `}
        >
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    ),
    ssr: false,
  },
);

/**
 * Checkout page inside the Telegram Mini App layout.
 * CheckoutClient detects /telegram/* pathname and includes Telegram user + synthetic email.
 */
export default function TelegramCheckoutPage() {
  return (
    <div className="min-h-screen pb-24">
      <CheckoutClient />
    </div>
  );
}
