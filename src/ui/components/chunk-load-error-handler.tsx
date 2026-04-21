"use client";

import { useEffect } from "react";

export const CHUNK_ERROR_RELOAD_KEY = "chunk-error-reload";
const SESSION_KEY = CHUNK_ERROR_RELOAD_KEY;

/**
 * Listens for uncaught ChunkLoadErrors and network errors (e.g. RSC fetch failed
 * with ERR_NETWORK_CHANGED) and triggers a single full reload per tab to
 * recover from network blips or stale cache. Avoids reload loops via sessionStorage.
 */
export function ChunkLoadErrorHandler() {
  useEffect(() => {
    const handle = (error: unknown) => {
      const isRecoverable = isChunkLoadError(error) || isNetworkError(error);
      if (!isRecoverable) return;
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

function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    if (
      error.message === "network error" ||
      error.message === "Failed to fetch"
    )
      return true;
    if (error.name === "TypeError" && /network error/i.test(error.message))
      return true;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const msg = String((error as { message?: unknown }).message ?? "");
    if (msg === "network error" || /network error|failed to fetch/i.test(msg))
      return true;
  }
  return false;
}
