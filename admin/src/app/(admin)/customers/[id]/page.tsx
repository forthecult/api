"use client";

import {
  Bell,
  ChevronLeft,
  Copy,
  KeyRound,
  Link2,
  MapPin,
  MessageSquarePlus,
  Save,
  Shield,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "~/lib/cn";
import { getMainAppUrl } from "~/lib/env";
import { mapRetrieveToShipping } from "~/lib/loqate";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/ui/table";

const API_BASE = getMainAppUrl();

type LoqateFindItem = { Id: string; Text: string; Description?: string };

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const labelClass = "mb-1.5 block text-sm font-medium";

type SavedAddress = {
  id: string;
  address1: string;
  address2: string | null;
  city: string;
  stateCode: string | null;
  countryCode: string;
  zip: string;
  label: string | null;
  isDefault: boolean;
};

type LatestShippingAddress = {
  address1: string;
  address2: string | null;
  city: string;
  stateCode: string | null;
  countryCode: string;
  zip: string;
};

type ChannelPrefs = {
  email: boolean;
  website: boolean;
  sms: boolean;
  telegram: boolean;
  aiCompanion: boolean;
};

type NotificationPreferences = {
  hasTelegramLinked: boolean;
  transactional: ChannelPrefs;
  marketing: ChannelPrefs;
};

type CustomerDetail = {
  id: string;
  name: string;
  image: string | null;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  twoFactorEnabled?: boolean;
  orderCount: number;
  tokenBalanceCents: number | null;
  city: string | null;
  country: string | null;
  latestShippingAddress: LatestShippingAddress | null;
  addresses: SavedAddress[];
  receiveMarketing: boolean;
  receiveSmsMarketing: boolean;
  affiliate: { code: string; status: string } | null;
  notificationPreferences: NotificationPreferences | null;
};

type CustomerOrder = {
  id: string;
  createdAt: string;
  email: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  totalCents: number;
  itemCount: number;
  items: { id: string; name: string; priceCents: number; quantity: number }[];
};

type CustomerComment = {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorName: string;
};

function formatDate(s: string | null): string {
  if (!s) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(s));
  } catch {
    return "—";
  }
}

function formatTokenBalance(cents: number | null): string {
  if (cents === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatOrderTotal(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export default function AdminCustomerDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [disable2faLoading, setDisable2faLoading] = useState(false);
  const [disable2faMessage, setDisable2faMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Editable fields (local state synced from customer)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  // Notification preferences (single source of truth; synced from notificationPreferences)
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences | null>(null);
  const [notifSaveLoading, setNotifSaveLoading] = useState(false);
  const [notifSaveMessage, setNotifSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Orders
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Comments
  const [comments, setComments] = useState<CustomerComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [addCommentLoading, setAddCommentLoading] = useState(false);

  const [addressFindQuery, setAddressFindQuery] = useState("");
  const [addressFindResults, setAddressFindResults] = useState<
    LoqateFindItem[]
  >([]);
  const [addressFindOpen, setAddressFindOpen] = useState(false);
  const [addressFindLoading, setAddressFindLoading] = useState(false);
  const [addressLookupResult, setAddressLookupResult] = useState<string | null>(
    null,
  );
  const addressFindDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const fetchCustomer = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/customers/${id}`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 404) {
          setError("Customer not found.");
          return;
        }
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as CustomerDetail;
      setCustomer(data);
      setFirstName(data.firstName ?? "");
      setLastName(data.lastName ?? "");
      setPhone(data.phone ?? "");
      setNotifPrefs(data.notificationPreferences ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load customer");
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchCustomer();
  }, [fetchCustomer]);

  useEffect(() => {
    const q = addressFindQuery.trim();
    if (!q) {
      setAddressFindResults([]);
      setAddressFindOpen(false);
      return;
    }
    if (addressFindDebounceRef.current) {
      clearTimeout(addressFindDebounceRef.current);
    }
    addressFindDebounceRef.current = setTimeout(async () => {
      setAddressFindLoading(true);
      try {
        const res = await fetch(
          `${API_BASE}/api/loqate/find?text=${encodeURIComponent(q)}&limit=8`,
          { credentials: "include" },
        );
        if (!res.ok) {
          setAddressFindResults([]);
          return;
        }
        const data = (await res.json()) as { Items?: LoqateFindItem[] };
        const items = data.Items ?? [];
        setAddressFindResults(items);
        setAddressFindOpen(items.length > 0);
      } catch {
        setAddressFindResults([]);
      } finally {
        setAddressFindLoading(false);
      }
    }, 300);
    return () => {
      if (addressFindDebounceRef.current) {
        clearTimeout(addressFindDebounceRef.current);
      }
    };
  }, [addressFindQuery]);

  const selectAddressFromLoqate = useCallback(async (loqateId: string) => {
    setAddressFindOpen(false);
    setAddressFindQuery("");
    setAddressFindResults([]);
    try {
      const res = await fetch(
        `${API_BASE}/api/loqate/retrieve?id=${encodeURIComponent(loqateId)}`,
        { credentials: "include" },
      );
      if (!res.ok) return;
      const addr = (await res.json()) as Parameters<
        typeof mapRetrieveToShipping
      >[0];
      const mapped = mapRetrieveToShipping(addr);
      const line = [
        mapped.street,
        mapped.apartment,
        [mapped.city, mapped.state].filter(Boolean).join(", "),
        mapped.zip,
        mapped.country,
      ]
        .filter(Boolean)
        .join(", ");
      setAddressLookupResult(line);
    } catch {
      setAddressLookupResult(null);
    }
  }, []);

  const copyLookupAddress = useCallback(() => {
    if (!addressLookupResult) return;
    void navigator.clipboard.writeText(addressLookupResult);
  }, [addressLookupResult]);

  const fetchOrders = useCallback(async () => {
    if (!id) return;
    setOrdersLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/customers/${id}/orders`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load orders");
      const data = (await res.json()) as { orders: CustomerOrder[] };
      setOrders(data.orders ?? []);
    } catch {
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, [id]);

  const fetchComments = useCallback(async () => {
    if (!id) return;
    setCommentsLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/customers/${id}/comments`,
        {
          credentials: "include",
        },
      );
      if (!res.ok) throw new Error("Failed to load comments");
      const data = (await res.json()) as { comments: CustomerComment[] };
      setComments(data.comments ?? []);
    } catch {
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (customer) {
      void fetchOrders();
      void fetchComments();
    }
  }, [customer, fetchOrders, fetchComments]);

  const handleSaveProfile = useCallback(async () => {
    if (!id) return;
    setSaveMessage(null);
    setSaveLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/customers/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim() || null,
          lastName: lastName.trim() || null,
          phone: phone.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        firstName?: string | null;
        lastName?: string | null;
        phone?: string | null;
      };
      if (!res.ok) {
        setSaveMessage({ type: "error", text: data.error ?? "Failed to save" });
        return;
      }
      setCustomer((prev) =>
        prev
          ? {
              ...prev,
              firstName: data.firstName ?? prev.firstName,
              lastName: data.lastName ?? prev.lastName,
              phone: data.phone ?? prev.phone,
            }
          : null,
      );
      setSaveMessage({ type: "success", text: "Saved." });
    } catch {
      setSaveMessage({ type: "error", text: "Failed to save" });
    } finally {
      setSaveLoading(false);
    }
  }, [id, firstName, lastName, phone]);

  const handleResetPassword = useCallback(async () => {
    if (!id) return;
    setResetMessage(null);
    setResetLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/customers/${id}/reset-password`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        success?: boolean;
      };
      if (!res.ok) {
        setResetMessage({
          type: "error",
          text: data.error ?? "Failed to send reset email",
        });
        return;
      }
      setResetMessage({
        type: "success",
        text: "Password reset email sent to customer.",
      });
    } catch {
      setResetMessage({ type: "error", text: "Failed to send reset email" });
    } finally {
      setResetLoading(false);
    }
  }, [id]);

  const handleDisable2fa = useCallback(async () => {
    if (!id) return;
    setDisable2faMessage(null);
    setDisable2faLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/customers/${id}/disable-2fa`,
        { method: "POST", credentials: "include" },
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setDisable2faMessage({
          type: "error",
          text: data.error ?? "Failed to disable 2FA",
        });
        return;
      }
      setDisable2faMessage({ type: "success", text: "Two-factor authentication disabled for this customer." });
      void fetchCustomer();
    } catch {
      setDisable2faMessage({ type: "error", text: "Failed to disable 2FA" });
    } finally {
      setDisable2faLoading(false);
    }
  }, [id, fetchCustomer]);

  const updateNotifPref = useCallback(
    (type: "transactional" | "marketing", channel: keyof ChannelPrefs, value: boolean) => {
      setNotifPrefs((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          [type]: { ...prev[type], [channel]: value },
        };
      });
    },
    [],
  );

  const handleSaveNotificationPrefs = useCallback(async () => {
    if (!id || !notifPrefs) return;
    setNotifSaveMessage(null);
    setNotifSaveLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/customers/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationPreferences: {
            transactional: notifPrefs.transactional,
            marketing: notifPrefs.marketing,
          },
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setNotifSaveMessage({ type: "error", text: json.error ?? "Failed to save" });
        return;
      }
      setNotifSaveMessage({ type: "success", text: "Notification preferences saved." });
      void fetchCustomer();
    } catch {
      setNotifSaveMessage({ type: "error", text: "Failed to save" });
    } finally {
      setNotifSaveLoading(false);
    }
  }, [id, notifPrefs, fetchCustomer]);

  const handleAddComment = useCallback(async () => {
    if (!id || !newComment.trim()) return;
    setAddCommentLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/customers/${id}/comments`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: newComment.trim() }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as
        | { error?: string }
        | (CustomerComment & {});
      if (!res.ok) {
        const err = data as { error?: string };
        throw new Error(err.error ?? "Failed to add comment");
      }
      const added = data as CustomerComment & {};
      setComments((prev) => [
        {
          id: added.id,
          body: added.body,
          createdAt: added.createdAt,
          authorId: added.authorId,
          authorName: added.authorName ?? "—",
        },
        ...prev,
      ]);
      setNewComment("");
    } catch {
      // could show toast
    } finally {
      setAddCommentLoading(false);
    }
  }, [id, newComment]);

  if (!id) {
    return (
      <div className="space-y-6">
        <Link href="/customers">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Back to customers"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <p className="text-muted-foreground">Invalid customer ID.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Link href="/customers">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Back to customers"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
          Loading…
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="space-y-6">
        <Link href="/customers">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Back to customers"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
          {error ?? "Customer not found."}
          <Button
            className="mt-2"
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void fetchCustomer()}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button
          asChild
          variant="ghost"
          size="icon"
          aria-label="Back to customers"
        >
          <Link href="/customers">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h2 className="text-2xl font-semibold tracking-tight">Customer</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="sr-only">Customer details</CardTitle>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border bg-muted">
              {customer.image ? (
                <Image
                  src={customer.image}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              ) : (
                <span
                  className={cn(
                    "flex size-full items-center justify-center text-2xl font-medium text-muted-foreground",
                  )}
                  aria-hidden
                >
                  {customer.name.trim().slice(0, 1).toUpperCase() || "?"}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-lg font-semibold">
                {customer.name}
              </h3>
              <p className="truncate text-sm text-muted-foreground">
                {customer.email}
              </p>
              {(customer.phone ?? phone) && (
                <p className="text-sm text-muted-foreground">
                  {customer.phone ?? phone}
                </p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="customer-first-name" className={labelClass}>
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  First name
                </span>
              </label>
              <input
                id="customer-first-name"
                type="text"
                className={inputClass}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="—"
              />
            </div>
            <div>
              <label htmlFor="customer-last-name" className={labelClass}>
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Last name
                </span>
              </label>
              <input
                id="customer-last-name"
                type="text"
                className={inputClass}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="—"
              />
            </div>
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Email
              </span>
              <p className="mt-1 text-sm">{customer.email}</p>
            </div>
            <div>
              <label htmlFor="customer-phone" className={labelClass}>
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Phone
                </span>
              </label>
              <input
                id="customer-phone"
                type="tel"
                className={inputClass}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 234 567 8900"
              />
            </div>
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Location (from latest order)
              </span>
              <p className="mt-1 text-sm">
                {[customer.city, customer.country].filter(Boolean).join(", ") ||
                  "—"}
              </p>
            </div>
            <div className="relative sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <MapPin className="mr-1 inline-block h-3.5 w-3.5" aria-hidden />
                Look up address
              </span>
              <div className="mt-1 space-y-1">
                <input
                  type="text"
                  placeholder="Type address or postcode…"
                  value={addressFindQuery}
                  onChange={(e) => setAddressFindQuery(e.target.value)}
                  onFocus={() =>
                    addressFindResults.length > 0 && setAddressFindOpen(true)
                  }
                  className={inputClass}
                  autoComplete="off"
                />
                {addressFindLoading && (
                  <span className="text-muted-foreground">Searching…</span>
                )}
                {addressFindOpen && addressFindResults.length > 0 && (
                  <ul
                    className="z-10 max-h-40 overflow-auto rounded-md border border-input bg-background py-1 shadow-md"
                    role="listbox"
                  >
                    {addressFindResults.map((item) => (
                      <li key={item.Id} role="option">
                        <button
                          type="button"
                          className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted"
                          onClick={() => selectAddressFromLoqate(item.Id)}
                        >
                          {item.Text}
                          {item.Description ? (
                            <span className="block text-muted-foreground text-xs">
                              {item.Description}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {addressLookupResult && (
                  <div className="flex items-center gap-2 rounded border border-input bg-muted/30 px-2 py-1.5 text-sm">
                    <span className="flex-1 truncate">
                      {addressLookupResult}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={copyLookupAddress}
                    >
                      <Copy className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <div className="sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Address
              </span>
              <div className="mt-1 space-y-2 text-sm">
                {customer.addresses && customer.addresses.length > 0 ? (
                  <ul className="list-inside list-disc space-y-1">
                    {customer.addresses.map((a) => (
                      <li key={a.id} className="text-muted-foreground">
                        {a.label && (
                          <span className="font-medium text-foreground">
                            {a.label}
                            {a.isDefault ? " (default)" : ""}:{" "}
                          </span>
                        )}
                        {[
                          a.address1,
                          a.address2,
                          [a.city, a.stateCode].filter(Boolean).join(", "),
                          a.zip,
                          a.countryCode,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {customer.latestShippingAddress && (
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">
                      Latest shipping address:{" "}
                    </span>
                    {[
                      customer.latestShippingAddress.address1,
                      customer.latestShippingAddress.address2,
                      [
                        customer.latestShippingAddress.city,
                        customer.latestShippingAddress.stateCode,
                      ]
                        .filter(Boolean)
                        .join(", "),
                      customer.latestShippingAddress.zip,
                      customer.latestShippingAddress.countryCode,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                )}
                {(!customer.addresses || customer.addresses.length === 0) &&
                  !customer.latestShippingAddress && (
                    <p className="text-muted-foreground">—</p>
                  )}
              </div>
            </div>
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Token balance
              </span>
              <p className="mt-1 text-sm">
                {formatTokenBalance(customer.tokenBalanceCents)}
              </p>
            </div>
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Created
              </span>
              <p className="mt-1 text-sm">{formatDate(customer.createdAt)}</p>
            </div>
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Updated
              </span>
              <p className="mt-1 text-sm">{formatDate(customer.updatedAt)}</p>
            </div>
          </div>

          {saveMessage && (
            <p
              className={cn(
                "rounded-md border px-3 py-2 text-sm",
                saveMessage.type === "success"
                  ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-200"
                  : "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200",
              )}
            >
              {saveMessage.text}
            </p>
          )}
          {resetMessage && (
            <p
              className={cn(
                "rounded-md border px-3 py-2 text-sm",
                resetMessage.type === "success"
                  ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-200"
                  : "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200",
              )}
            >
              {resetMessage.text}
            </p>
          )}
          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={saveLoading}
              onClick={() => void handleSaveProfile()}
            >
              <Save className="mr-1.5 h-4 w-4 shrink-0" aria-hidden />
              {saveLoading ? "Saving…" : "Save changes"}
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/orders?userId=${encodeURIComponent(customer.id)}`}>
                View orders
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={resetLoading}
              onClick={() => void handleResetPassword()}
              aria-label="Send password reset email to customer"
            >
              <KeyRound className="mr-1.5 h-4 w-4 shrink-0" aria-hidden />
              {resetLoading ? "Sending…" : "Reset password"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Two-Factor Authentication */}
      {customer.twoFactorEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" aria-hidden />
              Two-Factor Authentication
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              This customer has 2FA enabled. You can disable it so they can sign in without a code (e.g. if they lost their device).
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {disable2faMessage && (
              <p
                className={cn(
                  "rounded-md border px-3 py-2 text-sm",
                  disable2faMessage.type === "success"
                    ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-200"
                    : "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200",
                )}
              >
                {disable2faMessage.text}
              </p>
            )}
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={disable2faLoading}
              onClick={() => void handleDisable2fa()}
              aria-label="Disable two-factor authentication for this customer"
            >
              {disable2faLoading ? "Disabling…" : "Disable 2FA"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Affiliate */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" aria-hidden />
            Affiliate
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Customer&apos;s affiliate code and status (if they are in the program).
          </p>
        </CardHeader>
        <CardContent>
          {customer.affiliate ? (
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Code
                </span>
                <p className="mt-1 font-mono text-sm font-medium">
                  {customer.affiliate.code}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Status
                </span>
                <p className="mt-1 text-sm capitalize">
                  {customer.affiliate.status}
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/affiliates?search=${encodeURIComponent(customer.affiliate.code)}`}>
                  View in Affiliates
                </Link>
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Not an affiliate. Customer can apply from their dashboard.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Notification preferences — single source of truth (replaces Email/SMS marketing checkboxes) */}
      {customer.notificationPreferences && (notifPrefs ?? customer.notificationPreferences) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" aria-hidden />
              Notification preferences
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Transactional and marketing preferences per channel. Same as
              customer dashboard Settings → Notifications. Telegram applies only
              when the customer has linked Telegram.
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Channel</TableHead>
                    <TableHead className="text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="font-semibold">Transactional</span>
                        <span className="text-xs font-normal text-muted-foreground">
                          Orders, shipping, account
                        </span>
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="font-semibold">Marketing</span>
                        <span className="text-xs font-normal text-muted-foreground">
                          Promotions, news, offers
                        </span>
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(
                    [
                      { id: "website" as const, label: "Website", disabled: false, note: null as string | null },
                      { id: "email" as const, label: "Email", disabled: false, note: null as string | null },
                      { id: "sms" as const, label: "SMS", disabled: false, note: null as string | null },
                      {
                        id: "telegram" as const,
                        label: "Telegram",
                        disabled: !customer.notificationPreferences.hasTelegramLinked,
                        note: !customer.notificationPreferences.hasTelegramLinked
                          ? " (not linked)"
                          : null,
                      },
                      { id: "aiCompanion" as const, label: "AI Companion", disabled: false, note: null as string | null },
                    ]
                  ).map(({ id, label, note, disabled }) => {
                    const prefs = notifPrefs ?? customer.notificationPreferences;
                    return (
                      <TableRow key={id}>
                        <TableCell className="font-medium">
                          {label}
                          {note && (
                            <span className="text-muted-foreground">{note}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={prefs?.transactional[id] ?? false}
                            disabled={disabled}
                            onChange={(e) =>
                              updateNotifPref("transactional", id, e.target.checked)
                            }
                            className="h-4 w-4 rounded border-input"
                            aria-label={`${label} transactional`}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={prefs?.marketing[id] ?? false}
                            disabled={disabled}
                            onChange={(e) =>
                              updateNotifPref("marketing", id, e.target.checked)
                            }
                            className="h-4 w-4 rounded border-input"
                            aria-label={`${label} marketing`}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {notifSaveMessage && (
              <p
                className={cn(
                  "mt-3 rounded-md border px-3 py-2 text-sm",
                  notifSaveMessage.type === "success"
                    ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-200"
                    : "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200",
                )}
              >
                {notifSaveMessage.text}
              </p>
            )}
            <Button
              type="button"
              variant="default"
              size="sm"
              className="mt-3"
              disabled={notifSaveLoading}
              onClick={() => void handleSaveNotificationPrefs()}
            >
              <Save className="mr-1.5 h-4 w-4 shrink-0" aria-hidden />
              {notifSaveLoading ? "Saving…" : "Save notification preferences"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Customer orders */}
      <Card>
        <CardHeader>
          <CardTitle>Orders ({customer.orderCount})</CardTitle>
        </CardHeader>
        <CardContent>
          {ordersLoading ? (
            <p className="text-sm text-muted-foreground">Loading orders…</p>
          ) : orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <ul className="space-y-3">
              {orders.map((order) => (
                <li
                  key={order.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/orders/${order.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {order.id}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(order.createdAt)} · {order.itemCount} item
                      {order.itemCount !== 1 ? "s" : ""} ·{" "}
                      {formatOrderTotal(order.totalCents)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      order.paymentStatus === "paid"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
                        : order.paymentStatus === "pending"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {order.paymentStatus}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {customer.orderCount > 0 && (
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href={`/orders?userId=${encodeURIComponent(customer.id)}`}>
                View all orders
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Internal comments (admin only) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5" aria-hidden />
            Internal comments
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Notes visible only to admins. Not shared with the customer.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <textarea
              placeholder="Add a comment…"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className={cn(inputClass, "min-h-[80px] resize-y")}
              rows={3}
            />
            <Button
              type="button"
              size="sm"
              disabled={!newComment.trim() || addCommentLoading}
              onClick={() => void handleAddComment()}
            >
              {addCommentLoading ? "Adding…" : "Add"}
            </Button>
          </div>
          {commentsLoading ? (
            <p className="text-sm text-muted-foreground">Loading comments…</p>
          ) : comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          ) : (
            <ul className="space-y-2">
              {comments.map((c) => (
                <li
                  key={c.id}
                  className="rounded-md border bg-muted/30 p-3 text-sm"
                >
                  <p className="whitespace-pre-wrap">{c.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.authorName} · {formatDate(c.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
