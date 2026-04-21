"use client";

import { AlertTriangle, Home, RefreshCw, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "~/ui/primitives/button";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Error boundary for [slug] routes (product pages, category pages).
 * Catches errors so the rest of the app stays stable.
 */
export default function SlugError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8">
      <div className="flex flex-col items-center gap-6 text-center">
        <div
          className={`
            flex h-20 w-20 items-center justify-center rounded-full
            bg-destructive/10
          `}
        >
          <AlertTriangle className="h-10 w-10 text-destructive" />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Something went wrong</h1>
          <p className="max-w-md text-muted-foreground">
            We couldn’t load this page. This can happen when an image or
            resource fails to load. Please try again or browse from the shop.
          </p>
        </div>

        <div
          className={`
            flex flex-col gap-3
            sm:flex-row
          `}
        >
          <Button onClick={reset} variant="default">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
          <Link href="/products">
            <Button variant="outline">
              <ShoppingBag className="mr-2 h-4 w-4" />
              Browse products
            </Button>
          </Link>
          <Link href="/">
            <Button variant="outline">
              <Home className="mr-2 h-4 w-4" />
              Homepage
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
