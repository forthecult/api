import Link from "next/link";

import { SEO_CONFIG } from "~/app";
import { Button } from "~/ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/ui/primitives/card";

export const metadata = {
  description: "Checkout was cancelled.",
  title: `Checkout cancelled | ${SEO_CONFIG.name}`,
};

export default function CheckoutCancelledPage() {
  return (
    <div
      className={`
      container flex min-h-[60vh] flex-col items-center justify-center py-16
    `}
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Checkout cancelled</CardTitle>
          <CardDescription>
            Your checkout was cancelled. No charge was made. You can return to
            your cart or keep shopping.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button asChild className="w-full">
            <Link href="/products">Continue shopping</Link>
          </Button>
          <Button asChild className="w-full" variant="outline">
            <Link href="/">Back to home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
