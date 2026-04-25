import type { Metadata } from "next";

import { Suspense } from "react";

import { SEO_CONFIG } from "~/app";

import { InvoicePrintClient } from "./invoice-print-client";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: `Invoice | ${SEO_CONFIG.name}`,
};

export default async function OrderInvoicePage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  if (!orderId?.trim()) return null;

  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24 text-muted-foreground">
          Loading…
        </div>
      }
    >
      <InvoicePrintClient orderId={orderId.trim()} />
    </Suspense>
  );
}
