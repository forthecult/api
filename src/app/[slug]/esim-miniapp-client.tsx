"use client";

import { useEffect, useRef, useState } from "react";
import { AppboxoWebSDK } from "@appboxo/web-sdk";

const BOXO_CLIENT_ID = process.env.NEXT_PUBLIC_BOXO_CLIENT_ID ?? "";
const BOXO_ESIM_APP_ID = process.env.NEXT_PUBLIC_BOXO_ESIM_APP_ID ?? "";

export function ESimMiniappClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!BOXO_CLIENT_ID || !BOXO_ESIM_APP_ID) {
      setError("Boxo eSIM miniapp is not configured.");
      return;
    }

    const el = containerRef.current;
    if (!el) return;

    const sdk = new AppboxoWebSDK({
      clientId: BOXO_CLIENT_ID,
      appId: BOXO_ESIM_APP_ID,
      sandboxMode: process.env.NODE_ENV === "development",
      theme: "system",
      debug: process.env.NODE_ENV === "development",
    });

    sdk
      .mount({
        container: el,
        className: "min-h-[600px] w-full border-0 rounded-lg",
      })
      .then(() => {
        setMounted(true);
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "Failed to load eSIM miniapp.",
        );
      });

    return () => {
      sdk.destroy();
      setMounted(false);
    };
  }, []);

  if (!BOXO_CLIENT_ID || !BOXO_ESIM_APP_ID) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/40 p-8 text-center text-muted-foreground">
        <p className="font-medium">eSIM miniapp</p>
        <p className="mt-1 text-sm">
          Configure <code className="rounded bg-muted px-1">NEXT_PUBLIC_BOXO_CLIENT_ID</code> and{" "}
          <code className="rounded bg-muted px-1">NEXT_PUBLIC_BOXO_ESIM_APP_ID</code> to enable the
          eSIM experience.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-center">
        <p className="font-medium text-destructive">Could not load eSIM</p>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="min-h-[600px] w-full"
      aria-busy={!mounted}
      aria-label="eSIM plans and travel data"
    />
  );
}
