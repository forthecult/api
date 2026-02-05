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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
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
      .then(() => {
        router.push("/login?registered=true");
      })
      .catch((err: unknown) => {
        setError("Registration failed. Please try again.");
        console.error(err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  if (isSessionPending) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
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
