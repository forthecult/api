"use client";

import { KeyRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { requestPasswordReset } from "~/lib/auth-client";
import {
  AuthFormHeader,
  AuthFormLayout,
} from "~/ui/components/auth/auth-form-layout";
import { Button } from "~/ui/primitives/button";
import { Card, CardContent } from "~/ui/primitives/card";
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
      <AuthFormLayout>
        <div className="space-y-4">
          <AuthFormHeader
            subtitle={`If an account exists for ${email.trim()}, you will receive a link to reset your password. In development without an email provider, the link is also printed in the server terminal.`}
            title="Check your email"
          />
          <Card>
            <CardContent className="pt-6">
              <Button asChild className="w-full" variant="outline">
                <Link href="/login">Back to sign in</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </AuthFormLayout>
    );
  }

  return (
    <AuthFormLayout>
      <div className="space-y-4">
        <AuthFormHeader
          subtitle="Enter your email and we'll send you a link to set a new password."
          title="Forgot password?"
        />
        <Card>
          <CardContent className="pt-6">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  autoComplete="email"
                  id="email"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="satoshi@nakamoto.com"
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
                className={`
                  text-primary underline-offset-4
                  hover:underline
                `}
                href="/login"
              >
                Back to sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </AuthFormLayout>
  );
}
