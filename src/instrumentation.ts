/**
 * Runs once when the Next.js server starts. Used to suppress noisy dependency warnings
 * that are harmless (e.g. bigint-buffer falling back to pure JS when native bindings
 * aren't available under Bun), and to stub browser-only globals so deps (e.g. uploadthing
 * or wallet libs) that use indexedDB don't throw ReferenceError on the server.
 */
export function register(): void {
  // Downgrade client-disconnect errors (ECONNRESET / aborted) to a single debug log.
  // These occur when the client navigates away, closes the tab, or cancels the request
  // before the server finishes; they are expected and noisy in production logs.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const isClientDisconnect = (err: unknown): boolean => {
      if (err instanceof Error) {
        const code = (err as NodeJS.ErrnoException).code;
        const msg = err.message ?? "";
        return code === "ECONNRESET" || /aborted/i.test(msg);
      }
      return false;
    };

    process.on("unhandledRejection", (reason: unknown) => {
      if (isClientDisconnect(reason)) {
        if (process.env.NODE_ENV === "development") {
          console.warn(
            "[Next] Client disconnected (ECONNRESET/aborted); request was cancelled or tab closed.",
          );
        }
        return;
      }
      // Let other rejections propagate so Node logs them
    });
  }

  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const msg = typeof args[0] === "string" ? args[0] : String(args[0]);
    if (msg.includes("bigint") && msg.includes("Failed to load bindings")) {
      return;
    }
    originalWarn.apply(console, args);
  };

  // Node server only: stub indexedDB so code that expects it (e.g. idb-keyval, unstorage) doesn't throw
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    typeof (globalThis as unknown as { indexedDB?: unknown }).indexedDB ===
      "undefined"
  ) {
    const noop = (): void => {};
    const stubRequest = (result: unknown) => ({
      addEventListener: noop,
      removeEventListener: noop,
      result,
    });
    const stubStore = {
      add: noop,
      clear: noop,
      delete: noop,
      get: () => stubRequest(undefined),
      put: noop,
    };
    const stubTx = {
      addEventListener: noop,
      objectStore: () => stubStore,
      removeEventListener: noop,
    };
    const stubDb = {
      close: noop,
      createObjectStore: noop,
      deleteObjectStore: noop,
      transaction: () => stubTx,
    };
    (
      globalThis as unknown as {
        indexedDB?: { open: (name?: string) => unknown };
      }
    ).indexedDB = {
      open: () => {
        const req = stubRequest(stubDb);
        queueMicrotask(() => {
          const onsuccess = (
            req as { onsuccess?: (e: { target: { result: unknown } }) => void }
          ).onsuccess;
          if (typeof onsuccess === "function")
            onsuccess({ target: { result: stubDb } });
        });
        return req;
      },
    };
  }
}
