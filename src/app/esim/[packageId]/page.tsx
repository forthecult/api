import type { Metadata } from "next";

import { EsimPackageDetailClient } from "./esim-package-detail-client";

export const metadata: Metadata = {
  title: "eSIM Package Details",
  description: "View eSIM data plan details, coverage, and pricing.",
};

export default async function EsimPackageDetailPage({
  params,
}: {
  params: Promise<{ packageId: string }>;
}) {
  const { packageId } = await params;
  return <EsimPackageDetailClient packageId={packageId} />;
}
