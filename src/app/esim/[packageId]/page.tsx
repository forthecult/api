import type { Metadata } from "next";

import { getPublicSiteUrl } from "~/lib/app-url";

import { EsimPackageDetailClient } from "./esim-package-detail-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ packageId: string }>;
}): Promise<Metadata> {
  const { packageId } = await params;
  const siteUrl = getPublicSiteUrl();
  return {
    alternates: {
      canonical: `${siteUrl}/esim/${encodeURIComponent(packageId)}`,
    },
    description: "View eSIM data plan details, coverage, and pricing.",
    title: "eSIM Package Details",
  };
}

export default async function EsimPackageDetailPage({
  params,
}: {
  params: Promise<{ packageId: string }>;
}) {
  const { packageId } = await params;
  return <EsimPackageDetailClient packageId={packageId} />;
}
