"use client";

import { Link2, Share2 } from "lucide-react";
import * as React from "react";

import { SEO_CONFIG } from "~/app";
import { useCurrentUser } from "~/lib/auth-client";
import { cn } from "~/lib/cn";
import { formatCents } from "~/lib/format";
import { Button } from "~/ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/ui/primitives/card";
import { Input } from "~/ui/primitives/input";
import { Label } from "~/ui/primitives/label";
import { Spinner } from "~/ui/primitives/spinner";

interface AffiliateMe {
  applicationNote: null | string;
  code: string;
  commissionType: string;
  commissionValue: number;
  conversionCount: number;
  createdAt: string;
  id: string;
  payoutAddress: null | string;
  payoutMethod: null | string;
  referralUrl: null | string;
  status: AffiliateStatus;
  totalEarnedCents: number;
  totalPaidCents: number;
}

type AffiliateStatus = "approved" | "pending" | "rejected" | "suspended";

export function AffiliatePageClient() {
  const { user } = useCurrentUser();
  const [data, setData] = React.useState<null | {
    affiliate: AffiliateMe | null;
  }>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [applyCode, setApplyCode] = React.useState("");
  const [applyPayoutMethod, setApplyPayoutMethod] = React.useState("");
  const [applyPayoutAddress, setApplyPayoutAddress] = React.useState("");
  const [applyNote, setApplyNote] = React.useState("");
  const [applySuccess, setApplySuccess] = React.useState<null | string>(null);
  const [applyError, setApplyError] = React.useState<null | string>(null);

  const [payoutMethod, setPayoutMethod] = React.useState("");
  const [payoutAddress, setPayoutAddress] = React.useState("");
  const [payoutSaving, setPayoutSaving] = React.useState(false);
  const [payoutMessage, setPayoutMessage] = React.useState<null | {
    text: string;
    type: "error" | "success";
  }>(null);

  const [codeEdit, setCodeEdit] = React.useState("");
  const [codeSaving, setCodeSaving] = React.useState(false);
  const [codeMessage, setCodeMessage] = React.useState<null | {
    text: string;
    type: "error" | "success";
  }>(null);

  React.useEffect(() => {
    if (!user) return;
    const ac = new AbortController();
    setLoadError(false);
    fetch("/api/affiliates/me", { credentials: "include", signal: ac.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((raw: unknown) => {
        const d = raw as null | { affiliate: AffiliateMe | null };
        if (d) setData(d);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoadError(true);
        setData({ affiliate: null });
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [user]);

  React.useEffect(() => {
    const aff = data?.affiliate ?? null;
    if (aff) {
      setPayoutMethod(aff.payoutMethod ?? "");
      setPayoutAddress(aff.payoutAddress ?? "");
      setCodeEdit(aff.code ?? "");
    }
  }, [
    data?.affiliate?.id,
    data?.affiliate?.payoutMethod,
    data?.affiliate?.payoutAddress,
    data?.affiliate?.code,
    data?.affiliate,
  ]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setApplyError(null);
    setApplySuccess(null);
    setApplying(true);
    try {
      const res = await fetch("/api/affiliates/apply", {
        body: JSON.stringify({
          applicationNote: applyNote.trim() || undefined,
          code: applyCode.trim() || undefined,
          payoutAddress: applyPayoutAddress.trim() || undefined,
          payoutMethod: applyPayoutMethod.trim() || undefined,
        }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const json = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (!res.ok) {
        setApplyError(
          typeof json.error === "string"
            ? json.error
            : "Failed to submit application.",
        );
        return;
      }
      setApplySuccess(
        typeof json.message === "string"
          ? json.message
          : "Application submitted.",
      );
      setData({
        affiliate: {
          applicationNote: applyNote.trim() || null,
          code: typeof json.code === "string" ? json.code : applyCode.trim(),
          commissionType: "percent",
          commissionValue: 10,
          conversionCount: 0,
          createdAt: new Date().toISOString(),
          id: typeof json.id === "string" ? json.id : "",
          payoutAddress: applyPayoutAddress.trim() || null,
          payoutMethod: applyPayoutMethod.trim() || null,
          referralUrl: null,
          status: "pending",
          totalEarnedCents: 0,
          totalPaidCents: 0,
        },
      });
      setApplyCode("");
      setApplyPayoutMethod("");
      setApplyPayoutAddress("");
      setApplyNote("");
    } finally {
      setApplying(false);
    }
  };

  const handleCodeSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeMessage(null);
    const newCode = codeEdit.trim().toUpperCase().replace(/\s/g, "");
    if (!newCode) return;
    if (newCode === data?.affiliate?.code) return;
    setCodeSaving(true);
    try {
      const res = await fetch("/api/affiliates/me", {
        body: JSON.stringify({ code: newCode }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const json = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (!res.ok) {
        setCodeMessage({
          text:
            typeof json.error === "string"
              ? json.error
              : "Failed to update code.",
          type: "error",
        });
        return;
      }
      setCodeMessage({
        text: typeof json.message === "string" ? json.message : "Code updated.",
        type: "success",
      });
      const baseUrl =
        typeof process.env.NEXT_PUBLIC_APP_URL === "string"
          ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
          : "https://forthecult.store";
      const referralUrl =
        data?.affiliate?.status === "approved"
          ? `${baseUrl}?ref=${encodeURIComponent(newCode)}`
          : data?.affiliate?.referralUrl;
      setData((prev) =>
        prev?.affiliate
          ? {
              ...prev,
              affiliate: {
                ...prev.affiliate,
                code: newCode,
                referralUrl: referralUrl ?? null,
              },
            }
          : prev,
      );
    } finally {
      setCodeSaving(false);
    }
  };

  const handlePayoutSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayoutMessage(null);
    setPayoutSaving(true);
    try {
      const res = await fetch("/api/affiliates/me", {
        body: JSON.stringify({
          payoutAddress: payoutAddress.trim() || null,
          payoutMethod: payoutMethod.trim() || null,
        }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const json = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (!res.ok) {
        setPayoutMessage({
          text: typeof json.error === "string" ? json.error : "Failed to save.",
          type: "error",
        });
        return;
      }
      setPayoutMessage({ text: "Payout settings saved.", type: "success" });
      setData((prev) =>
        prev?.affiliate
          ? {
              ...prev,
              affiliate: {
                ...prev.affiliate,
                payoutAddress: payoutAddress.trim() || null,
                payoutMethod: payoutMethod.trim() || null,
              },
            }
          : prev,
      );
    } finally {
      setPayoutSaving(false);
    }
  };

  const copyReferralUrl = () => {
    if (!data?.affiliate?.referralUrl) return;
    void navigator.clipboard.writeText(data.affiliate.referralUrl);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner className="border-muted-foreground" variant="page" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-8">
        <p className="text-sm text-destructive">
          Failed to load affiliate data. Please try again.
        </p>
        <button
          className="text-sm text-primary underline"
          onClick={() => window.location.reload()}
          type="button"
        >
          Refresh
        </button>
      </div>
    );
  }

  const affiliate = data?.affiliate ?? null;
  const isApproved = affiliate?.status === "approved";
  const isPending = affiliate?.status === "pending";
  const isRejected = affiliate?.status === "rejected";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Link2 className="h-7 w-7" />
        <h1 className="text-2xl font-semibold tracking-tight">
          Affiliate Program
        </h1>
      </div>

      {!affiliate ? (
        <Card>
          <CardHeader>
            <CardTitle>Become an affiliate</CardTitle>
            <CardDescription>
              Apply to join our affiliate program. We&apos;ll review your
              application and get back to you. Once approved, you&apos;ll get a
              unique referral link and earn commission on sales.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={handleApply}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="applyCode">
                  Your affiliate code (optional)
                </Label>
                <Input
                  aria-describedby="applyCodeHint"
                  className="font-mono uppercase"
                  id="applyCode"
                  maxLength={24}
                  onChange={(e) => setApplyCode(e.target.value)}
                  placeholder="e.g. MYCODE"
                  value={applyCode}
                />
                <p className="text-sm text-muted-foreground" id="applyCodeHint">
                  Letters and numbers only, 4–24 characters. Leave blank for a
                  random code.
                </p>
              </div>
              <div
                className={`
                  grid gap-4
                  sm:grid-cols-2
                `}
              >
                <div className="flex flex-col gap-2">
                  <Label htmlFor="applyPayoutMethod">
                    Payout method (optional)
                  </Label>
                  <select
                    className={cn(
                      `
                        flex h-10 w-full rounded-md border border-input
                        bg-background px-3 py-2 text-sm
                      `,
                      `
                        ring-offset-background
                        focus-visible:ring-2 focus-visible:ring-ring
                        focus-visible:outline-none
                      `,
                    )}
                    id="applyPayoutMethod"
                    onChange={(e) => setApplyPayoutMethod(e.target.value)}
                    value={applyPayoutMethod}
                  >
                    <option value="">—</option>
                    <option value="paypal">PayPal</option>
                    <option value="bitcoin">Bitcoin (BTC)</option>
                    <option value="usdt">USDT</option>
                    <option value="cult">CULT</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="applyPayoutAddress">
                    PayPal email or payout address (optional)
                  </Label>
                  <Input
                    id="applyPayoutAddress"
                    maxLength={500}
                    onChange={(e) => setApplyPayoutAddress(e.target.value)}
                    placeholder={
                      applyPayoutMethod === "paypal"
                        ? "satoshi@nakamoto.com"
                        : "Wallet address"
                    }
                    value={applyPayoutAddress}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="applicationNote">
                  Why do you want to be an affiliate? (optional)
                </Label>
                <textarea
                  className={cn(
                    `
                      flex min-h-[80px] w-full rounded-md border border-input
                      bg-transparent px-3 py-2 text-sm
                    `,
                    `
                      placeholder:text-muted-foreground
                      focus-visible:ring-2 focus-visible:ring-ring
                      focus-visible:outline-none
                      disabled:cursor-not-allowed disabled:opacity-50
                    `,
                    "resize-none",
                  )}
                  id="applicationNote"
                  onChange={(e) => setApplyNote(e.target.value)}
                  placeholder="Tell us a bit about yourself and how you plan to promote us."
                  rows={4}
                  value={applyNote}
                />
              </div>
              {applyError && (
                <p className="text-sm text-destructive" role="alert">
                  {applyError}
                </p>
              )}
              {applySuccess && (
                <p
                  className={`
                    text-sm text-green-600
                    dark:text-green-400
                  `}
                  role="status"
                >
                  {applySuccess}
                </p>
              )}
              <Button disabled={applying} type="submit">
                {applying ? (
                  <>
                    <Spinner className="mr-2" variant="inline" />
                    Submitting…
                  </>
                ) : (
                  "Submit application"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          {isPending && (
            <>
              <Card
                className={`
                  border-amber-200 bg-amber-50/50
                  dark:border-amber-900/50 dark:bg-amber-950/20
                `}
              >
                <CardContent className="pt-6">
                  <p
                    className={`
                      font-medium text-amber-800
                      dark:text-amber-200
                    `}
                  >
                    Your application is under review.
                  </p>
                  <p
                    className={`
                      mt-1 text-sm text-amber-700
                      dark:text-amber-300
                    `}
                  >
                    We&apos;ll notify you once it&apos;s approved; you&apos;ll
                    get your referral link after approval.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Your referral code</CardTitle>
                  <CardDescription>
                    You can change your code before approval. Changing it
                    invalidates the previous one.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form
                    className="flex flex-col gap-2"
                    onSubmit={handleCodeSave}
                  >
                    <div className="flex gap-2">
                      <Input
                        aria-describedby="codeEditPendingHint"
                        className="max-w-[180px] font-mono uppercase"
                        id="codeEditPending"
                        maxLength={24}
                        onChange={(e) =>
                          setCodeEdit(
                            e.target.value
                              .toUpperCase()
                              .replace(/[^A-Za-z0-9]/g, ""),
                          )
                        }
                        placeholder="e.g. MYCODE"
                        type="text"
                        value={codeEdit}
                      />
                      <Button
                        disabled={
                          codeSaving ||
                          codeEdit.trim().toUpperCase().replace(/\s/g, "") ===
                            affiliate.code ||
                          codeEdit.trim().length < 4
                        }
                        type="submit"
                      >
                        {codeSaving ? (
                          <>
                            <Spinner className="mr-2" variant="inline" />
                            Updating…
                          </>
                        ) : (
                          "Update code"
                        )}
                      </Button>
                    </div>
                    <p
                      className="text-sm text-muted-foreground"
                      id="codeEditPendingHint"
                    >
                      Letters and numbers only, 4–24 characters.
                    </p>
                    {codeMessage && (
                      <p
                        className={cn(
                          "text-sm",
                          codeMessage.type === "success"
                            ? `
                              text-green-600
                              dark:text-green-400
                            `
                            : "text-destructive",
                        )}
                      >
                        {codeMessage.text}
                      </p>
                    )}
                  </form>
                </CardContent>
              </Card>
            </>
          )}

          {isRejected && (
            <Card
              className={`
                border-red-200
                dark:border-red-900/50
              `}
            >
              <CardContent className="pt-6">
                <p
                  className={`
                    font-medium text-red-800
                    dark:text-red-200
                  `}
                >
                  Your application was not approved.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  If you have questions, please contact support.
                </p>
              </CardContent>
            </Card>
          )}

          {isApproved && (
            <Card>
              <CardHeader>
                <CardTitle>Your referral link</CardTitle>
                <CardDescription>
                  Share this link. When customers purchase after clicking it,
                  you earn commission.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex gap-2">
                  <Input
                    className="font-mono text-sm"
                    readOnly
                    value={affiliate.referralUrl ?? ""}
                  />
                  <Button
                    onClick={copyReferralUrl}
                    type="button"
                    variant="outline"
                  >
                    Copy
                  </Button>
                </div>
                <form className="flex flex-col gap-2" onSubmit={handleCodeSave}>
                  <Label htmlFor="codeEdit">Your referral code</Label>
                  <div className="flex gap-2">
                    <Input
                      aria-describedby="codeEditHint"
                      className="max-w-[180px] font-mono uppercase"
                      id="codeEdit"
                      maxLength={24}
                      onChange={(e) =>
                        setCodeEdit(
                          e.target.value
                            .toUpperCase()
                            .replace(/[^A-Za-z0-9]/g, ""),
                        )
                      }
                      placeholder="e.g. MYCODE"
                      type="text"
                      value={codeEdit}
                    />
                    <Button
                      disabled={
                        codeSaving ||
                        codeEdit.trim().toUpperCase().replace(/\s/g, "") ===
                          affiliate.code ||
                        codeEdit.trim().length < 4
                      }
                      type="submit"
                    >
                      {codeSaving ? (
                        <>
                          <Spinner className="mr-2" variant="inline" />
                          Updating…
                        </>
                      ) : (
                        "Update code"
                      )}
                    </Button>
                  </div>
                  <p
                    className="text-sm text-muted-foreground"
                    id="codeEditHint"
                  >
                    Letters and numbers only, 4–24 characters. Changing your
                    code invalidates your previous referral link.
                  </p>
                  {codeMessage && (
                    <p
                      className={cn(
                        "text-sm",
                        codeMessage.type === "success"
                          ? `
                            text-green-600
                            dark:text-green-400
                          `
                          : "text-destructive",
                      )}
                    >
                      {codeMessage.text}
                    </p>
                  )}
                </form>
              </CardContent>
            </Card>
          )}

          {isApproved && affiliate && (
            <Card>
              <CardHeader>
                <CardTitle>Stats</CardTitle>
                <CardDescription>
                  Earnings and conversions (approved affiliates only).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl
                  className={`
                    grid grid-cols-2 gap-4
                    sm:grid-cols-4
                  `}
                >
                  <div>
                    <dt
                      className={`
                        text-sm font-medium text-muted-foreground uppercase
                      `}
                    >
                      Conversions
                    </dt>
                    <dd className="mt-1 text-2xl font-semibold tabular-nums">
                      {affiliate.conversionCount}
                    </dd>
                  </div>
                  <div>
                    <dt
                      className={`
                        text-sm font-medium text-muted-foreground uppercase
                      `}
                    >
                      Total earned
                    </dt>
                    <dd className="mt-1 text-2xl font-semibold tabular-nums">
                      {formatCents(affiliate.totalEarnedCents)}
                    </dd>
                  </div>
                  <div>
                    <dt
                      className={`
                        text-sm font-medium text-muted-foreground uppercase
                      `}
                    >
                      Paid out
                    </dt>
                    <dd className="mt-1 text-2xl font-semibold tabular-nums">
                      {formatCents(affiliate.totalPaidCents)}
                    </dd>
                  </div>
                  <div>
                    <dt
                      className={`
                        text-sm font-medium text-muted-foreground uppercase
                      `}
                    >
                      Pending
                    </dt>
                    <dd className="mt-1 text-2xl font-semibold tabular-nums">
                      {formatCents(
                        Math.max(
                          0,
                          affiliate.totalEarnedCents - affiliate.totalPaidCents,
                        ),
                      )}
                    </dd>
                  </div>
                </dl>
                {affiliate.payoutMethod && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Payout method:{" "}
                    {affiliate.payoutMethod === "cult"
                      ? "CULT"
                      : affiliate.payoutMethod.charAt(0).toUpperCase() +
                        affiliate.payoutMethod.slice(1)}
                    {affiliate.payoutAddress && (
                      <span className="ml-1">
                        — {affiliate.payoutAddress.slice(0, 20)}
                        {affiliate.payoutAddress.length > 20 ? "…" : ""}
                      </span>
                    )}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {affiliate && (isApproved || isPending) && (
            <Card>
              <CardHeader>
                <CardTitle>Payout settings</CardTitle>
                <CardDescription>
                  Choose how you want to receive payouts. This is visible to
                  admins when processing payments.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="flex flex-col gap-4"
                  onSubmit={handlePayoutSave}
                >
                  <div
                    className={`
                      grid gap-4
                      sm:grid-cols-2
                    `}
                  >
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="payoutMethod">Payout method</Label>
                      <select
                        className={cn(
                          `
                            flex h-10 w-full rounded-md border border-input
                            bg-background px-3 py-2 text-sm
                          `,
                          `
                            ring-offset-background
                            focus-visible:ring-2 focus-visible:ring-ring
                            focus-visible:outline-none
                          `,
                        )}
                        id="payoutMethod"
                        onChange={(e) => setPayoutMethod(e.target.value)}
                        value={payoutMethod}
                      >
                        <option value="">—</option>
                        <option value="paypal">PayPal</option>
                        <option value="bitcoin">Bitcoin (BTC)</option>
                        <option value="usdt">USDT</option>
                        <option value="cult">CULT</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="payoutAddress">
                        {payoutMethod === "paypal"
                          ? "PayPal email"
                          : "Payout address"}
                      </Label>
                      <Input
                        id="payoutAddress"
                        maxLength={500}
                        onChange={(e) => setPayoutAddress(e.target.value)}
                        placeholder={
                          payoutMethod === "paypal"
                            ? "satoshi@nakamoto.com"
                            : "Wallet address"
                        }
                        type={payoutMethod === "paypal" ? "email" : "text"}
                        value={payoutAddress}
                      />
                    </div>
                  </div>
                  {payoutMessage && (
                    <p
                      className={cn(
                        "text-sm",
                        payoutMessage.type === "success"
                          ? `
                            text-green-600
                            dark:text-green-400
                          `
                          : "text-destructive",
                      )}
                    >
                      {payoutMessage.text}
                    </p>
                  )}
                  <Button disabled={payoutSaving} type="submit">
                    {payoutSaving ? (
                      <>
                        <Spinner className="mr-2" variant="inline" />
                        Saving…
                      </>
                    ) : (
                      "Save payout settings"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {isApproved && affiliate?.referralUrl && (
            <Card>
              <CardHeader>
                <CardTitle>Share & resources</CardTitle>
                <CardDescription>
                  Share your link and use these snippets for social posts, bios,
                  or emails.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    asChild
                    className="gap-2"
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <a
                      aria-label="Share on X (Twitter)"
                      href={`https://twitter.com/intent/tweet?${new URLSearchParams(
                        {
                          text: `Shop ${SEO_CONFIG.name} — quality apparel & essentials. Use my link:`,
                          url: affiliate.referralUrl,
                        },
                      ).toString()}`}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <XLogo className="h-4 w-4" />
                      Share on X
                    </a>
                  </Button>
                  <Button
                    aria-label="Copy tweet to clipboard"
                    className="gap-2"
                    onClick={() => {
                      const tweet = `Shop ${SEO_CONFIG.name} — quality apparel & essentials. Use my link: ${affiliate.referralUrl}`;
                      void navigator.clipboard.writeText(tweet);
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Share2 className="h-4 w-4" />
                    Copy tweet
                  </Button>
                </div>
                <div className="flex flex-col gap-3">
                  <Label className="text-sm font-medium text-muted-foreground">
                    Marketing copy (copy & paste)
                  </Label>
                  <div className="flex flex-col gap-2">
                    <SnippetBlock
                      label="Short (for bios / one-liners)"
                      text={`${SEO_CONFIG.name} — use my link: ${affiliate.referralUrl}`}
                    />
                    <SnippetBlock
                      label="Post (for social)"
                      text={`Check out ${SEO_CONFIG.name} for quality apparel and essentials. Use my link: ${affiliate.referralUrl}`}
                    />
                    <SnippetBlock
                      label="Email (for newsletters)"
                      text={`I recommend ${SEO_CONFIG.name} for apparel and curated gear. Shop here with my link: ${affiliate.referralUrl}`}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function SnippetBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = React.useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="mb-1.5 text-sm font-medium text-muted-foreground">
        {label}
      </p>
      <p className="mb-2 text-sm break-all">{text}</p>
      <Button
        className="h-8 text-xs"
        onClick={copy}
        size="sm"
        type="button"
        variant="ghost"
      >
        {copied ? "Copied!" : "Copy"}
      </Button>
    </div>
  );
}

function XLogo({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
