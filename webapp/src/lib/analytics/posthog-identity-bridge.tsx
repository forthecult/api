"use client";

import posthog from "posthog-js";
import * as React from "react";

import { useCurrentUser } from "~/lib/auth-client";

import { applySessionReplayGate } from "./session-replay-gate";

/**
 * Ties PostHog's notion of "who is this visitor" to better-auth's session, and
 * evaluates the session-replay gate whenever anything that could change the
 * answer changes.
 *
 * Responsibilities:
 *   1. Call `posthog.identify(userId, props)` when a user logs in so they stop
 *      being anonymous and their events start writing to a billable person
 *      profile (we run `person_profiles: "identified_only"`, so without this
 *      step no profile would ever be created).
 *   2. Call `posthog.reset()` on sign-out so the next visitor in this browser
 *      doesn't inherit the previous account's distinct_id.
 *   3. Apply the session-replay gate (see session-replay-gate.ts) on identify,
 *      on logout, and whenever feature flags reload. The gate itself is
 *      idempotent, so over-calling is fine.
 *
 * Renders nothing — this is an effect-only component.
 */
export function PostHogIdentityBridge(): null {
  const { user } = useCurrentUser();
  const lastIdentifiedRef = React.useRef<null | string>(null);

  const userId = user?.id;
  const userEmail = user?.email;
  const userName = user?.name;

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!posthog.__loaded) return;

    if (userId) {
      if (lastIdentifiedRef.current !== userId) {
        posthog.identify(userId, {
          ...(userEmail ? { email: userEmail } : {}),
          ...(userName ? { name: userName } : {}),
        });
        lastIdentifiedRef.current = userId;
      }
      applySessionReplayGate({ identified: true, posthog });
      return;
    }

    // Transitioned from identified → anonymous (sign-out).
    if (lastIdentifiedRef.current) {
      posthog.reset();
      lastIdentifiedRef.current = null;
    }
    applySessionReplayGate({ identified: false, posthog });
  }, [userId, userEmail, userName]);

  // Re-evaluate the replay gate whenever PostHog reloads feature flags (e.g.
  // after network recovery, or when a flag is updated mid-session for a
  // gradual rollout). `onFeatureFlags` returns an unsubscribe function.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!posthog.__loaded) return;

    const unsubscribe = posthog.onFeatureFlags(() => {
      applySessionReplayGate({
        identified: lastIdentifiedRef.current !== null,
        posthog,
      });
    });
    return () => {
      unsubscribe?.();
    };
  }, []);

  return null;
}
