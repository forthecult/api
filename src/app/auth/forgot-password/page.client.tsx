"use client";

import { KeyRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { requestPasswordReset } from "~/lib/auth-client";
import { Button } from "~/ui/primitives/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/primitives/card";
import { Input } from "~/ui/primitives/input";
import { Label } from "~/ui/primitives/label";

const redirectTo =
  typeof window !== "undefined"
    ? `${window.location.origin}/auth/reset-password`
    : "";

export function ForgotPasswordClient() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setSent(false);
    try {
      const result = await requestPasswordReset({
        email: email.trim(),
        redirectTo,
      });
      const r = result as { error?: { message?: string } };
      if (r?.error) {
        setError(r.error.message ?? "Failed to send reset email.");
        return;
      }
      setSent(true);
    } catch {
      setError("Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="container flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-6 p-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Check your email
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              If an account exists for {email.trim()}, you will receive a link to
              reset your password. In development without an email provider, the
              link is also printed in the server terminal.
            </p>
            <Button asChild variant="outline">
              <Link href="/login">Back to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-6 p-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Forgot password?
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter your email and we&apos;ll send you a link to set a new
            password.
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </div>
            {error && (
              <div className="text-sm font-medium text-destructive">
                {error}
              </div>
            )}
            <Button className="w-full" disabled={loading} type="submit">
              {loading ? "Sending…" : "Send reset link"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Link
              className="text-primary underline-offset-4 hover:underline"
              href="/login"
            >
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
