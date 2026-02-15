"use client";

import { ChevronLeft, Save } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { cn } from "~/lib/cn";
import { getMainAppUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/ui/card";

const API_BASE = getMainAppUrl();

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const labelClass = "mb-1.5 block text-sm font-medium";

interface AffiliateDetail {
  adminNote: null | string;
  applicationNote: null | string;
  code: string;
  commissionType: string;
  commissionValue: number;
  conversionCount: number;
  createdAt: string;
  customerDiscountType: null | string;
  customerDiscountValue: null | number;
  id: string;
  payoutAddress: null | string;
  payoutMethod: null | string;
  status: string;
  totalEarnedCents: number;
  totalPaidCents: number;
  updatedAt: string;
  userEmail: null | string;
  userId: null | string;
  userName: null | string;
}

export default function AdminAffiliateDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | string>(null);
  const [affiliate, setAffiliate] = useState<AffiliateDetail | null>(null);

  const [status, setStatus] = useState("");
  const [code, setCode] = useState("");
  const [commissionType, setCommissionType] = useState("percent");
  const [commissionValue, setCommissionValue] = useState(10);
  const [customerDiscountType, setCustomerDiscountType] = useState<string>("");
  const [customerDiscountValue, setCustomerDiscountValue] =
    useState<string>("");
  const [adminNote, setAdminNote] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("");
  const [payoutAddress, setPayoutAddress] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<null | {
    text: string;
    type: "error" | "success";
  }>(null);

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
        data.customerDiscountValue != null
          ? String(data.customerDiscountValue)
          : "",
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
        adminNote: adminNote.trim() || null,
        code: code.trim() || undefined,
        commissionType,
        commissionValue,
        payoutAddress: payoutAddress.trim() || null,
        payoutMethod: payoutMethod.trim() || null,
        status,
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
        body: JSON.stringify(body),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        updated?: boolean;
      };
      if (!res.ok) {
        setSaveMessage({
          text: json.error ?? "Failed to update",
          type: "error",
        });
        return;
      }
      setSaveMessage({ text: "Saved.", type: "success" });
      void fetchAffiliate();
    } finally {
      setSaveLoading(false);
    }
  };

  if (loading) {
    return (
      <div
        className={`
        flex min-h-[200px] items-center justify-center text-muted-foreground
      `}
      >
        Loading…
      </div>
    );
  }

  if (error || !affiliate) {
    return (
      <div className="space-y-4">
        <Button asChild size="sm" variant="ghost">
          <Link className="gap-2" href="/affiliates">
            <ChevronLeft className="h-4 w-4" />
            Back to affiliates
          </Link>
        </Button>
        <div
          className={`
          rounded-lg border border-red-200 bg-red-50 p-4 text-red-800
          dark:border-red-800 dark:bg-red-950/30 dark:text-red-200
        `}
        >
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild size="sm" variant="ghost">
          <Link className="gap-2" href="/affiliates">
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
          <dl
            className={`
            grid gap-2 text-sm
            sm:grid-cols-2
          `}
          >
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
              <dd className="font-medium tabular-nums">
                {affiliate.conversionCount}
              </dd>
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
            Change status (e.g. approve or reject), commission, customer
            discount, and payout info.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSave}>
            <div
              className={`
              grid gap-4
              sm:grid-cols-2
            `}
            >
              <div>
                <label className={labelClass} htmlFor="status">
                  Status
                </label>
                <select
                  aria-label="Status"
                  className={inputClass}
                  id="status"
                  onChange={(e) => setStatus(e.target.value)}
                  value={status}
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
                  className={inputClass}
                  id="code"
                  maxLength={64}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. JOHN10"
                  type="text"
                  value={code}
                />
              </div>
            </div>

            <div
              className={`
              grid gap-4
              sm:grid-cols-2
            `}
            >
              <div>
                <label className={labelClass} htmlFor="commissionType">
                  Commission type
                </label>
                <select
                  className={inputClass}
                  id="commissionType"
                  onChange={(e) => setCommissionType(e.target.value)}
                  value={commissionType}
                >
                  <option value="percent">Percent</option>
                  <option value="fixed">Fixed (cents)</option>
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="commissionValue">
                  Commission value (
                  {commissionType === "percent" ? "0–100" : "cents"})
                </label>
                <input
                  className={inputClass}
                  id="commissionValue"
                  max={commissionType === "percent" ? 100 : undefined}
                  min={0}
                  onChange={(e) =>
                    setCommissionValue(Number(e.target.value) || 0)
                  }
                  type="number"
                  value={commissionValue}
                />
              </div>
            </div>

            <div
              className={`
              grid gap-4
              sm:grid-cols-2
            `}
            >
              <div>
                <label className={labelClass} htmlFor="customerDiscountType">
                  Customer discount type (optional)
                </label>
                <select
                  className={inputClass}
                  id="customerDiscountType"
                  onChange={(e) => setCustomerDiscountType(e.target.value)}
                  value={customerDiscountType}
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
                    className={inputClass}
                    id="customerDiscountValue"
                    min={0}
                    onChange={(e) => setCustomerDiscountValue(e.target.value)}
                    placeholder={
                      customerDiscountType === "percent" ? "10" : "500"
                    }
                    type="number"
                    value={customerDiscountValue}
                  />
                </div>
              )}
            </div>

            <div>
              <label className={labelClass} htmlFor="adminNote">
                Admin note (internal)
              </label>
              <textarea
                className={cn(inputClass, "min-h-[80px] resize-y")}
                id="adminNote"
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Internal notes..."
                rows={3}
                value={adminNote}
              />
            </div>

            <div
              className={`
              grid gap-4
              sm:grid-cols-2
            `}
            >
              <div>
                <label className={labelClass} htmlFor="payoutMethod">
                  Payout method
                </label>
                <select
                  className={inputClass}
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
              <div>
                <label className={labelClass} htmlFor="payoutAddress">
                  Payout address / email
                </label>
                <input
                  className={inputClass}
                  id="payoutAddress"
                  onChange={(e) => setPayoutAddress(e.target.value)}
                  placeholder="PayPal email or wallet address"
                  type="text"
                  value={payoutAddress}
                />
              </div>
            </div>

            {saveMessage && (
              <p
                className={cn(
                  "text-sm",
                  saveMessage.type === "success"
                    ? `
                      text-green-600
                      dark:text-green-400
                    `
                    : `
                      text-red-600
                      dark:text-red-400
                    `,
                )}
              >
                {saveMessage.text}
              </p>
            )}

            <Button disabled={saveLoading} type="submit">
              {saveLoading ? "Saving…" : "Save changes"}
              <Save className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
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
