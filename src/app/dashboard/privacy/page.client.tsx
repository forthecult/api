"use client";

import { Fingerprint } from "lucide-react";
import * as React from "react";

import { SESSION_REPLAY_CONSENT_KEY } from "~/lib/analytics/session-replay-gate";
import { useCurrentUser } from "~/lib/auth-client";
import { Alert, AlertDescription, AlertTitle } from "~/ui/primitives/alert";
import { Button } from "~/ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/ui/primitives/card";
import { Label } from "~/ui/primitives/label";
import { Switch } from "~/ui/primitives/switch";

export function PrivacyPageClient() {
  const { user } = useCurrentUser();
  const [adForwarding, setAdForwarding] = React.useState(true);
  const [replayOptOut, setReplayOptOut] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [savingAd, setSavingAd] = React.useState(false);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const v = window.localStorage.getItem(SESSION_REPLAY_CONSENT_KEY);
      setReplayOptOut(v === "false");
    } catch {
      setReplayOptOut(false);
    }
  }, []);

  React.useEffect(() => {
    if (!user) return;
    const ac = new AbortController();
    setError(false);
    fetch("/api/user/privacy", { credentials: "include", signal: ac.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((raw: unknown) => {
        const data = raw as { adPlatformConversionForwarding?: boolean } | null;
        if (data && typeof data.adPlatformConversionForwarding === "boolean") {
          setAdForwarding(data.adPlatformConversionForwarding);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [user]);

  const persistAdForwarding = React.useCallback((next: boolean) => {
    setSavingAd(true);
    setAdForwarding(next);
    fetch("/api/user/privacy", {
      body: JSON.stringify({ adPlatformConversionForwarding: next }),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    })
      .then((res) => {
        if (!res.ok) throw new Error("save failed");
      })
      .catch(() => {
        setAdForwarding(!next);
        setError(true);
      })
      .finally(() => setSavingAd(false));
  }, []);

  const onReplayToggle = React.useCallback((checked: boolean) => {
    // checked = user wants replay ON → opt-out false; unchecked = opt out
    const optOut = !checked;
    setReplayOptOut(optOut);
    try {
      if (optOut) {
        window.localStorage.setItem(SESSION_REPLAY_CONSENT_KEY, "false");
      } else {
        window.localStorage.removeItem(SESSION_REPLAY_CONSENT_KEY);
      }
    } catch {
      // ignore
    }
    window.location.reload();
  }, []);

  if (!user) {
    return (
      <Alert>
        <AlertTitle>Sign in required</AlertTitle>
        <AlertDescription>Log in to manage privacy settings.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4 md:p-8">
      <div className="flex items-center gap-3">
        <Fingerprint aria-hidden className="h-8 w-8 text-primary" />
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Privacy & ads
          </h1>
          <p className="text-muted-foreground text-sm">
            Control session replay and server-side ad conversion signals. We do
            not add third-party marketing pixels on the storefront.
          </p>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>Try again in a moment.</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Ad platform conversions (CAPI)</CardTitle>
          <CardDescription>
            When enabled, we may send minimal, hashed purchase signals to ad
            platforms you run campaigns on (no pixel on our site). Disable if
            you do not want those outbound server calls tied to your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="ad-forward">Allow server-side ad conversions</Label>
            <p className="text-muted-foreground text-xs">
              First-party PostHog analytics are unchanged.
            </p>
          </div>
          <Switch
            checked={adForwarding}
            disabled={loading || savingAd}
            id="ad-forward"
            onCheckedChange={(c) => persistAdForwarding(c)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session replay</CardTitle>
          <CardDescription>
            When allowed by our internal flag, signed-in sessions may be
            recorded for debugging. Turn off here to opt out in this browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-row items-center justify-between gap-4">
          <Label htmlFor="replay">Allow session replay (this browser)</Label>
          <Switch
            checked={!replayOptOut}
            id="replay"
            onCheckedChange={(c) => onReplayToggle(c)}
          />
        </CardContent>
      </Card>

      <Button asChild variant="link" className="h-auto p-0 text-sm">
        <a href="/policies/privacy">Read the privacy policy</a>
      </Button>
    </div>
  );
}
