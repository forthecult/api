"use client";

import { Link2, Loader2, Share2 } from "lucide-react";
import * as React from "react";

import { formatCents } from "~/lib/format";

import { SEO_CONFIG } from "~/app";
import { useCurrentUser } from "~/lib/auth-client";
import { Button } from "~/ui/primitives/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/ui/primitives/card";
import { cn } from "~/lib/cn";
import { Input } from "~/ui/primitives/input";
import { Label } from "~/ui/primitives/label";

type AffiliateStatus = "pending" | "approved" | "rejected" | "suspended";

function XLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
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
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mb-2 break-all text-sm">{text}</p>
      <Button type="button" variant="ghost" size="sm" onClick={copy} className="h-8 text-xs">
        {copied ? "Copied!" : "Copy"}
      </Button>
    </div>
  );
}

type AffiliateMe = {
  id: string;
  code: string;
  status: AffiliateStatus;
  commissionType: string;
  commissionValue: number;
  totalEarnedCents: number;
  totalPaidCents: number;
  applicationNote: string | null;
  payoutMethod: string | null;
  payoutAddress: string | null;
  createdAt: string;
  conversionCount: number;
  referralUrl: string | null;
};

export function AffiliatePageClient() {
  const { user } = useCurrentUser();
  const [data, setData] = React.useState<{ affiliate: AffiliateMe | null } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [applyCode, setApplyCode] = React.useState("");
  const [applyPayoutMethod, setApplyPayoutMethod] = React.useState("");
  const [applyPayoutAddress, setApplyPayoutAddress] = React.useState("");
  const [applyNote, setApplyNote] = React.useState("");
  const [applySuccess, setApplySuccess] = React.useState<string | null>(null);
  const [applyError, setApplyError] = React.useState<string | null>(null);

  const [payoutMethod, setPayoutMethod] = React.useState("");
  const [payoutAddress, setPayoutAddress] = React.useState("");
  const [payoutSaving, setPayoutSaving] = React.useState(false);
  const [payoutMessage, setPayoutMessage] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [codeEdit, setCodeEdit] = React.useState("");
  const [codeSaving, setCodeSaving] = React.useState(false);
  const [codeMessage, setCodeMessage] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  React.useEffect(() => {
    if (!user) return;
    const ac = new AbortController();
    setLoadError(false);
    fetch("/api/affiliates/me", { credentials: "include", signal: ac.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((d: { affiliate: AffiliateMe | null } | null) => d && setData(d))
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
  }, [data?.affiliate?.id, data?.affiliate?.payoutMethod, data?.affiliate?.payoutAddress, data?.affiliate?.code]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setApplyError(null);
    setApplySuccess(null);
    setApplying(true);
    try {
      const res = await fetch("/api/affiliates/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: applyCode.trim() || undefined,
          applicationNote: applyNote.trim() || undefined,
          payoutMethod: applyPayoutMethod.trim() || undefined,
          payoutAddress: applyPayoutAddress.trim() || undefined,
        }),
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setApplyError(json.error ?? "Failed to submit application.");
        return;
      }
      setApplySuccess(json.message ?? "Application submitted.");
      setData({
        affiliate: {
          id: json.id,
          code: json.code,
          status: "pending",
          commissionType: "percent",
          commissionValue: 10,
          totalEarnedCents: 0,
          totalPaidCents: 0,
          applicationNote: applyNote.trim() || null,
          payoutMethod: applyPayoutMethod.trim() || null,
          payoutAddress: applyPayoutAddress.trim() || null,
          createdAt: new Date().toISOString(),
          conversionCount: 0,
          referralUrl: null,
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
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: newCode }),
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCodeMessage({ type: "error", text: json.error ?? "Failed to update code." });
        return;
      }
      setCodeMessage({ type: "success", text: json.message ?? "Code updated." });
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
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payoutMethod: payoutMethod.trim() || null,
          payoutAddress: payoutAddress.trim() || null,
        }),
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPayoutMessage({ type: "error", text: json.error ?? "Failed to save." });
        return;
      }
      setPayoutMessage({ type: "success", text: "Payout settings saved." });
      setData((prev) =>
        prev?.affiliate
          ? {
              ...prev,
              affiliate: {
                ...prev.affiliate,
                payoutMethod: payoutMethod.trim() || null,
                payoutAddress: payoutAddress.trim() || null,
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
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-8">
        <p className="text-sm text-destructive">Failed to load affiliate data. Please try again.</p>
        <button
          type="button"
          className="text-sm text-primary underline"
          onClick={() => window.location.reload()}
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
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link2 className="h-7 w-7" />
        <h1 className="text-2xl font-semibold tracking-tight">Affiliate Program</h1>
      </div>

      {!affiliate ? (
        <Card>
          <CardHeader>
            <CardTitle>Become an affiliate</CardTitle>
            <CardDescription>
              Apply to join our affiliate program. We&apos;ll review your application and get back
              to you. Once approved, you&apos;ll get a unique referral link and earn commission on
              sales.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleApply} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="applyCode">Your affiliate code (optional)</Label>
                <Input
                  id="applyCode"
                  placeholder="e.g. MYCODE"
                  value={applyCode}
                  onChange={(e) => setApplyCode(e.target.value)}
                  maxLength={24}
                  className="font-mono uppercase"
                  aria-describedby="applyCodeHint"
                />
                <p id="applyCodeHint" className="text-xs text-muted-foreground">
                  Letters and numbers only, 4–24 characters. Leave blank for a random code.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="applyPayoutMethod">Payout method (optional)</Label>
                  <select
                    id="applyPayoutMethod"
                    value={applyPayoutMethod}
                    onChange={(e) => setApplyPayoutMethod(e.target.value)}
                    className={cn(
                      "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                      "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                  >
                    <option value="">—</option>
                    <option value="paypal">PayPal</option>
                    <option value="bitcoin">Bitcoin (BTC)</option>
                    <option value="usdt">USDT</option>
                    <option value="cult">CULT</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="applyPayoutAddress">PayPal email or payout address (optional)</Label>
                  <Input
                    id="applyPayoutAddress"
                    placeholder={
                      applyPayoutMethod === "paypal"
                        ? "satoshi@nakamoto.com"
                        : "Wallet address"
                    }
                    value={applyPayoutAddress}
                    onChange={(e) => setApplyPayoutAddress(e.target.value)}
                    maxLength={500}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="applicationNote">Why do you want to be an affiliate? (optional)</Label>
                <textarea
                  id="applicationNote"
                  placeholder="Tell us a bit about yourself and how you plan to promote us."
                  value={applyNote}
                  onChange={(e) => setApplyNote(e.target.value)}
                  rows={4}
                  className={cn(
                    "flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs",
                    "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                    "resize-none",
                  )}
                />
              </div>
              {applyError && (
                <p className="text-sm text-destructive" role="alert">
                  {applyError}
                </p>
              )}
              {applySuccess && (
                <p className="text-sm text-green-600 dark:text-green-400" role="status">
                  {applySuccess}
                </p>
              )}
              <Button type="submit" disabled={applying}>
                {applying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
              <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
                <CardContent className="pt-6">
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    Your application is under review.
                  </p>
                  <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                    We&apos;ll notify you once it&apos;s approved; you&apos;ll get your referral link after approval.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Your referral code</CardTitle>
                  <CardDescription>
                    You can change your code before approval. Changing it invalidates the previous one.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCodeSave} className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        id="codeEditPending"
                        type="text"
                        value={codeEdit}
                        onChange={(e) => setCodeEdit(e.target.value.toUpperCase().replace(/[^A-Za-z0-9]/g, ""))}
                        placeholder="e.g. MYCODE"
                        maxLength={24}
                        className="font-mono uppercase max-w-[180px]"
                        aria-describedby="codeEditPendingHint"
                      />
                      <Button
                      type="submit"
                      disabled={
                        codeSaving ||
                        codeEdit.trim().toUpperCase().replace(/\s/g, "") === affiliate.code ||
                        codeEdit.trim().length < 4
                      }
                    >
                        {codeSaving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Updating…
                          </>
                        ) : (
                          "Update code"
                        )}
                      </Button>
                    </div>
                    <p id="codeEditPendingHint" className="text-xs text-muted-foreground">
                      Letters and numbers only, 4–24 characters.
                    </p>
                    {codeMessage && (
                      <p
                        className={cn(
                          "text-sm",
                          codeMessage.type === "success"
                            ? "text-green-600 dark:text-green-400"
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
            <Card className="border-red-200 dark:border-red-900/50">
              <CardContent className="pt-6">
                <p className="font-medium text-red-800 dark:text-red-200">
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
                  Share this link. When customers purchase after clicking it, you earn commission.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={affiliate.referralUrl ?? ""}
                    className="font-mono text-sm"
                  />
                  <Button type="button" variant="outline" onClick={copyReferralUrl}>
                    Copy
                  </Button>
                </div>
                <form onSubmit={handleCodeSave} className="space-y-2">
                  <Label htmlFor="codeEdit">Your referral code</Label>
                  <div className="flex gap-2">
                    <Input
                      id="codeEdit"
                      type="text"
                      value={codeEdit}
                      onChange={(e) => setCodeEdit(e.target.value.toUpperCase().replace(/[^A-Za-z0-9]/g, ""))}
                      placeholder="e.g. MYCODE"
                      maxLength={24}
                      className="font-mono uppercase max-w-[180px]"
                      aria-describedby="codeEditHint"
                    />
                    <Button
                      type="submit"
                      disabled={
                        codeSaving ||
                        codeEdit.trim().toUpperCase().replace(/\s/g, "") === affiliate.code ||
                        codeEdit.trim().length < 4
                      }
                    >
                      {codeSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating…
                        </>
                      ) : (
                        "Update code"
                      )}
                    </Button>
                  </div>
                  <p id="codeEditHint" className="text-xs text-muted-foreground">
                    Letters and numbers only, 4–24 characters. Changing your code invalidates your previous referral link.
                  </p>
                  {codeMessage && (
                    <p
                      className={cn(
                        "text-sm",
                        codeMessage.type === "success"
                          ? "text-green-600 dark:text-green-400"
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
                <CardDescription>Earnings and conversions (approved affiliates only).</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <dt className="text-xs font-medium uppercase text-muted-foreground">
                      Conversions
                    </dt>
                    <dd className="mt-1 text-2xl font-semibold tabular-nums">
                      {affiliate.conversionCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-muted-foreground">
                      Total earned
                    </dt>
                    <dd className="mt-1 text-2xl font-semibold tabular-nums">
                      {formatCents(affiliate.totalEarnedCents)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-muted-foreground">
                      Paid out
                    </dt>
                    <dd className="mt-1 text-2xl font-semibold tabular-nums">
                      {formatCents(affiliate.totalPaidCents)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-muted-foreground">
                      Pending
                    </dt>
                    <dd className="mt-1 text-2xl font-semibold tabular-nums">
                      {formatCents(
                        Math.max(0, affiliate.totalEarnedCents - affiliate.totalPaidCents),
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
                  Choose how you want to receive payouts. This is visible to admins when processing payments.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePayoutSave} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="payoutMethod">Payout method</Label>
                      <select
                        id="payoutMethod"
                        value={payoutMethod}
                        onChange={(e) => setPayoutMethod(e.target.value)}
                        className={cn(
                          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                          "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        )}
                      >
                        <option value="">—</option>
                        <option value="paypal">PayPal</option>
                        <option value="bitcoin">Bitcoin (BTC)</option>
                        <option value="usdt">USDT</option>
                        <option value="cult">CULT</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="payoutAddress">
                        {payoutMethod === "paypal" ? "PayPal email" : "Payout address"}
                      </Label>
                      <Input
                        id="payoutAddress"
                        type={payoutMethod === "paypal" ? "email" : "text"}
                        placeholder={
                          payoutMethod === "paypal"
                            ? "satoshi@nakamoto.com"
                            : "Wallet address"
                        }
                        value={payoutAddress}
                        onChange={(e) => setPayoutAddress(e.target.value)}
                        maxLength={500}
                      />
                    </div>
                  </div>
                  {payoutMessage && (
                    <p
                      className={cn(
                        "text-sm",
                        payoutMessage.type === "success"
                          ? "text-green-600 dark:text-green-400"
                          : "text-destructive",
                      )}
                    >
                      {payoutMessage.text}
                    </p>
                  )}
                  <Button type="submit" disabled={payoutSaving}>
                    {payoutSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
                  Share your link and use these snippets for social posts, bios, or emails.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    asChild
                  >
                    <a
                      href={`https://twitter.com/intent/tweet?${new URLSearchParams({
                        text: `Shop ${SEO_CONFIG.name} — quality apparel & essentials. Use my link:`,
                        url: affiliate.referralUrl,
                      }).toString()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Share on X (Twitter)"
                    >
                      <XLogo className="h-4 w-4" />
                      Share on X
                    </a>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      const tweet = `Shop ${SEO_CONFIG.name} — quality apparel & essentials. Use my link: ${affiliate.referralUrl}`;
                      void navigator.clipboard.writeText(tweet);
                    }}
                    aria-label="Copy tweet to clipboard"
                  >
                    <Share2 className="h-4 w-4" />
                    Copy tweet
                  </Button>
                </div>
                <div className="space-y-3">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Marketing copy (copy & paste)
                  </Label>
                  <div className="space-y-2">
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
