import { Suspense } from "react";

import { SEO_CONFIG } from "~/app";

import { SuccessPageClient } from "./success-page-client";

export const dynamic = "force-dynamic";

export const metadata = {
  description: "Thank you for your order.",
  title: `Order confirmed | ${SEO_CONFIG.name}`,
};

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div
          className={`
          flex min-h-[40vh] items-center justify-center text-muted-foreground
        `}
        >
          Loading…
        </div>
      }
    >
      <SuccessPageClient />
    </Suspense>
  );
}
