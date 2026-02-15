"use client";

import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { clearChunkReloadFlag } from "~/ui/components/chunk-load-error-handler";
import { Button } from "~/ui/primitives/button";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

const isChunkLoadError = (err: Error) =>
  err.name === "ChunkLoadError" ||
  (err.message && /loading chunk .* failed/i.test(err.message));

/**
 * Root error boundary for the application.
 * Catches errors in the entire app and displays a user-friendly error page.
 */
export default function RootError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  const isChunk = isChunkLoadError(error);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
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
            {isChunk ? (
              <>
                The page could not load. This often happens after we deploy an
                update. Please do a <strong>full refresh</strong> (Ctrl+Shift+R
                or Cmd+Shift+R) or clear your browser cache and try again.
              </>
            ) : (
              <>
                We apologize for the inconvenience. An unexpected error
                occurred. Please try again or return to the homepage.
              </>
            )}
          </p>
        </div>

        {error.digest && (
          <p className="text-xs text-muted-foreground">
            Error ID: {error.digest}
          </p>
        )}

        <div
          className={`
          flex flex-col gap-3
          sm:flex-row
        `}
        >
          {isChunk ? (
            <Button
              variant="default"
              onClick={() => {
                clearChunkReloadFlag();
                window.location.reload();
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reload page
            </Button>
          ) : (
            <Button onClick={reset} variant="default">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </Button>
          )}
          <Link href="/">
            <Button variant="outline">
              <Home className="mr-2 h-4 w-4" />
              Go to homepage
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
