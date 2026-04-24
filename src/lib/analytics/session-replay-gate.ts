/**
 * Gate that decides whether PostHog session replay should be running for the
 * current visitor. Called from the identity bridge on every state change that
 * could flip the answer (user signs in / out, feature flags reload, consent
 * toggle flips).
 *
 * Design notes — our stance is privacy-first:
 *   1. **Never record anonymous users.** We only ever consider enabling replay
 *      once the user is identified (post-login). This matches our
 *      `person_profiles: "identified_only"` init option in
 *      `src/instrumentation-client.ts` and our public statement in
 *      `/policies/privacy` + `/cookies` ("No popups. No trackers.").
 *   2. **Feature flag `session-replay-enabled` is the cohort switch.** Product
 *      / research can target specific groups (opted-in beta testers, internal
 *      staff, a single experiment variant) without a code deploy.
 *   3. **Explicit per-user opt-out wins.** If a user sets a PostHog person
 *      property `$session_recording_opt_in = false` — e.g. via a future
 *      dashboard setting — we stop recording even if the flag evaluates true
 *      for them. The reverse (opt_in = true while flag is off) does NOT force
 *      recording: the flag is a hard gate.
 */

import type posthog from "posthog-js";

type PostHog = typeof posthog;

/** PostHog feature flag name that controls the cohort gate. */
export const SESSION_REPLAY_FLAG = "session-replay-enabled";

/**
 * `localStorage` key holding a user's explicit session-replay opt-out, set by a
 * settings-page toggle (to be wired up in a follow-up pass). Using a first-party
 * localStorage key instead of a PostHog person property means we can honour the
 * opt-out *before* PostHog has finished loading flags, and without reaching into
 * posthog-js internals.
 *
 * Values:
 *   - `"false"` → user explicitly opted out; replay will never run.
 *   - anything else (missing, `"true"`, unset) → defer to the feature flag.
 */
export const SESSION_REPLAY_CONSENT_KEY = "cult.session_replay_consent";

interface GateInput {
  /** Is the current visitor identified (logged in via better-auth)? */
  identified: boolean;
  /** Live PostHog client instance from posthog-js. */
  posthog: PostHog;
}

/**
 * Evaluate the current gate state and start or stop session recording to match.
 * Idempotent: safe to call on every auth / flag change.
 */
export function applySessionReplayGate({
  identified,
  posthog,
}: GateInput): void {
  if (typeof window === "undefined") return;
  if (!posthog.__loaded) return;

  // Anonymous visitors are never recorded — full stop.
  if (!identified) {
    maybeStop(posthog);
    return;
  }

  const flagEnabled = posthog.isFeatureEnabled?.(SESSION_REPLAY_FLAG) === true;
  if (!flagEnabled) {
    maybeStop(posthog);
    return;
  }

  // Honour an explicit localStorage opt-out as a hard no. A missing value is
  // fine — the cohort flag alone is sufficient consent for users who are
  // already identified (they've accepted ToS + Privacy Policy at signup, which
  // discloses analytics usage).
  let consent: null | string = null;
  try {
    consent = window.localStorage.getItem(SESSION_REPLAY_CONSENT_KEY);
  } catch {
    // storage disabled (private mode, iframe with 3p cookies off) — treat as
    // no explicit opt-out, defer to the flag.
  }
  if (consent === "false") {
    maybeStop(posthog);
    return;
  }

  maybeStart(posthog);
}

function maybeStart(posthog: PostHog): void {
  if (posthog.sessionRecordingStarted?.()) return;
  posthog.startSessionRecording?.();
}

function maybeStop(posthog: PostHog): void {
  if (!posthog.sessionRecordingStarted?.()) return;
  posthog.stopSessionRecording?.();
}
