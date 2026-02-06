import { SEO_CONFIG } from "~/app";
import { TrackOrderForm } from "./TrackOrderForm";

export const metadata = {
  description: `Track your order. Enter your Order ID and billing email or payment address to view order status and details.`,
  title: `Order Tracking | ${SEO_CONFIG.name}`,
};

export default function TrackOrderPage() {
  return (
    <div className="container mx-auto max-w-xl px-4 py-12 sm:py-16">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Order tracking
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Enter your Order ID and either your billing email or payment address below to view your order details. This was given on your receipt and in the confirmation email.
        </p>
      </header>

      <TrackOrderForm />
    </div>
  );
}
