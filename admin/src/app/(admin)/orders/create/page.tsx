"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { cn } from "~/lib/cn";
import { getAdminApiBaseUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

const API_BASE = getAdminApiBaseUrl();

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const labelClass = "mb-1.5 block text-sm font-medium";

export default function AdminCreateOrderPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<null | string>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSubmitting(true);
      try {
        const res = await fetch(`${API_BASE}/api/admin/orders`, {
          body: JSON.stringify({
            email: email.trim() || "draft@admin.local",
            userId: userId.trim() || null,
          }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? "Failed to create order");
        }
        const data = (await res.json()) as { id: string };
        router.push(`/orders/${data.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create order");
      } finally {
        setSubmitting(false);
      }
    },
    [email, userId, router],
  );

  return (
    <div className="space-y-6">
      <div
        className={`
          flex flex-col gap-4
          sm:flex-row sm:items-center sm:justify-between
        `}
      >
        <div className="flex items-center gap-4">
          <Link
            className={`
              text-sm font-medium text-muted-foreground
              hover:text-foreground
            `}
            href="/orders"
          >
            ← Back to orders
          </Link>
          <h2 className="text-2xl font-semibold tracking-tight">
            Create order
          </h2>
        </div>
      </div>

      {error && (
        <div
          className={cn(
            `
              rounded-lg border border-red-200 bg-red-50 p-4 text-sm
              text-red-800
            `,
            "dark:border-red-800 dark:bg-red-950/30 dark:text-red-200",
          )}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>New order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className={labelClass} htmlFor="email">
                Customer email
              </label>
              <input
                className={inputClass}
                id="email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="hal@finney.com"
                required
                type="email"
                value={email}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="userId">
                Customer ID (optional)
              </label>
              <input
                className={inputClass}
                id="userId"
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Leave empty for guest order"
                type="text"
                value={userId}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A new draft order will be created. You can add products, set
              shipping, and update status on the order detail page.
            </p>
            <Button disabled={submitting} type="submit">
              {submitting ? (
                <>
                  <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                "Create order"
              )}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
