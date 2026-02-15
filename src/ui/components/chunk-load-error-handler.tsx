"use client";

import { useEffect } from "react";

const SESSION_KEY = "chunk-error-reload";

function isChunkLoadError(error: unknown): boolean {
  if (error instanceof Error) {
    if (error.name === "ChunkLoadError") return true;
    if (error.message && /loading chunk .* failed/i.test(error.message))
      return true;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const msg = String((error as { message?: unknown }).message ?? "");
    if (/loading chunk .* failed/i.test(msg)) return true;
  }
  return false;
}

/**
 * Listens for uncaught ChunkLoadErrors (e.g. from webpack runtime on first load)
 * and triggers a single full reload per tab to recover from network blips or
 * stale cache after deploy. Avoids reload loops by using sessionStorage.
 */
export function ChunkLoadErrorHandler() {
  useEffect(() => {
    const handle = (error: unknown) => {
      if (!isChunkLoadError(error)) return;
      if (typeof sessionStorage === "undefined") return;
      if (sessionStorage.getItem(SESSION_KEY)) return; // already reloaded once
      sessionStorage.setItem(SESSION_KEY, "1");
      window.location.reload();
    };

    const onError = (event: ErrorEvent) => {
      handle(event.error ?? new Error(event.message));
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      handle(event.reason);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}

/** Clear the reload flag so a manual "Reload" from the error page gets one retry. */
export function clearChunkReloadFlag(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}
