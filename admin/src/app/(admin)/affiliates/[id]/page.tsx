"use client";

import { ChevronLeft, Save } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { cn } from "~/lib/cn";
import { Button } from "~/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/ui/card";

const API_BASE =
  typeof process.env.NEXT_PUBLIC_MAIN_APP_URL === "string"
    ? process.env.NEXT_PUBLIC_MAIN_APP_URL
    : "http://localhost:3000";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const labelClass = "mb-1.5 block text-sm font-medium";

type AffiliateDetail = {
  id: string;
  userId: string | null;
  code: string;
  status: string;
  commissionType: string;
  commissionValue: number;
  customerDiscountType: string | null;
  customerDiscountValue: number | null;
  applicationNote: string | null;
  adminNote: string | null;
  payoutMethod: string | null;
  payoutAddress: string | null;
  totalEarnedCents: number;
  totalPaidCents: number;
  createdAt: string;
  updatedAt: string;
  userEmail: string | null;
  userName: string | null;
  conversionCount: number;
};

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(s: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(s));
  } catch {
    return "—";
  }
}

export default function AdminAffiliateDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [affiliate, setAffiliate] = useState<AffiliateDetail | null>(null);

  const [status, setStatus] = useState("");
  const [code, setCode] = useState("");
  const [commissionType, setCommissionType] = useState("percent");
  const [commissionValue, setCommissionValue] = useState(10);
  const [customerDiscountType, setCustomerDiscountType] = useState<string>("");
  const [customerDiscountValue, setCustomerDiscountValue] = useState<string>("");
  const [adminNote, setAdminNote] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("");
  const [payoutAddress, setPayoutAddress] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchAffiliate = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/affiliates/${id}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as AffiliateDetail;
      setAffiliate(data);
      setStatus(data.status);
      setCode(data.code);
      setCommissionType(data.commissionType);
      setCommissionValue(data.commissionValue);
      setCustomerDiscountType(data.customerDiscountType ?? "");
      setCustomerDiscountValue(
        data.customerDiscountValue != null ? String(data.customerDiscountValue) : "",
      );
      setAdminNote(data.adminNote ?? "");
      setPayoutMethod(data.payoutMethod ?? "");
      setPayoutAddress(data.payoutAddress ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load affiliate");
      setAffiliate(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchAffiliate();
  }, [fetchAffiliate]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveMessage(null);
    setSaveLoading(true);
    try {
      const body: Record<string, unknown> = {
        status,
        code: code.trim() || undefined,
        commissionType,
        commissionValue,
        adminNote: adminNote.trim() || null,
        payoutMethod: payoutMethod.trim() || null,
        payoutAddress: payoutAddress.trim() || null,
      };
      if (customerDiscountType) {
        body.customerDiscountType = customerDiscountType;
        body.customerDiscountValue =
          customerDiscountValue !== "" ? Number(customerDiscountValue) : null;
      } else {
        body.customerDiscountType = null;
        body.customerDiscountValue = null;
      }
      const res = await fetch(`${API_BASE}/api/admin/affiliates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      const json = (await res.json().catch(() => ({}))) as { updated?: boolean; error?: string };
      if (!res.ok) {
        setSaveMessage({ type: "error", text: json.error ?? "Failed to update" });
        return;
      }
      setSaveMessage({ type: "success", text: "Saved." });
      void fetchAffiliate();
    } finally {
      setSaveLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (error || !affiliate) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/affiliates" className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            Back to affiliates
          </Link>
        </Button>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/affiliates" className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <h2 className="text-2xl font-semibold tracking-tight">
          Affiliate: {affiliate.code}
        </h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">User</dt>
                <dd className="font-medium">
                  {affiliate.userName ?? affiliate.userEmail ?? "—"}
                  {affiliate.userEmail && (
                    <span className="block font-normal text-muted-foreground">
                      {affiliate.userEmail}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Conversions</dt>
                <dd className="font-medium tabular-nums">{affiliate.conversionCount}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Total earned</dt>
                <dd className="font-medium tabular-nums">
                  {formatCents(affiliate.totalEarnedCents)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Total paid</dt>
                <dd className="font-medium tabular-nums">
                  {formatCents(affiliate.totalPaidCents)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Applied</dt>
                <dd className="font-medium">{formatDate(affiliate.createdAt)}</dd>
              </div>
            </dl>
            {affiliate.applicationNote && (
              <div className="mt-4">
                <dt className={labelClass}>Application note</dt>
                <dd className="rounded-md border bg-muted/30 p-3 text-sm">
                  {affiliate.applicationNote}
                </dd>
              </div>
            )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Edit affiliate</CardTitle>
          <CardDescription>
            Change status (e.g. approve or reject), commission, customer discount, and payout info.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="status">
                  Status
                </label>
                <select
                  id="status"
                  className={inputClass}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  aria-label="Status"
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="code">
                  Code
                </label>
                <input
                  id="code"
                  type="text"
                  className={inputClass}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. JOHN10"
                  maxLength={64}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="commissionType">
                  Commission type
                </label>
                <select
                  id="commissionType"
                  className={inputClass}
                  value={commissionType}
                  onChange={(e) => setCommissionType(e.target.value)}
                >
                  <option value="percent">Percent</option>
                  <option value="fixed">Fixed (cents)</option>
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="commissionValue">
                  Commission value ({commissionType === "percent" ? "0–100" : "cents"})
                </label>
                <input
                  id="commissionValue"
                  type="number"
                  min={0}
                  max={commissionType === "percent" ? 100 : undefined}
                  className={inputClass}
                  value={commissionValue}
                  onChange={(e) => setCommissionValue(Number(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="customerDiscountType">
                  Customer discount type (optional)
                </label>
                <select
                  id="customerDiscountType"
                  className={inputClass}
                  value={customerDiscountType}
                  onChange={(e) => setCustomerDiscountType(e.target.value)}
                >
                  <option value="">None</option>
                  <option value="percent">Percent</option>
                  <option value="fixed">Fixed (cents)</option>
                </select>
              </div>
              {customerDiscountType && (
                <div>
                  <label className={labelClass} htmlFor="customerDiscountValue">
                    Customer discount value
                  </label>
                  <input
                    id="customerDiscountValue"
                    type="number"
                    min={0}
                    className={inputClass}
                    value={customerDiscountValue}
                    onChange={(e) => setCustomerDiscountValue(e.target.value)}
                    placeholder={customerDiscountType === "percent" ? "10" : "500"}
                  />
                </div>
              )}
            </div>

            <div>
              <label className={labelClass} htmlFor="adminNote">
                Admin note (internal)
              </label>
              <textarea
                id="adminNote"
                className={cn(inputClass, "min-h-[80px] resize-y")}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Internal notes..."
                rows={3}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="payoutMethod">
                  Payout method
                </label>
                <select
                  id="payoutMethod"
                  className={inputClass}
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value)}
                >
                  <option value="">—</option>
                  <option value="paypal">PayPal</option>
                  <option value="bitcoin">Bitcoin (BTC)</option>
                  <option value="usdt">USDT</option>
                  <option value="cult">$CULT</option>
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="payoutAddress">
                  Payout address / email
                </label>
                <input
                  id="payoutAddress"
                  type="text"
                  className={inputClass}
                  value={payoutAddress}
                  onChange={(e) => setPayoutAddress(e.target.value)}
                  placeholder="PayPal email or wallet address"
                />
              </div>
            </div>

            {saveMessage && (
              <p
                className={cn(
                  "text-sm",
                  saveMessage.type === "success"
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400",
                )}
              >
                {saveMessage.text}
              </p>
            )}

            <Button type="submit" disabled={saveLoading}>
              {saveLoading ? "Saving…" : "Save changes"}
              <Save className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
