"use client";

import { AlertTriangle, LayoutDashboard, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "~/ui/primitives/button";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Error boundary for dashboard pages.
 */
export default function DashboardError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div
      className={`
        flex min-h-[60vh] flex-col items-center justify-center px-4 py-16
      `}
    >
      <div className="flex flex-col items-center gap-6 text-center">
        <div
          className={`
            flex h-16 w-16 items-center justify-center rounded-full
            bg-destructive/10
          `}
        >
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Dashboard Error</h1>
          <p className="max-w-md text-muted-foreground">
            We couldn&apos;t load this section of your dashboard. Please try
            again or contact support if the issue persists.
          </p>
        </div>

        {error.digest && (
          <p className="text-xs text-muted-foreground">
            Reference: {error.digest}
          </p>
        )}

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
          <Link href="/dashboard">
            <Button variant="outline">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Dashboard home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
