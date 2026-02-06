"use client";

import { ChevronLeft, KeyRound, Link2, Shield, Wallet } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  authClient,
  listUserAccounts,
  requestPasswordReset,
  twoFactor,
  useCurrentUserOrRedirect,
} from "~/lib/auth-client";
import {
  OPEN_LINK_WALLET_MODAL,
  WALLET_LINKED_EVENT,
} from "~/ui/components/auth/auth-wallet-modal";
import { Button } from "~/ui/primitives/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/primitives/card";
import { Input } from "~/ui/primitives/input";
import { Label } from "~/ui/primitives/label";

const getResetPasswordRedirectUrl = () =>
  typeof window !== "undefined"
    ? `${window.location.origin}/auth/reset-password`
    : "";

type LinkedAccount = { providerId: string; accountId: string; id?: string };

export function SecurityPageClient() {
  const { isPending, user } = useCurrentUserOrRedirect();
  const [password, setPasswordInput] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [qrCodeData, setQrCodeData] = useState("");
  const [qrCodeImageUrl, setQrCodeImageUrl] = useState<string | null>(null);
  const [qrCodeError, setQrCodeError] = useState<string | null>(null);
  const [secret, setSecret] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [addEmailPassword, setAddEmailPassword] = useState({
    email: "",
    password: "",
    confirm: "",
  });
  const [addEmailStep, setAddEmailStep] = useState<"email" | "code" | "password">("email");
  const [addEmailCode, setAddEmailCode] = useState("");
  const [addEmailLoading, setAddEmailLoading] = useState(false);
  const [addEmailSendCodeLoading, setAddEmailSendCodeLoading] = useState(false);
  const [addEmailVerifyLoading, setAddEmailVerifyLoading] = useState(false);
  const [addEmailError, setAddEmailError] = useState("");

  const fetchAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const res = await listUserAccounts();
      if (res.error) {
        setAccounts([]);
        return;
      }
      const list = (res.data ?? []).map(
        (a: { providerId: string; accountId: string; id?: string }) => ({
          providerId: a.providerId,
          accountId: a.accountId,
          id: a.id,
        }),
      );
      setAccounts(list);
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void fetchAccounts();
  }, [user, fetchAccounts]);

  // Render QR code from otpauth URL (browsers cannot load otpauth:// as img src)
  useEffect(() => {
    if (!qrCodeData?.trim()) {
      setQrCodeImageUrl(null);
      setQrCodeError(null);
      return;
    }
    setQrCodeError(null);
    let cancelled = false;
    import("qrcode")
      .then((QRCodeModule) => {
        const QRCode = QRCodeModule.default;
        return QRCode.toDataURL(qrCodeData.trim(), {
          width: 192,
          margin: 1,
          errorCorrectionLevel: "M",
        });
      })
      .then((dataUrl) => {
        if (!cancelled && dataUrl?.startsWith("data:")) {
          setQrCodeImageUrl(dataUrl);
        } else if (!cancelled) {
          setQrCodeImageUrl(null);
          setQrCodeError("Could not generate QR image. Use manual code below.");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setQrCodeImageUrl(null);
          setQrCodeError(
            err instanceof Error ? err.message : "QR failed. Use manual code below.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [qrCodeData]);

  // Listen for wallet linked event to refresh accounts list
  useEffect(() => {
    const handleWalletLinked = () => {
      void fetchAccounts();
    };
    window.addEventListener(WALLET_LINKED_EVENT, handleWalletLinked);
    return () => {
      window.removeEventListener(WALLET_LINKED_EVENT, handleWalletLinked);
    };
  }, [fetchAccounts]);

  const hasCredential = accounts.some((a) => a.providerId === "credential");
  const canUnlink = accounts.length > 1;

  const handleOpenLinkWallet = () => {
    window.dispatchEvent(new CustomEvent(OPEN_LINK_WALLET_MODAL));
  };

  const handleUnlink = async (
    accountId: string,
    providerId: string,
    id?: string,
  ) => {
    if (!canUnlink) return;
    setUnlinkingId(id ?? accountId);
    try {
      const res = await authClient.unlinkAccount({ accountId, providerId });
      if (res.error) {
        setError(res.error.message ?? "Failed to unlink");
        return;
      }
      await fetchAccounts();
    } finally {
      setUnlinkingId(null);
    }
  };

  const handleSendAddEmailCode = async () => {
    const trimmed = addEmailPassword.email.trim();
    if (!trimmed) {
      setAddEmailError("Email is required.");
      return;
    }
    setAddEmailError("");
    setAddEmailSendCodeLoading(true);
    try {
      const res = await fetch("/api/auth/add-email/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setAddEmailError(data.error ?? "Failed to send code.");
        return;
      }
      setAddEmailStep("code");
      setAddEmailCode("");
      setMessage("Check your inbox for the verification code.");
    } finally {
      setAddEmailSendCodeLoading(false);
    }
  };

  const handleVerifyAddEmailCode = async () => {
    const email = addEmailPassword.email.trim().toLowerCase();
    const code = addEmailCode.replace(/\D/g, "");
    if (!email) {
      setAddEmailError("Email is required.");
      return;
    }
    if (code.length < 6) {
      setAddEmailError("Enter the 6-digit code from your email.");
      return;
    }
    setAddEmailError("");
    setAddEmailVerifyLoading(true);
    try {
      const res = await fetch("/api/auth/add-email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setAddEmailError(data.error ?? "Invalid or expired code.");
        return;
      }
      setAddEmailStep("password");
      setMessage("");
    } finally {
      setAddEmailVerifyLoading(false);
    }
  };

  const handleAddEmailPassword = async () => {
    const { email, password, confirm } = addEmailPassword;
    const trimmed = email.trim();
    if (!trimmed) {
      setAddEmailError("Email is required.");
      return;
    }
    if (!password) {
      setAddEmailError("Password is required.");
      return;
    }
    if (password.length < 8) {
      setAddEmailError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setAddEmailError("Passwords do not match.");
      return;
    }
    setAddEmailError("");
    setAddEmailLoading(true);
    try {
      const updateRes = await authClient.updateUser({
        email: trimmed,
      } as Record<string, unknown>);
      if (updateRes.error) {
        setAddEmailError(updateRes.error.message ?? "Failed to set email.");
        return;
      }
      const setPassRes = await (authClient as { setPassword?: (opts: { newPassword: string }) => Promise<{ error?: { message?: string } }> }).setPassword?.({
        newPassword: password,
      });
      if (setPassRes === undefined) {
        setAddEmailError("Set password is not available.");
        return;
      }
      if (setPassRes.error) {
        setAddEmailError(setPassRes.error.message ?? "Failed to set password.");
        return;
      }
      setAddEmailPassword({ email: "", password: "", confirm: "" });
      setAddEmailStep("email");
      setAddEmailCode("");
      setMessage(
        "Email and password added. You can now sign in with email/password.",
      );
      await fetchAccounts();
    } finally {
      setAddEmailLoading(false);
    }
  };

  if (isPending) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const handleEnableTwoFactor = () => {
    if (!password) {
      setError("Password is required");
      return;
    }
    setError("");
    setMessage("");
    setOtpCode("");
    setQrCodeError(null);
    setQrCodeImageUrl(null);
    setLoading(true);
    twoFactor
      .enable({ password })
      .then((result) => {
        if ("data" in result && result.data) {
          const data = result.data as { totpURI?: string; uri?: string };
          const uri = data.totpURI ?? data.uri ?? "";
          if (!uri || typeof uri !== "string") {
            setError(
              "Failed to enable two-factor authentication. Unexpected response format.",
            );
            return;
          }
          setQrCodeData(uri);
          if (uri.includes("secret=")) {
            const secretMatch = uri.split("secret=")[1];
            if (secretMatch) {
              const extractedSecret = secretMatch.split("&")[0]?.trim();
              if (extractedSecret) setSecret(extractedSecret);
            }
          }
          setShowQrCode(true);
          setMessage(
            "Scan the QR code with your authenticator app (or enter the manual code), then enter the 6-digit code below to activate 2FA.",
          );
        } else {
          setError(
            "Failed to enable two-factor authentication. Unexpected response format.",
          );
        }
      })
      .catch(() => {
        setError(
          "Failed to enable two-factor authentication. Please try again.",
        );
      })
      .finally(() => setLoading(false));
  };

  const handleVerifyTotp = () => {
    const code = otpCode.replace(/\s/g, "").trim();
    if (!code || code.length < 6) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setError("");
    setVerifyLoading(true);
    twoFactor
      .verifyTotp({ code })
      .then((result) => {
        if ("data" in result && result.data) {
          setMessage("Two-factor authentication is now enabled.");
          setShowQrCode(false);
          setQrCodeData("");
          setQrCodeImageUrl(null);
          setQrCodeError(null);
          setSecret("");
          setOtpCode("");
          void authClient.getSession();
        } else {
          setError(
            (result as { error?: { message?: string } }).error?.message ??
              "Invalid code. Please try again.",
          );
        }
      })
      .catch(() => {
        setError("Invalid code or verification failed. Please try again.");
      })
      .finally(() => setVerifyLoading(false));
  };

  const handleDisableTwoFactor = () => {
    if (!password) {
      setError("Password is required");
      return;
    }
    setError("");
    setLoading(true);
    twoFactor
      .disable({ password })
      .then(() => {
        setMessage("Two-factor authentication has been disabled");
        setShowQrCode(false);
      })
      .catch(() => {
        setError(
          "Failed to disable two-factor authentication. Please try again.",
        );
      })
      .finally(() => setLoading(false));
  };

  const handleSendChangePasswordEmail = () => {
    const email = user?.email?.trim();
    if (!email) {
      setResetError("No email on your account.");
      return;
    }
    setResetError("");
    setResetLoading(true);
    setResetEmailSent(false);
    requestPasswordReset({
      email,
      redirectTo: getResetPasswordRedirectUrl(),
    })
      .then((result: unknown) => {
        const r = result as { error?: { message?: string } };
        if (r?.error) {
          setResetError(r.error.message ?? "Failed to send email.");
          return;
        }
        setResetEmailSent(true);
      })
      .catch(() => {
        setResetError("Failed to send change password email.");
      })
      .finally(() => setResetLoading(false));
  };

  return (
    <div className="container max-w-2xl space-y-6 p-4 md:p-8">
      <div className="flex items-center gap-2">
        <Button
          asChild
          size="icon"
          variant="ghost"
          className="shrink-0"
          aria-label="Back"
        >
          <Link href="/dashboard">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Security</h1>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-md bg-green-50 p-4 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-400">
          {message}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Change password
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            We&apos;ll send you an email with a link to set a new password. Use
            that link to change your password.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {resetError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {resetError}
            </div>
          )}
          {resetEmailSent && (
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-400">
              Check your inbox (and spam) for a link to change your password.
              The link expires in 1 hour.
            </div>
          )}
          <Button
            disabled={resetLoading}
            onClick={handleSendChangePasswordEmail}
            variant="outline"
          >
            {resetLoading ? "Sending…" : "Send change password email"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Linked accounts
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Sign in with any linked method. Connect another wallet or add
            email/password below.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {accountsLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <ul className="space-y-2">
              {accounts.map((acc) => (
                <li
                  key={acc.id ?? `${acc.providerId}-${acc.accountId}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2"
                >
                  <span className="flex items-center gap-2 text-sm">
                    {acc.providerId === "credential" && (
                      <>
                        <KeyRound className="size-4 text-muted-foreground" />
                        Email / password
                      </>
                    )}
                    {acc.providerId === "solana" && (
                      <>
                        <Image
                          src="/crypto/solana/solanaLogoMark.svg"
                          alt=""
                          width={18}
                          height={18}
                          className="rounded object-contain"
                        />
                        <span className="font-mono text-muted-foreground">
                          {acc.accountId.slice(0, 4)}…{acc.accountId.slice(-4)}
                        </span>
                      </>
                    )}
                    {acc.providerId === "ethereum" && (
                      <>
                        <Image
                          src="/crypto/ethereum/ethereum-logo.svg"
                          alt=""
                          width={18}
                          height={18}
                          className="rounded object-contain"
                        />
                        <span className="font-mono text-muted-foreground">
                          {acc.accountId.slice(0, 6)}…{acc.accountId.slice(-4)}
                        </span>
                      </>
                    )}
                    {!["credential", "solana", "ethereum"].includes(
                      acc.providerId,
                    ) && (
                      <span className="font-mono text-muted-foreground">
                        {acc.providerId}
                      </span>
                    )}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={
                      !canUnlink || unlinkingId === (acc.id ?? acc.accountId)
                    }
                    onClick={() =>
                      handleUnlink(acc.accountId, acc.providerId, acc.id)
                    }
                    className="text-destructive hover:text-destructive"
                  >
                    {unlinkingId === (acc.id ?? acc.accountId)
                      ? "Unlinking…"
                      : "Unlink"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={handleOpenLinkWallet}
            className="gap-2"
          >
            <Wallet className="size-4" />
            Connect wallet (Solana or Ethereum)
          </Button>
        </CardContent>
      </Card>

      {!hasCredential && !accountsLoading && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Add email & password
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Add an email and password to sign in with email/password in
              addition to your wallet. We’ll send a verification code to your
              email to confirm it’s yours, then you can set a password.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {addEmailError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {addEmailError}
              </div>
            )}

            {addEmailStep === "email" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="add-email">Email</Label>
                  <Input
                    id="add-email"
                    type="email"
                    value={addEmailPassword.email}
                    onChange={(e) =>
                      setAddEmailPassword((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    placeholder="you@example.com"
                  />
                </div>
                <Button
                  disabled={addEmailSendCodeLoading}
                  onClick={handleSendAddEmailCode}
                >
                  {addEmailSendCodeLoading ? "Sending…" : "Send verification code"}
                </Button>
              </>
            )}

            {addEmailStep === "code" && (
              <>
                <p className="text-sm text-muted-foreground">
                  We sent a 6-digit code to{" "}
                  <strong>{addEmailPassword.email}</strong>. Enter it below.
                </p>
                <div className="grid gap-2">
                  <Label htmlFor="add-code">Verification code</Label>
                  <Input
                    id="add-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    placeholder="000000"
                    value={addEmailCode}
                    onChange={(e) =>
                      setAddEmailCode(e.target.value.replace(/\D/g, "").slice(0, 8))
                    }
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={addEmailVerifyLoading || addEmailCode.length < 6}
                    onClick={handleVerifyAddEmailCode}
                  >
                    {addEmailVerifyLoading ? "Verifying…" : "Verify"}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={addEmailSendCodeLoading}
                    onClick={() => {
                      setAddEmailCode("");
                      setAddEmailError("");
                      void handleSendAddEmailCode();
                    }}
                  >
                    {addEmailSendCodeLoading ? "Sending…" : "Resend code"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setAddEmailStep("email");
                      setAddEmailCode("");
                      setAddEmailError("");
                    }}
                  >
                    Use a different email
                  </Button>
                </div>
              </>
            )}

            {addEmailStep === "password" && (
              <>
                <p className="text-sm text-muted-foreground">
                  Email verified. Choose a password for{" "}
                  <strong>{addEmailPassword.email}</strong>.
                </p>
                <div className="grid gap-2">
                  <Label htmlFor="add-password">Password</Label>
                  <Input
                    id="add-password"
                    type="password"
                    value={addEmailPassword.password}
                    onChange={(e) =>
                      setAddEmailPassword((prev) => ({
                        ...prev,
                        password: e.target.value,
                      }))
                    }
                    placeholder="At least 8 characters"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="add-confirm">Confirm password</Label>
                  <Input
                    id="add-confirm"
                    type="password"
                    value={addEmailPassword.confirm}
                    onChange={(e) =>
                      setAddEmailPassword((prev) => ({
                        ...prev,
                        confirm: e.target.value,
                      }))
                    }
                    placeholder="Repeat password"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={addEmailLoading} onClick={handleAddEmailPassword}>
                    {addEmailLoading ? "Adding…" : "Add email & password"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setAddEmailStep("code");
                      setAddEmailPassword((prev) => ({
                        ...prev,
                        password: "",
                        confirm: "",
                      }));
                      setAddEmailError("");
                    }}
                  >
                    Back to code
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {showQrCode && qrCodeData && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Add to authenticator app</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center">
              {qrCodeImageUrl ? (
                <img
                  alt="QR Code for Two-Factor Authentication"
                  className="h-48 w-48 rounded border border-border object-contain"
                  src={qrCodeImageUrl}
                />
              ) : (
                <div className="flex h-48 w-48 flex-col items-center justify-center gap-2 rounded border border-dashed border-muted-foreground/30 bg-muted/30 text-center text-sm text-muted-foreground">
                  {qrCodeError ? (
                    <span className="px-2">{qrCodeError}</span>
                  ) : (
                    <span>Generating QR…</span>
                  )}
                </div>
              )}
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Scan the QR code with your authenticator app (Google
                Authenticator, Authy, etc.), or use the manual code below.
              </p>
              {secret && (
                <div className="mt-4 w-full max-w-md">
                  <p className="text-sm font-medium">Manual entry code:</p>
                  <p className="mt-2 break-all rounded-md bg-muted p-4 font-mono text-sm">
                    {secret}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {showQrCode && qrCodeData && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Enter code to activate 2FA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              After adding the account in your authenticator app, enter the
              6-digit code it shows below to finish setup.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[140px] flex-1 space-y-2">
                <Label htmlFor="otp-code">6-digit code</Label>
                <Input
                  id="otp-code"
                  inputMode="numeric"
                  maxLength={8}
                  placeholder="000000"
                  value={otpCode}
                  onChange={(e) =>
                    setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 8))
                  }
                />
              </div>
              <Button
                disabled={verifyLoading || otpCode.length < 6}
                onClick={() => handleVerifyTotp()}
              >
                {verifyLoading ? "Verifying…" : "Activate 2FA"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Two-Factor Authentication
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="security-password">Your Password</Label>
            <Input
              id="security-password"
              type="password"
              value={password}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Enter your password"
            />
            <p className="text-sm text-muted-foreground">
              Required to change your two-factor authentication settings
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Button disabled={loading} onClick={handleEnableTwoFactor}>
              {loading ? "Processing..." : "Enable Two-Factor"}
            </Button>
            <Button
              disabled={loading}
              variant="destructive"
              onClick={handleDisableTwoFactor}
            >
              {loading ? "Processing..." : "Disable Two-Factor"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Backup Codes</CardTitle>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/auth/mfa">Manage backup codes</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
