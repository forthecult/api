"use client";

import { KeyRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { SEO_CONFIG, SYSTEM_CONFIG } from "~/app";
import { authClient, signIn } from "~/lib/auth-client";
import { GitHubIcon } from "~/ui/components/icons/github";
import { GoogleIcon } from "~/ui/components/icons/google";
import { Button } from "~/ui/primitives/button";
import { Card, CardContent } from "~/ui/primitives/card";
import { Input } from "~/ui/primitives/input";
import { Label } from "~/ui/primitives/label";
import { Separator } from "~/ui/primitives/separator";

type EmailSignInMethod = "code" | "password";

export function SignInPageClient() {
  const [method, setMethod] = useState<EmailSignInMethod>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendCodeLoading, setSendCodeLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  const handleEmailPasswordLogin = async (e: React.FormEvent) => {
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
        return;
      }
      window.location.href = SYSTEM_CONFIG.redirectAfterSignIn;
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
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtpCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Email is required.");
      return;
    }
    setError("");
    setSendCodeLoading(true);
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: trimmed,
        type: "sign-in",
      });
      if (result?.error) {
        setError(
          typeof result.error.message === "string"
            ? result.error.message
            : "Failed to send code",
        );
        return;
      }
      setOtpSent(true);
      setOtpCode("");
    } finally {
      setSendCodeLoading(false);
    }
  };

  const handleEmailOtpLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    const code = otpCode.replace(/\D/g, "");
    if (!trimmed) {
      setError("Email is required.");
      return;
    }
    if (code.length < 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const result = await signIn.emailOtp({
        email: trimmed,
        otp: code,
      });
      if (result?.error) {
        setError(
          typeof result.error.message === "string"
            ? result.error.message
            : "Invalid or expired code",
        );
        return;
      }
      window.location.href = SYSTEM_CONFIG.redirectAfterSignIn;
    } catch (err) {
      const message =
        err &&
        typeof err === "object" &&
        "message" in err &&
        typeof (err as { message: unknown }).message === "string"
          ? (err as { message: string }).message
          : "Invalid or expired code";
      setError(message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGitHubLogin = () => {
    setLoading(true);
    try {
      void signIn.social({ provider: "github" });
    } catch (err) {
      setError("Failed to sign in with GitHub");
      console.error(err);
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setLoading(true);
    try {
      void signIn.social({ provider: "google" });
    } catch (err) {
      setError("Failed to sign in with Google");
      console.error(err);
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setError("");
    setPasskeyLoading(true);
    try {
      const result = await authClient.signIn.passkey({
        fetchOptions: {
          onError: (_ctx) => {
            setError("Sign in with security key failed or was cancelled.");
            setPasskeyLoading(false);
          },
          onSuccess: () => {
            window.location.href = SYSTEM_CONFIG.redirectAfterSignIn;
          },
        },
      });
      if (result?.error) {
        setError(
          typeof result.error.message === "string"
            ? result.error.message
            : "Sign in with security key failed",
        );
      } else if (result?.data && !result.error) {
        window.location.href = SYSTEM_CONFIG.redirectAfterSignIn;
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Sign in with security key failed",
      );
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <div
      className={`
        grid h-screen w-full max-w-[100vw] overflow-x-hidden
        md:grid-cols-2
      `}
    >
      {/* Left side - Image */}
      <div
        className={`
          relative hidden min-w-0
          md:block
        `}
      >
        <Image
          alt="Sign-in background image"
          className="object-cover"
          fill
          priority
          sizes="(max-width: 768px) 0vw, 50vw"
          src="https://images.unsplash.com/photo-1719811059181-09032aef07b8?q=80&w=1200&auto=format&fit=crop&ixlib=rb-4.0.3"
        />
        <div
          className={`
            absolute inset-0 bg-gradient-to-t from-background/80 to-transparent
          `}
        />
        <div className="absolute bottom-8 left-8 z-10 text-white">
          <h1 className="text-3xl font-bold">{SEO_CONFIG.name}</h1>
          <p className="mt-2 max-w-md text-sm text-white/80">
            {SEO_CONFIG.slogan}
          </p>
        </div>
      </div>

      {/* Right side - Login form */}
      <div
        className={`
          flex min-w-0 items-center justify-center p-4
          md:p-8
        `}
      >
        <div className="w-full max-w-md min-w-0 space-y-4">
          <div
            className={`
              space-y-4 text-center
              md:text-left
            `}
          >
            <h2 className="text-3xl font-bold">Sign In</h2>
            <p className="text-sm text-muted-foreground">
              Enter your credentials to access your account
            </p>
          </div>

          <Card className="border-none">
            <CardContent className="pt-2">
              <div className="mb-4 flex gap-2 rounded-lg bg-muted/50 p-1">
                <button
                  className={`
                    flex-1 rounded-md px-3 py-2 text-sm font-medium
                    transition-colors
                    ${
                      method === "password"
                        ? "bg-background text-foreground shadow"
                        : `
                          text-muted-foreground
                          hover:text-foreground
                        `
                    }
                  `}
                  onClick={() => {
                    setMethod("password");
                    setError("");
                    setOtpSent(false);
                    setOtpCode("");
                  }}
                  type="button"
                >
                  Password
                </button>
                <button
                  className={`
                    flex-1 rounded-md px-3 py-2 text-sm font-medium
                    transition-colors
                    ${
                      method === "code"
                        ? "bg-background text-foreground shadow"
                        : `
                          text-muted-foreground
                          hover:text-foreground
                        `
                    }
                  `}
                  onClick={() => {
                    setMethod("code");
                    setError("");
                    setOtpSent(false);
                    setOtpCode("");
                  }}
                  type="button"
                >
                  Email code
                </button>
              </div>

              {method === "password" && (
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleEmailPasswordLogin(e);
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
                        className={`
                          text-sm text-muted-foreground
                          hover:underline
                        `}
                        href="/auth/forgot-password"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <Input
                      id="password"
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      type="password"
                      value={password}
                    />
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
              )}

              {method === "code" && (
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (otpSent) void handleEmailOtpLogin(e);
                    else void handleSendOtpCode(e);
                  }}
                >
                  <div className="grid gap-2">
                    <Label htmlFor="email-otp">Email</Label>
                    <Input
                      disabled={otpSent}
                      id="email-otp"
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="satoshi@nakamoto.com"
                      type="email"
                      value={email}
                    />
                  </div>
                  {otpSent && (
                    <div className="grid gap-2">
                      <Label htmlFor="otp">Verification code</Label>
                      <Input
                        id="otp"
                        inputMode="numeric"
                        maxLength={8}
                        onChange={(e) =>
                          setOtpCode(
                            e.target.value.replace(/\D/g, "").slice(0, 8),
                          )
                        }
                        placeholder="000000"
                        type="text"
                        value={otpCode}
                      />
                      <p className="text-xs text-muted-foreground">
                        Check your inbox for the 6-digit code.
                      </p>
                    </div>
                  )}
                  {error && (
                    <div className="text-sm font-medium text-destructive">
                      {error}
                    </div>
                  )}
                  <Button
                    className="w-full"
                    disabled={
                      loading ||
                      sendCodeLoading ||
                      !email.trim() ||
                      (otpSent && otpCode.replace(/\D/g, "").length < 6)
                    }
                    type="submit"
                  >
                    {loading
                      ? "Signing in..."
                      : sendCodeLoading
                        ? "Sending code..."
                        : otpSent
                          ? "Sign in"
                          : "Send code"}
                  </Button>
                  {otpSent && (
                    <Button
                      className="w-full text-sm"
                      disabled={sendCodeLoading}
                      onClick={(e) => {
                        e.preventDefault();
                        setOtpSent(false);
                        setOtpCode("");
                        setError("");
                      }}
                      type="button"
                      variant="ghost"
                    >
                      Use a different email
                    </Button>
                  )}
                </form>
              )}
              <div className="relative mt-6">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-4">
                <Button
                  className="w-full gap-2"
                  disabled={loading || passkeyLoading}
                  onClick={handlePasskeyLogin}
                  variant="outline"
                >
                  <KeyRound className="h-5 w-5" />
                  {passkeyLoading ? "Signing in…" : "Sign in with security key"}
                </Button>
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    className="flex items-center gap-2"
                    disabled={loading}
                    onClick={handleGitHubLogin}
                    variant="outline"
                  >
                    <GitHubIcon className="h-5 w-5" />
                    GitHub
                  </Button>
                  <Button
                    className="flex items-center gap-2"
                    disabled={loading}
                    onClick={handleGoogleLogin}
                    variant="outline"
                  >
                    <GoogleIcon className="h-5 w-5" />
                    Google
                  </Button>
                </div>
              </div>
              <div className="mt-6 text-center text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link
                  className={`
                    text-primary underline-offset-4
                    hover:underline
                  `}
                  href="/signup"
                >
                  Sign up
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
