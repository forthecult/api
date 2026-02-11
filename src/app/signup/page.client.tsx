"use client";

import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SYSTEM_CONFIG } from "~/app";
import { signUp, useCurrentUserOrRedirect } from "~/lib/auth-client";
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

export function SignupPageClient() {
  const router = useRouter();
  const { isPending: isSessionPending } = useCurrentUserOrRedirect(
    undefined,
    SYSTEM_CONFIG.redirectAfterSignIn,
    true,
  );
  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const MIN_PASSWORD_LENGTH = 8;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setLoading(true);

    const firstName = formData.firstName.trim();
    const lastName = formData.lastName.trim();
    const fullName = [firstName, lastName].filter(Boolean).join(" ") || "";
    void signUp
      .email({
        email: formData.email,
        name: fullName,
        password: formData.password,
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
      })
      .then((result) => {
        if (result && typeof result === "object" && "error" in result && result.error) {
          const errObj = result.error as { message?: string };
          setError(errObj.message ?? "Registration failed. Please try again.");
          return;
        }
        // Auto sign-in is enabled, redirect to dashboard
        router.push(SYSTEM_CONFIG.redirectAfterSignUp);
      })
      .catch((err: unknown) => {
        const message =
          err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string"
            ? (err as { message: string }).message
            : "Registration failed. Please try again.";
        setError(message);
        console.error(err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  if (isSessionPending) {
    return (
      <div className="flex h-screen w-full max-w-[100vw] items-center justify-center overflow-x-hidden">
        <p className="text-muted-foreground">Checking session…</p>
      </div>
    );
  }

  return (
    <AuthFormLayout>
      <AuthFormHeader
        title="Create Account"
        subtitle="Enter your details to create your account"
      />

      <Card className="border-none shadow-sm">
        <CardContent className="pt-2">
          <SocialLoginButtons
            disabled={loading}
            onError={setError}
            showWalletConnect
          />

          <div className="mt-6">
            <AuthFormDivider text="Or continue with" />
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label htmlFor="firstName">First name (optional)</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  onChange={handleChange}
                  placeholder="Satoshi"
                  type="text"
                  value={formData.firstName}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastName">Last name (optional)</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  onChange={handleChange}
                  placeholder="Nakamoto"
                  type="text"
                  value={formData.lastName}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                onChange={handleChange}
                placeholder="hal@finney.com"
                required
                type="email"
                value={formData.email}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  className="pr-10"
                  minLength={MIN_PASSWORD_LENGTH}
                  onChange={handleChange}
                  required
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
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
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              className="text-primary underline-offset-4 hover:underline"
              href="/login"
            >
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthFormLayout>
  );
}
