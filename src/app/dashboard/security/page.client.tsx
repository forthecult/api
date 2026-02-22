"use client";

import {
  ChevronLeft,
  KeyRound,
  Link2,
  Shield,
  Trash2,
  Wallet,
} from "lucide-react";
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
import { isRealEmail } from "~/lib/is-real-email";
import {
  OPEN_LINK_WALLET_MODAL,
  WALLET_LINKED_EVENT,
} from "~/ui/components/auth/auth-wallet-modal-events";
import {
  getTelegramBotUsername,
  TelegramLoginWidget,
} from "~/ui/components/auth/telegram-login-widget";
import { DiscordIcon } from "~/ui/components/icons/discord";
import { TelegramIcon } from "~/ui/components/icons/telegram";
import { Button } from "~/ui/primitives/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/primitives/card";
import { Input } from "~/ui/primitives/input";
import { Label } from "~/ui/primitives/label";

const getResetPasswordRedirectUrl = () =>
  typeof window !== "undefined"
    ? `${window.location.origin}/auth/reset-password`
    : "";

interface LinkedAccount {
  accountId: string;
  id?: string;
  providerId: string;
}

export function SecurityPageClient() {
  const { isPending, user } = useCurrentUserOrRedirect();
  const [password, setPasswordInput] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  // MFA / 2FA state grouped together
  const [mfa, setMfa] = useState({
    otpCode: "",
    qrCodeData: "",
    qrCodeError: null as null | string,
    qrCodeImageUrl: null as null | string,
    secret: "",
    showQrCode: false,
    verifyLoading: false,
  });
  // Shorthand setters for MFA fields
  const setShowQrCode = (v: boolean) =>
    setMfa((p) => ({ ...p, showQrCode: v }));
  const setQrCodeData = (v: string) => setMfa((p) => ({ ...p, qrCodeData: v }));
  const setQrCodeImageUrl = (v: null | string) =>
    setMfa((p) => ({ ...p, qrCodeImageUrl: v }));
  const setQrCodeError = (v: null | string) =>
    setMfa((p) => ({ ...p, qrCodeError: v }));
  const setSecret = (v: string) => setMfa((p) => ({ ...p, secret: v }));
  const setOtpCode = (v: string) => setMfa((p) => ({ ...p, otpCode: v }));
  const setVerifyLoading = (v: boolean) =>
    setMfa((p) => ({ ...p, verifyLoading: v }));
  // Aliases for reading MFA state
  const {
    otpCode,
    qrCodeData,
    qrCodeError,
    qrCodeImageUrl,
    secret,
    showQrCode,
    verifyLoading,
  } = mfa;

  // Password reset state
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");

  // Linked accounts
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [unlinkingId, setUnlinkingId] = useState<null | string>(null);

  // Add email flow state grouped together
  const [addEmail, setAddEmail] = useState({
    code: "",
    codeOnlyLoading: false,
    error: "",
    loading: false,
    password: { confirm: "", email: "", password: "" },
    sendCodeLoading: false,
    step: "email" as "choice" | "code" | "email" | "password",
    verifyLoading: false,
  });
  // Shorthand setters for add-email fields (preserves existing call sites)
  const setAddEmailPassword = (
    v: React.SetStateAction<{
      confirm: string;
      email: string;
      password: string;
    }>,
  ) =>
    setAddEmail((p) => ({
      ...p,
      password: typeof v === "function" ? v(p.password) : v,
    }));
  const setAddEmailStep = (v: "choice" | "code" | "email" | "password") =>
    setAddEmail((p) => ({ ...p, step: v }));
  const setAddEmailCode = (v: string) =>
    setAddEmail((p) => ({ ...p, code: v }));
  const setAddEmailLoading = (v: boolean) =>
    setAddEmail((p) => ({ ...p, loading: v }));
  const setAddEmailSendCodeLoading = (v: boolean) =>
    setAddEmail((p) => ({ ...p, sendCodeLoading: v }));
  const setAddEmailVerifyLoading = (v: boolean) =>
    setAddEmail((p) => ({ ...p, verifyLoading: v }));
  const setAddEmailCodeOnlyLoading = (v: boolean) =>
    setAddEmail((p) => ({ ...p, codeOnlyLoading: v }));
  const setAddEmailError = (v: string) =>
    setAddEmail((p) => ({ ...p, error: v }));
  // Aliases for reading add-email state
  const addEmailPassword = addEmail.password;
  const addEmailStep = addEmail.step;
  const addEmailCode = addEmail.code;
  const addEmailLoading = addEmail.loading;
  const addEmailSendCodeLoading = addEmail.sendCodeLoading;
  const addEmailVerifyLoading = addEmail.verifyLoading;
  const addEmailCodeOnlyLoading = addEmail.codeOnlyLoading;
  const addEmailError = addEmail.error;

  // Passkey state
  const [passkeys, setPasskeys] = useState<
    { id: string; name?: null | string }[]
  >([]);
  const [passkeysLoading, setPasskeysLoading] = useState(true);
  const [passkeyAddLoading, setPasskeyAddLoading] = useState(false);
  const [passkeyDeleteId, setPasskeyDeleteId] = useState<null | string>(null);

  const fetchAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const res = await listUserAccounts();
      if (res.error) {
        setAccounts([]);
        return;
      }
      const list = (res.data ?? []).map(
        (a: { accountId: string; id?: string; providerId: string }) => ({
          accountId: a.accountId,
          id: a.id,
          providerId: a.providerId,
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

  const fetchPasskeys = useCallback(async () => {
    setPasskeysLoading(true);
    try {
      const res = await authClient.passkey.listUserPasskeys();
      if (res.data && Array.isArray(res.data)) {
        setPasskeys(
          res.data.map((p: { id: string; name?: null | string }) => ({
            id: p.id,
            name: p.name ?? null,
          })),
        );
      } else {
        setPasskeys([]);
      }
    } catch {
      setPasskeys([]);
    } finally {
      setPasskeysLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void fetchPasskeys();
  }, [user, fetchPasskeys]);

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
          errorCorrectionLevel: "M",
          margin: 1,
          width: 192,
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
            err instanceof Error
              ? err.message
              : "QR failed. Use manual code below.",
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
      if (providerId === "solana") {
        const res = await fetch("/api/auth/unlink-solana-wallet", {
          body: JSON.stringify({ accountId }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Failed to unlink");
          return;
        }
      } else {
        const res = await authClient.unlinkAccount({ accountId, providerId });
        if (res.error) {
          setError(res.error.message ?? "Failed to unlink");
          return;
        }
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
        body: JSON.stringify({ email: trimmed }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
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
        body: JSON.stringify({ code, email }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setAddEmailError(data.error ?? "Invalid or expired code.");
        return;
      }
      setAddEmailStep("choice");
      setMessage("");
    } finally {
      setAddEmailVerifyLoading(false);
    }
  };

  const handleAddEmailCodeOnly = async () => {
    // Email was already set on the user when they verified the OTP (add-email/verify).
    // Better-auth's updateUser() does not allow updating email, so we don't call it here.
    setAddEmailError("");
    setAddEmailCodeOnlyLoading(true);
    try {
      setAddEmailPassword({ confirm: "", email: "", password: "" });
      setAddEmailStep("email");
      setAddEmailCode("");
      setMessage(
        "Email added. You can sign in with your email using the email code option (no password).",
      );
      await fetchAccounts();
    } finally {
      setAddEmailCodeOnlyLoading(false);
    }
  };

  const handleAddEmailPassword = async () => {
    const { confirm, email, password } = addEmailPassword;
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
      // Email was already set when they verified the OTP (add-email/verify). Only set password.
      const setPassRes = await (
        authClient as {
          setPassword?: (opts: {
            newPassword: string;
          }) => Promise<{ error?: { message?: string } }>;
        }
      ).setPassword?.({
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
      setAddEmailPassword({ confirm: "", email: "", password: "" });
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

  const handleAddPasskey = async () => {
    setError("");
    setPasskeyAddLoading(true);
    try {
      const result = await authClient.passkey.addPasskey({
        authenticatorAttachment: "cross-platform",
        name: "Security key",
      });
      if (result?.error) {
        setError(
          typeof result.error.message === "string"
            ? result.error.message
            : "Failed to add security key",
        );
        return;
      }
      setMessage(
        "Security key added. You can sign in with it from the sign-in page.",
      );
      void fetchPasskeys();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to add security key",
      );
    } finally {
      setPasskeyAddLoading(false);
    }
  };

  const handleDeletePasskey = async (id: string) => {
    setPasskeyDeleteId(id);
    setError("");
    try {
      const result = await authClient.passkey.deletePasskey({ id });
      if (result?.error) {
        setError(
          typeof result.error.message === "string"
            ? result.error.message
            : "Failed to remove security key",
        );
        return;
      }
      setMessage("Security key removed.");
      void fetchPasskeys();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to remove security key",
      );
    } finally {
      setPasskeyDeleteId(null);
    }
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
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button
          aria-label="Back"
          asChild
          className="shrink-0"
          size="icon"
          variant="ghost"
        >
          <Link href="/dashboard">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Security</h1>
      </div>

      {error && (
        <div
          className={`
          rounded-md bg-destructive/10 p-4 text-sm text-destructive
        `}
        >
          {error}
        </div>
      )}
      {message && (
        <div
          className={`
          rounded-md bg-green-50 p-4 text-sm text-green-700
          dark:bg-green-950/30 dark:text-green-400
        `}
        >
          {message}
        </div>
      )}

      {(() => {
        const hasCredentialAccount = accounts.some(
          (a) => a.providerId === "credential",
        );
        const showChangePassword =
          hasCredentialAccount && isRealEmail(user?.email ?? "");
        if (!showChangePassword) return null;
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                Change password
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                We&apos;ll send you an email with a link to set a new password.
                Use that link to change your password.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {resetError && (
                <div
                  className={`
                  rounded-md bg-destructive/10 p-3 text-sm text-destructive
                `}
                >
                  {resetError}
                </div>
              )}
              {resetEmailSent && (
                <div
                  className={`
                  rounded-md bg-green-50 p-3 text-sm text-green-700
                  dark:bg-green-950/30 dark:text-green-400
                `}
                >
                  Check your inbox (and spam) for a link to change your
                  password. The link expires in 1 hour.
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
        );
      })()}

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
                  className={`
                    flex items-center justify-between gap-2 rounded-lg border
                    border-border bg-muted/20 px-3 py-2
                  `}
                  key={acc.id ?? `${acc.providerId}-${acc.accountId}`}
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
                          alt=""
                          className="rounded object-contain"
                          height={18}
                          src="/crypto/solana/solanaLogoMark.svg"
                          width={18}
                        />
                        <span className="font-mono text-muted-foreground">
                          {acc.accountId.slice(0, 4)}…{acc.accountId.slice(-4)}
                        </span>
                      </>
                    )}
                    {acc.providerId === "ethereum" && (
                      <>
                        <Image
                          alt=""
                          className="rounded object-contain"
                          height={18}
                          src="/crypto/ethereum/ethereum-logo.svg"
                          width={18}
                        />
                        <span className="font-mono text-muted-foreground">
                          {acc.accountId.slice(0, 6)}…{acc.accountId.slice(-4)}
                        </span>
                      </>
                    )}
                    {acc.providerId === "discord" && (
                      <>
                        <DiscordIcon className="size-4 shrink-0" />
                        Discord
                      </>
                    )}
                    {acc.providerId === "telegram" && (
                      <>
                        <TelegramIcon className="size-4 shrink-0" />
                        Telegram
                      </>
                    )}
                    {![
                      "credential",
                      "discord",
                      "ethereum",
                      "solana",
                      "telegram",
                    ].includes(acc.providerId) && (
                      <span className="font-mono text-muted-foreground">
                        {acc.providerId}
                      </span>
                    )}
                  </span>
                  <Button
                    className={`
                      text-destructive
                      hover:text-destructive
                    `}
                    disabled={
                      !canUnlink || unlinkingId === (acc.id ?? acc.accountId)
                    }
                    onClick={() =>
                      handleUnlink(acc.accountId, acc.providerId, acc.id)
                    }
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    {unlinkingId === (acc.id ?? acc.accountId)
                      ? "Unlinking…"
                      : "Unlink"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              className="gap-2"
              onClick={handleOpenLinkWallet}
              type="button"
              variant="outline"
            >
              <Wallet className="size-4" />
              Connect wallet (Solana or Ethereum)
            </Button>
            {!accounts.some((a) => a.providerId === "discord") && (
              <Button
                className="gap-2"
                onClick={() => {
                  void authClient.linkSocial({
                    callbackURL: "/dashboard/security",
                    provider: "discord",
                  });
                }}
                type="button"
                variant="outline"
              >
                <DiscordIcon className="size-4" />
                Connect Discord
              </Button>
            )}
            {!accounts.some((a) => a.providerId === "telegram") &&
              getTelegramBotUsername() && (
                <div
                  className={`
                  flex h-9 min-w-0 items-center
                  [&_iframe]:!h-9 [&_iframe]:!min-h-9
                `}
                >
                  <TelegramLoginWidget
                    botUsername={getTelegramBotUsername()}
                    link
                    onError={(msg) => setError(msg)}
                    onLinked={() => setError("")}
                    showFallbackLabel
                    size="medium"
                  />
                </div>
              )}
          </div>
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
              Add an email to your account. We’ll send a verification code to
              confirm it’s yours. Choose to sign in with a{" "}
              <strong>password</strong> or with an <strong>email code</strong>{" "}
              (no password).
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {addEmailError && (
              <div
                className={`
                rounded-md bg-destructive/10 p-3 text-sm text-destructive
              `}
              >
                {addEmailError}
              </div>
            )}

            {addEmailStep === "email" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="add-email">Email</Label>
                  <Input
                    id="add-email"
                    onChange={(e) =>
                      setAddEmailPassword((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    placeholder="satoshi@nakamoto.com"
                    type="email"
                    value={addEmailPassword.email}
                  />
                </div>
                <Button
                  disabled={addEmailSendCodeLoading}
                  onClick={handleSendAddEmailCode}
                >
                  {addEmailSendCodeLoading
                    ? "Sending…"
                    : "Send verification code"}
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
                    inputMode="numeric"
                    maxLength={8}
                    onChange={(e) =>
                      setAddEmailCode(
                        e.target.value.replace(/\D/g, "").slice(0, 8),
                      )
                    }
                    placeholder="000000"
                    type="text"
                    value={addEmailCode}
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
                    disabled={addEmailSendCodeLoading}
                    onClick={() => {
                      setAddEmailCode("");
                      setAddEmailError("");
                      void handleSendAddEmailCode();
                    }}
                    variant="outline"
                  >
                    {addEmailSendCodeLoading ? "Sending…" : "Resend code"}
                  </Button>
                  <Button
                    onClick={() => {
                      setAddEmailStep("email");
                      setAddEmailCode("");
                      setAddEmailError("");
                    }}
                    variant="ghost"
                  >
                    Use a different email
                  </Button>
                </div>
              </>
            )}

            {addEmailStep === "choice" && (
              <>
                <p className="text-sm text-muted-foreground">
                  How do you want to sign in with{" "}
                  <strong>{addEmailPassword.email}</strong>?
                </p>
                <ul
                  className={`
                  list-inside list-disc space-y-2 text-sm text-muted-foreground
                `}
                >
                  <li>
                    <strong className="text-foreground">Password:</strong> Enter
                    your email and password each time you sign in.
                  </li>
                  <li>
                    <strong className="text-foreground">Email code:</strong>{" "}
                    Enter your email, receive a one-time code, and sign in with
                    no password.
                  </li>
                </ul>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => {
                      setAddEmailStep("password");
                      setAddEmailError("");
                    }}
                  >
                    Use password
                  </Button>
                  <Button
                    disabled={addEmailCodeOnlyLoading}
                    onClick={handleAddEmailCodeOnly}
                    variant="outline"
                  >
                    {addEmailCodeOnlyLoading
                      ? "Adding…"
                      : "Use email code (no password)"}
                  </Button>
                  <Button
                    onClick={() => {
                      setAddEmailStep("code");
                      setAddEmailError("");
                    }}
                    variant="ghost"
                  >
                    Back
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
                    onChange={(e) =>
                      setAddEmailPassword((prev) => ({
                        ...prev,
                        password: e.target.value,
                      }))
                    }
                    placeholder="At least 8 characters"
                    type="password"
                    value={addEmailPassword.password}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="add-confirm">Confirm password</Label>
                  <Input
                    id="add-confirm"
                    onChange={(e) =>
                      setAddEmailPassword((prev) => ({
                        ...prev,
                        confirm: e.target.value,
                      }))
                    }
                    placeholder="Repeat password"
                    type="password"
                    value={addEmailPassword.confirm}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={addEmailLoading}
                    onClick={handleAddEmailPassword}
                  >
                    {addEmailLoading ? "Adding…" : "Add email & password"}
                  </Button>
                  <Button
                    onClick={() => {
                      setAddEmailStep("choice");
                      setAddEmailPassword((prev) => ({
                        ...prev,
                        confirm: "",
                        password: "",
                      }));
                      setAddEmailError("");
                    }}
                    variant="ghost"
                  >
                    Back
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
                  className={`
                    h-48 w-48 rounded border border-border object-contain
                  `}
                  src={qrCodeImageUrl}
                />
              ) : (
                <div
                  className={`
                  flex h-48 w-48 flex-col items-center justify-center gap-2
                  rounded border border-dashed border-muted-foreground/30
                  bg-muted/30 text-center text-sm text-muted-foreground
                `}
                >
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
                  <p
                    className={`
                    mt-2 rounded-md bg-muted p-4 font-mono text-sm break-all
                  `}
                  >
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
                  onChange={(e) =>
                    setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 8))
                  }
                  placeholder="000000"
                  value={otpCode}
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
          <p className="text-sm text-muted-foreground">
            Add a second factor when signing in. Choose{" "}
            <strong>authenticator app (OTP)</strong> for 6-digit codes, or{" "}
            <strong>security key (U2F)</strong> to use a hardware key or device
            passkey.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-medium">
              Authenticator app (OTP)
            </h3>
            <p className="mb-3 text-sm text-muted-foreground">
              Use an app like Google Authenticator or Authy to get 6-digit codes
              when you sign in.
            </p>
            {!accounts.some((a) => a.providerId === "credential") ? (
              <p
                className={`
                rounded-md bg-muted/50 p-3 text-sm text-muted-foreground
              `}
              >
                To use authenticator app (OTP) 2FA, add an email and password to
                your account first (in the section above). You can use security
                key (U2F) below without a password.
              </p>
            ) : (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="security-password">Your Password</Label>
                  <Input
                    id="security-password"
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter your password"
                    type="password"
                    value={password}
                  />
                  <p className="text-sm text-muted-foreground">
                    Required to enable or disable authenticator app 2FA
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-4">
                  <Button disabled={loading} onClick={handleEnableTwoFactor}>
                    {loading
                      ? "Processing..."
                      : "Enable with authenticator app"}
                  </Button>
                  <Button
                    disabled={loading}
                    onClick={handleDisableTwoFactor}
                    variant="destructive"
                  >
                    {loading ? "Processing..." : "Disable authenticator app"}
                  </Button>
                </div>
              </>
            )}
          </div>

          <div className="border-t pt-6">
            <h3 className="mb-2 text-sm font-medium">
              Security key (U2F / passkey)
            </h3>
            <p className="mb-3 text-sm text-muted-foreground">
              Register a hardware security key or device passkey. You can then
              sign in with it from the sign-in page (no password or OTP needed).
              Works even if you signed up with a wallet and don&apos;t have a
              password.
            </p>
            {passkeysLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <>
                {passkeys.length > 0 && (
                  <ul className="mb-3 space-y-2">
                    {passkeys.map((p) => (
                      <li
                        className={`
                          flex items-center justify-between rounded-md border
                          bg-muted/30 px-3 py-2 text-sm
                        `}
                        key={p.id}
                      >
                        <span>{p.name || "Security key"}</span>
                        <Button
                          className={`
                            text-destructive
                            hover:text-destructive
                          `}
                          disabled={passkeyDeleteId === p.id}
                          onClick={() => handleDeletePasskey(p.id)}
                          size="sm"
                          variant="ghost"
                        >
                          {passkeyDeleteId === p.id ? (
                            "Removing…"
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <Button
                  disabled={passkeyAddLoading}
                  onClick={handleAddPasskey}
                  variant="outline"
                >
                  {passkeyAddLoading ? "Adding…" : "Add security key"}
                </Button>
              </>
            )}
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
