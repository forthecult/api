import { PostHog } from "posthog-node";

import { redactProperties } from "./pii-redact";

let posthog: null | PostHog = null;

/**
 * Server-side PostHog capture.
 *
 * Every event is run through `redactProperties` first (SOC 2 CC6.7):
 *  - Drops any property whose key is in the shared PII denylist.
 *  - Scrubs string values that look like email, phone, CC, or crypto wallets.
 *
 * The one-liner abstraction also keeps the rest of the codebase free of raw
 * `ph.capture(...)` calls, so there is a single choke point to audit.
 */
export function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): void {
  const ph = getPostHogServer();
  if (!ph) return;
  ph.capture({ distinctId, event, properties: redactProperties(properties) });
}

export function getPostHogServer(): null | PostHog {
  const key = getApiKey();
  if (!key) return null;
  if (!posthog) {
    posthog = new PostHog(key, {
      flushAt: 1,
      flushInterval: 0,
      host: getHost(),
    });
  }
  return posthog;
}

export async function shutdownPostHogServer(): Promise<void> {
  if (posthog) {
    await posthog.shutdown();
    posthog = null;
  }
}

function getApiKey(): string {
  return (
    process.env.POSTHOG_SERVER_KEY?.trim() ||
    process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() ||
    ""
  );
}

function getHost(): string {
  const direct = process.env.POSTHOG_HOST?.trim();
  if (direct) {
    try {
      return new URL(direct).origin;
    } catch {
      return direct.replace(/\/$/, "");
    }
  }
  const pub = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();
  if (pub?.startsWith("http")) {
    try {
      return new URL(pub).origin;
    } catch {
      return pub.replace(/\/$/, "");
    }
  }
  return "https://us.i.posthog.com";
}
