"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import type { User } from "~/db/schema/users/types";

import { PAYMENT_CONFIG } from "~/app";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/ui/primitives/card";

interface BillingPageClientProps {
  user: null | User;
}

export function BillingPageClient({ user }: BillingPageClientProps) {
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push("/login");
    }
  }, [user, router]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const checkout = urlParams.get("checkout");
    if (checkout === "success") {
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
      router.refresh();
    }
  }, [router]);

  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        Billing & payments
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Payment methods</CardTitle>
          <CardDescription>
            Active method for checkout. Stripe is integrated and can be enabled
            with a front-end change when needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`
                rounded-md bg-primary/10 px-2 py-1 text-sm font-medium
                text-primary
              `}
            >
              Solana Pay (active)
            </span>
            <span
              className={`
                rounded-md border bg-muted/50 px-2 py-1 text-sm
                text-muted-foreground
              `}
            >
              Stripe (disabled)
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Orders are stored when payments complete. Admin can view and manage
            orders and products (admin UI template to be added).
          </p>
          {PAYMENT_CONFIG.stripeEnabled && (
            <p className="text-sm text-muted-foreground">
              Stripe checkout is available; use the cart or product pages to pay
              with card.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
