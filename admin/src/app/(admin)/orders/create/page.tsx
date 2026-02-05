"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { cn } from "~/lib/cn";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

const API_BASE =
  typeof process.env.NEXT_PUBLIC_MAIN_APP_URL === "string"
    ? process.env.NEXT_PUBLIC_MAIN_APP_URL
    : "http://localhost:3000";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const labelClass = "mb-1.5 block text-sm font-medium";

export default function AdminCreateOrderPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSubmitting(true);
      try {
        const res = await fetch(`${API_BASE}/api/admin/orders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            email: email.trim() || "draft@admin.local",
            userId: userId.trim() || null,
          }),
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/orders"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
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
            "rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800",
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
              <label htmlFor="email" className={labelClass}>
                Customer email
              </label>
              <input
                id="email"
                type="email"
                placeholder="hal@finney.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label htmlFor="userId" className={labelClass}>
                Customer ID (optional)
              </label>
              <input
                id="userId"
                type="text"
                placeholder="Leave empty for guest order"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className={inputClass}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A new draft order will be created. You can add products, set
              shipping, and update status on the order detail page.
            </p>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
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
