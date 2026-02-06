import { SEO_CONFIG } from "~/app";
import { TrackOrderDetailClient } from "./TrackOrderDetailClient";

export const metadata = {
  description: `View your order details.`,
  title: `Order details | ${SEO_CONFIG.name}`,
};

type Props = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ t?: string }>;
};

export default async function TrackOrderDetailPage({ params, searchParams }: Props) {
  const { orderId } = await params;
  const { t: token } = await searchParams;

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <TrackOrderDetailClient orderId={orderId} token={token ?? null} />
    </div>
  );
}
