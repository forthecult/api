"use client";

import { useTheme } from "next-themes";
import * as React from "react";

import { useSession } from "~/lib/auth-client";

/**
 * For logged-in users: applies saved theme on load and persists theme changes to the server.
 * When initialUserTheme is provided (user has an account), we set it once on mount so the
 * theme is restored after login or on a new device. When the user changes theme, we PATCH
 * it to the profile API so it persists across sessions.
 */
export function ThemePersistSync({
  initialUserTheme,
}: {
  initialUserTheme: string | null;
}) {
  const { setTheme, theme } = useTheme();
  const { data } = useSession();
  const appliedInitial = React.useRef(false);

  // Apply server-saved theme once when we have a logged-in user's preference
  React.useEffect(() => {
    if (appliedInitial.current || !initialUserTheme) return;
    appliedInitial.current = true;
    setTheme(initialUserTheme);
  }, [initialUserTheme, setTheme]);

  // Persist theme changes to server when user is logged in
  React.useEffect(() => {
    if (!data?.user?.id || !theme) return;
    if (theme !== "light" && theme !== "dark" && theme !== "system") return;

    const ctrl = new AbortController();
    fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme }),
      signal: ctrl.signal,
    }).catch(() => {
      // Ignore errors (e.g. network); theme is still in localStorage
    });
    return () => ctrl.abort();
  }, [data?.user?.id, theme]);

  return null;
}
