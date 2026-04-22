"use client";

import { useCallback, useEffect, useState } from "react";

import { getAdminApiBaseUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

const API_BASE = getAdminApiBaseUrl();

interface Offer {
  id: string;
  name: string;
  plans: Plan[];
  published: boolean;
  slug: string;
}

interface Plan {
  displayName: null | string;
  id: string;
  intervalCount: number;
  intervalUnit: string;
  payCryptoManual: boolean;
  payPaypal: boolean;
  payStripe: boolean;
  priceCents: number;
}

export default function AdminSubscriptionOffersPage() {
  const [data, setData] = useState<null | { offers: Offer[] }>(null);
  const [error, setError] = useState<null | string>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/subscription-offers`, {
        credentials: "include",
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(b.error ?? `HTTP ${res.status}`);
      }
      setData((await res.json()) as { offers: Offer[] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div
        className={`
        flex flex-col gap-2
        sm:flex-row sm:items-center sm:justify-between
      `}
      >
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Subscription catalog
          </h2>
          <p className="text-sm text-muted-foreground">
            Reusable offers (weekly / monthly / annual) with Stripe, PayPal, or
            manual crypto renewal. Create via{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              POST {API_BASE}/api/admin/subscription-offers
            </code>
            .
          </p>
        </div>
        <Button onClick={() => void load()} type="button" variant="outline">
          Refresh
        </Button>
      </div>

      {error ? (
        <div
          className={`
          rounded-lg border border-red-200 bg-red-50 p-4 text-red-800
          dark:border-red-900 dark:bg-red-950/40 dark:text-red-200
        `}
        >
          {error}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Offers</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : data?.offers.length === 0 ? (
            <p className="text-muted-foreground">
              No offers yet. Create one with the admin API (slug, name, plans
              with interval, priceCents, payment flags).
            </p>
          ) : (
            <ul className="space-y-6">
              {data?.offers.map((o) => (
                <li
                  className={`
                  border-b border-border pb-6
                  last:border-0
                `}
                  key={o.id}
                >
                  <div className="font-medium">
                    {o.name}{" "}
                    <span className="text-muted-foreground">({o.slug})</span>
                    {!o.published ? (
                      <span className="ml-2 text-xs text-amber-600">draft</span>
                    ) : null}
                  </div>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {o.plans.map((p) => (
                      <li key={p.id}>
                        {p.displayName ?? p.intervalUnit} —{" "}
                        {(p.priceCents / 100).toFixed(2)} USD · Stripe{" "}
                        {p.payStripe ? "on" : "off"} · PayPal{" "}
                        {p.payPaypal ? "on" : "off"} · Crypto{" "}
                        {p.payCryptoManual ? "on" : "off"}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
