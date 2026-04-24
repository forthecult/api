/**
 * Runs once when the Next.js server starts. Used to suppress noisy dependency warnings
 * that are harmless (e.g. bigint-buffer falling back to pure JS when native bindings
 * aren't available under Bun), and to stub browser-only globals so deps (e.g. uploadthing
 * or wallet libs) that use indexedDB don't throw ReferenceError on the server.
 */

/**
 * Next.js 16 `onRequestError` hook: invoked for every uncaught error thrown
 * during a server render, a server action, or a route handler. We forward it
 * to PostHog (server SDK) so server crashes show up in the same error stream
 * as client-side `$exception` events. Paired with `capture_exceptions: true`
 * on the client (see instrumentation-client.ts) this gives full-stack visibility.
 *
 * The `error`, `request`, and `context` arguments are typed by Next.js itself.
 */
export const onRequestError: (
  error: unknown,
  request: {
    headers: Record<string, string | string[] | undefined>;
    method: string;
    path: string;
  },
  context: {
    renderSource?:
      | "react-server-components"
      | "react-server-components-payload"
      | "server-rendering";
    renderType?: "dynamic" | "dynamic-resume";
    revalidateReason?: "on-demand" | "stale" | undefined;
    routePath: string;
    routerKind: "App Router" | "Pages Router";
    routeType: "action" | "middleware" | "render" | "route";
  },
) => Promise<void> = async (error, request, context) => {
  try {
    const { getPostHogServer } = await import("./lib/analytics/posthog-server");
    const ph = getPostHogServer();
    if (!ph) return;
    // distinct_id: we can't see the user here (no headers helper outside a
    // request scope), so bucket by route for now. Upstream PostHog will link
    // session IDs via posthog-js auto-capture when available.
    // captureExceptionImmediate returns a Promise we can await, so events
    // are flushed even in serverless/edge environments where the function may
    // exit right after this handler returns.
    await ph.captureExceptionImmediate(
      error instanceof Error ? error : new Error(String(error)),
      `server:${context.routePath}`,
      {
        method: request.method,
        path: request.path,
        routerKind: context.routerKind,
        routeType: context.routeType,
      },
    );
  } catch {
    // never let observability break the server
  }
};

export function register(): void {
  // m8: enforce presence of a shared rate-limit store in prod before anything
  // accepts traffic. m6 / h3 do the same for virustotal / auth-secret, but we
  // import those lazily; rate-limit is imported on most routes so a top-level
  // assert here catches config drift earlier.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    void import("./lib/rate-limit").then(
      ({ assertRateLimitStoreConfigured }) => {
        assertRateLimitStoreConfigured();
      },
    );
  }
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
