"use client";

import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { SEO_CONFIG, SYSTEM_CONFIG } from "~/app";
import { signIn, useCurrentUserOrRedirect } from "~/lib/auth-client";
import {
  AuthFormDivider,
  AuthFormHeader,
  AuthFormLayout,
} from "~/ui/components/auth/auth-form-layout";
import { SocialLoginButtons } from "~/ui/components/auth/social-login-buttons";
import { Button } from "~/ui/primitives/button";
import { Card, CardContent } from "~/ui/primitives/card";
import { Input } from "~/ui/primitives/input";
import { Label } from "~/ui/primitives/label";

function LoginPageClientInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check for callbackUrl from query params (e.g., from admin app redirect)
  // [SECURITY] Only allow relative paths to prevent open redirect attacks
  const rawCallbackUrl = searchParams.get("callbackUrl");
  const isRelativePath =
    rawCallbackUrl?.startsWith("/") && !rawCallbackUrl.startsWith("//");
  const redirectTarget: string =
    isRelativePath && rawCallbackUrl
      ? rawCallbackUrl
      : SYSTEM_CONFIG.redirectAfterSignIn;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Track if we're redirecting to prevent double redirects
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Only redirect if user is already logged in (not after form submission)
  // Pass empty okUrl when redirecting to prevent hook from also redirecting
  const { isPending: isSessionPending, user } = useCurrentUserOrRedirect(
    undefined,
    isRedirecting ? "" : redirectTarget,
    true,
  );

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn.email({
        email,
        password,
      });
      if (result?.error) {
        setError(
          typeof result.error.message === "string"
            ? result.error.message
            : "Invalid email or password",
        );
        setLoading(false);
        return;
      }
      // Mark as redirecting to prevent useCurrentUserOrRedirect from also redirecting
      setIsRedirecting(true);
      // Small delay to ensure session cookie is fully set before redirect
      // This prevents the dashboard from not seeing the session immediately
      setTimeout(() => {
        window.location.href = redirectTarget;
      }, 100);
    } catch (err) {
      const message =
        err &&
        typeof err === "object" &&
        "message" in err &&
        typeof (err as { message: unknown }).message === "string"
          ? (err as { message: string }).message
          : "Invalid email or password";
      setError(message);
      console.error(err);
      setLoading(false);
    }
  };

  if (isSessionPending || isRedirecting || user) {
    return (
      <div className="flex h-screen w-full max-w-[100vw] items-center justify-center overflow-x-hidden">
        <p className="text-muted-foreground">
          {isRedirecting || user ? "Redirecting…" : "Checking session…"}
        </p>
      </div>
    );
  }

  return (
    <AuthFormLayout>
      <AuthFormHeader
        title="Welcome back!"
        subtitle={`Log in below to access your ${SEO_CONFIG.name} Account`}
      />

      <Card className="border-none shadow-sm">
        <CardContent className="pt-2">
          <SocialLoginButtons
            disabled={loading}
            onError={setError}
            showWalletConnect
          />

          <div className="mt-6">
            <AuthFormDivider />
          </div>

          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleEmailLogin(e);
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="satoshi@nakamoto.com"
                required
                type="email"
                value={email}
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  className="text-sm text-muted-foreground hover:underline"
                  href="/auth/forgot-password"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  className="pr-10"
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            {error && (
              <div className="text-sm font-medium text-destructive">
                {error}
              </div>
            )}
            <Button className="w-full" disabled={loading} type="submit">
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              className="text-primary underline-offset-4 hover:underline"
              href="/signup"
            >
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthFormLayout>
  );
}

export function LoginPageClient() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
          Loading…
        </div>
      }
    >
      <LoginPageClientInner />
    </Suspense>
  );
}
