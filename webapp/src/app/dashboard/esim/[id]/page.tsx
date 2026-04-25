import type { Metadata } from "next";

import { EsimDetailClient } from "./esim-detail-client";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "eSIM details",
};

export default async function EsimDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EsimDetailClient esimOrderId={id} />;
}
