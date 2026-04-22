"use client";

import { useTheme } from "next-themes";
import * as React from "react";

import { useSession } from "~/lib/auth-client";

const THEMES = new Set(["light", "dark", "system"] as const);
type Theme = "dark" | "light" | "system";

/**
 * client-only theme sync for logged-in users.
 *
 * sequence (important — prevents a race where local state clobbers server state
 * on a new device):
 *   1. on mount, next-themes has already applied the user's local preference
 *      from localStorage (instant, no flash).
 *   2. once a session exists, we GET /api/user/profile on idle. if the server
 *      value differs from local, we call setTheme(server). the PATCH effect is
 *      gated until this server round-trip resolves so the initial "seed" write
 *      always reflects the authoritative server value.
 *   3. after that, any user-driven theme change PATCHes back to the server.
 */
export function ThemePersistSync() {
  const { setTheme, theme } = useTheme();
  const { data } = useSession();
  const serverAppliedRef = React.useRef(false);
  const lastSyncedThemeRef = React.useRef<null | Theme>(null);
  const userId = data?.user?.id;

  React.useEffect(() => {
    if (serverAppliedRef.current || !userId) return;

    const ctrl = new AbortController();
    const run = () => {
      fetch("/api/user/profile", { signal: ctrl.signal })
        .then((r) => (r.ok ? (r.json() as Promise<unknown>) : null))
        .then((body) => {
          if (ctrl.signal.aborted) return;
          if (
            body &&
            typeof body === "object" &&
            "theme" in body &&
            isTheme((body as { theme: unknown }).theme)
          ) {
            const serverTheme = (body as { theme: Theme }).theme;
            lastSyncedThemeRef.current = serverTheme;
            setTheme(serverTheme);
          }
          // open the PATCH gate AFTER the server value is the current one.
          serverAppliedRef.current = true;
        })
        .catch(() => {
          // network/abort: still open the gate so user-driven changes persist.
          serverAppliedRef.current = true;
        });
    };

    const idle =
      typeof window !== "undefined" &&
      "requestIdleCallback" in window &&
      (
        window as Window & {
          requestIdleCallback?: (cb: () => void) => number;
        }
      ).requestIdleCallback;

    let timeoutId: null | ReturnType<typeof setTimeout> = null;
    if (typeof idle === "function") {
      idle(run);
    } else {
      timeoutId = setTimeout(run, 150);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      ctrl.abort();
    };
  }, [userId, setTheme]);

  React.useEffect(() => {
    if (!userId || !isTheme(theme)) return;
    // gate until we've observed the server's authoritative value; otherwise the
    // first mount on a new device could PATCH localStorage-derived theme over
    // the real server preference.
    if (!serverAppliedRef.current) return;
    if (lastSyncedThemeRef.current === theme) return;
    lastSyncedThemeRef.current = theme;

    const ctrl = new AbortController();
    fetch("/api/user/profile", {
      body: JSON.stringify({ theme }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
      signal: ctrl.signal,
    }).catch(() => {
      /* ignore: localStorage still retains the choice */
    });
    return () => ctrl.abort();
  }, [userId, theme]);

  return null;
}

function isTheme(v: unknown): v is Theme {
  return typeof v === "string" && THEMES.has(v as Theme);
}
