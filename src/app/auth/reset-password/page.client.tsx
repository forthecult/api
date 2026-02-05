"use client";

import { KeyRound } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

import { resetPassword } from "~/lib/auth-client";
import { Button } from "~/ui/primitives/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/primitives/card";
import { Input } from "~/ui/primitives/input";
import { Label } from "~/ui/primitives/label";

const MIN_PASSWORD_LENGTH = 8;

export function ResetPasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const errorParam = searchParams.get("error");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      if (!token) {
        setError(
          "Missing reset link. Request a new one from Security settings.",
        );
        return;
      }
      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        setError(
          `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
        );
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      setLoading(true);
      try {
        const result = await resetPassword({ newPassword, token });
        if (result?.error) {
          setError(
            typeof result.error.message === "string"
              ? result.error.message
              : "Failed to reset password. The link may have expired.",
          );
          return;
        }
        setSuccess(true);
        setTimeout(() => router.push("/dashboard/security"), 2000);
      } catch (err) {
        setError("Failed to reset password. The link may have expired.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [token, newPassword, confirmPassword, router],
  );

  if (errorParam === "INVALID_TOKEN" || (token === null && !success)) {
    return (
      <div className="container flex min-h-[60vh] max-w-md flex-col justify-center gap-6 p-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-8 w-8 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Invalid or expired link
          </h1>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              This password reset link is invalid or has expired. Request a new
              one from your Security settings.
            </p>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/dashboard/security">Go to Security</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="container flex min-h-[60vh] max-w-md flex-col justify-center gap-6 p-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600 dark:text-green-400">
              Password changed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Your password has been updated. Redirecting you to Security…
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container flex min-h-[60vh] max-w-md flex-col justify-center gap-6 p-4">
      <div className="flex items-center gap-2">
        <KeyRound className="h-8 w-8 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">
          Set new password
        </h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="sr-only">Set new password</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter your new password below. It must be at least{" "}
            {MIN_PASSWORD_LENGTH} characters.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                minLength={MIN_PASSWORD_LENGTH}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Same as above"
                required
                minLength={MIN_PASSWORD_LENGTH}
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Updating…" : "Update password"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Link
              href="/dashboard/security"
              className="underline hover:no-underline"
            >
              Back to Security
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
