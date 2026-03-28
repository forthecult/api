import type { Metadata } from "next";

import { SEO_CONFIG } from "~/app";
import { getPublicSiteUrl } from "~/lib/app-url";

import { TrackOrderDetailClient } from "./TrackOrderDetailClient";

interface Props {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ t?: string }>;
}

export async function generateMetadata({
  params,
}: Pick<Props, "params">): Promise<Metadata> {
  const { orderId } = await params;
  const siteUrl = getPublicSiteUrl();
  return {
    alternates: {
      canonical: `${siteUrl}/track-order/${encodeURIComponent(orderId)}`,
    },
    description: `View your order details.`,
    title: `Order details | ${SEO_CONFIG.name}`,
  };
}

export default async function TrackOrderDetailPage({
  params,
  searchParams,
}: Props) {
  const { orderId } = await params;
  const { t: token } = await searchParams;

  return (
    <div
      className={`
      container mx-auto max-w-2xl px-4 py-8
      sm:py-12
    `}
    >
      <TrackOrderDetailClient orderId={orderId} token={token ?? null} />
    </div>
  );
}
