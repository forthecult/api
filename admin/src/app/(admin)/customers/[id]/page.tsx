"use client";

import {
  Bell,
  ChevronLeft,
  Copy,
  Crown,
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

interface LoqateFindItem {
  Description?: string;
  Id: string;
  Text: string;
  Type?: string;
}

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const labelClass = "mb-1.5 block text-sm font-medium";

interface ChannelPrefs {
  aiCompanion: boolean;
  email: boolean;
  sms: boolean;
  telegram: boolean;
  website: boolean;
}

interface CustomerComment {
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  id: string;
}

interface CustomerDetail {
  addresses: SavedAddress[];
  affiliate: null | { code: string; status: string };
  city: null | string;
  country: null | string;
  createdAt: null | string;
  email: string;
  firstName: null | string;
  id: string;
  image: null | string;
  lastName: null | string;
  latestShippingAddress: LatestShippingAddress | null;
  name: string;
  notificationPreferences: NotificationPreferences | null;
  orderCount: number;
  phone: null | string;
  receiveMarketing: boolean;
  receiveSmsMarketing: boolean;
  tokenBalanceCents: null | number;
  twoFactorEnabled?: boolean;
  updatedAt: null | string;
}

interface CustomerOrder {
  createdAt: string;
  email: string;
  fulfillmentStatus: string;
  id: string;
  itemCount: number;
  items: { id: string; name: string; priceCents: number; quantity: number }[];
  paymentStatus: string;
  status: string;
  totalCents: number;
}

interface LatestShippingAddress {
  address1: string;
  address2: null | string;
  city: string;
  countryCode: string;
  stateCode: null | string;
  zip: string;
}

interface NotificationPreferences {
  hasTelegramLinked: boolean;
  marketing: ChannelPrefs;
  transactional: ChannelPrefs;
}

interface SavedAddress {
  address1: string;
  address2: null | string;
  city: string;
  countryCode: string;
  id: string;
  isDefault: boolean;
  label: null | string;
  stateCode: null | string;
  zip: string;
}

export default function AdminCustomerDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | string>(null);
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<null | {
    text: string;
    type: "error" | "success";
  }>(null);
  const [disable2faLoading, setDisable2faLoading] = useState(false);
  const [disable2faMessage, setDisable2faMessage] = useState<null | {
    text: string;
    type: "error" | "success";
  }>(null);

  // Editable fields (local state synced from customer)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  // Notification preferences (single source of truth; synced from notificationPreferences)
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences | null>(
    null,
  );
  const [notifSaveLoading, setNotifSaveLoading] = useState(false);
  const [notifSaveMessage, setNotifSaveMessage] = useState<null | {
    text: string;
    type: "error" | "success";
  }>(null);
  const [saveMessage, setSaveMessage] = useState<null | {
    text: string;
    type: "error" | "success";
  }>(null);

  // Orders
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Membership (tier + staking from on-chain + tier history from snapshots)
  const [membership, setMembership] = useState<{
    bestTier: null | number;
    history: {
      periods: { startDate: string; endDate: string; tier: number }[];
      rows: { date: string; tier: null | number; stakedAmountRaw: string; wallet: string }[];
    };
    memberSince: null | string;
    tokenSymbol: string;
    wallets: {
      address: string;
      stakedBalance: string;
      tier: null | number;
      lock: null | {
        durationLabel: string;
        isLocked: boolean;
        unlocksAt: string;
        secondsRemaining: number;
        stakedAt: string;
      };
    }[];
  } | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(false);

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
  /** Editable address from lookup (or fallback from suggestion). User can modify before copying/saving. */
  interface EditableAddress {
    address1: string;
    address2: null | string;
    city: string;
    countryCode: string;
    stateCode: null | string;
    zip: string;
  }
  const [editableAddress, setEditableAddress] =
    useState<EditableAddress | null>(null);
  const addressFindDebounceRef = useRef<null | ReturnType<typeof setTimeout>>(
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

  // Pre-fill editable address from latest shipping address when empty so it can be edited
  useEffect(() => {
    if (!customer?.latestShippingAddress || editableAddress !== null) return;
    const lat = customer.latestShippingAddress;
    setEditableAddress({
      address1: lat.address1 ?? "",
      address2: lat.address2 ?? null,
      city: lat.city ?? "",
      countryCode: lat.countryCode ?? "",
      stateCode: lat.stateCode ?? null,
      zip: lat.zip ?? "",
    });
  }, [customer?.latestShippingAddress, editableAddress]);

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
        const items = (data.Items ?? []).filter(
          (i) => !i.Type || i.Type === "Address",
        );
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

  const selectAddressFromLoqate = useCallback(
    async (loqateId: string, suggestionText?: string) => {
      setAddressFindOpen(false);
      setAddressFindQuery("");
      setAddressFindResults([]);
      try {
        const res = await fetch(
          `${API_BASE}/api/loqate/retrieve?id=${encodeURIComponent(loqateId)}`,
          { credentials: "include" },
        );
        if (!res.ok) throw new Error("Retrieve failed");
        const addr = (await res.json()) as Parameters<
          typeof mapRetrieveToShipping
        >[0];
        const mapped = mapRetrieveToShipping(addr);
        setEditableAddress({
          address1: [mapped.street, mapped.apartment]
            .filter(Boolean)
            .join(", "),
          address2: null,
          city: mapped.city,
          countryCode: mapped.country || "",
          stateCode: mapped.state || null,
          zip: mapped.zip,
        });
      } catch {
        // CORS/502 or network error: show suggestion text so address doesn't disappear; user can edit
        const line = suggestionText?.trim() ?? "";
        setEditableAddress({
          address1: line,
          address2: null,
          city: "",
          countryCode: "",
          stateCode: null,
          zip: "",
        });
      }
    },
    [],
  );

  const copyEditableAddress = useCallback(() => {
    if (!editableAddress) return;
    const line = [
      editableAddress.address1,
      editableAddress.address2,
      [editableAddress.city, editableAddress.stateCode]
        .filter(Boolean)
        .join(", "),
      editableAddress.zip,
      editableAddress.countryCode,
    ]
      .filter(Boolean)
      .join(", ");
    void navigator.clipboard.writeText(line);
  }, [editableAddress]);

  const clearEditableAddress = useCallback(() => {
    setEditableAddress(null);
  }, []);

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

  const fetchMembership = useCallback(async () => {
    if (!id) return;
    setMembershipLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/customers/${id}/membership`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to load membership");
      const data = (await res.json()) as {
        bestTier: null | number;
        history: {
          periods: { startDate: string; endDate: string; tier: number }[];
          rows: { date: string; tier: null | number; stakedAmountRaw: string; wallet: string }[];
        };
        memberSince: null | string;
        tokenSymbol: string;
        wallets: {
          address: string;
          stakedBalance: string;
          tier: null | number;
          lock: null | {
            durationLabel: string;
            isLocked: boolean;
            unlocksAt: string;
            secondsRemaining: number;
            stakedAt: string;
          };
        }[];
      };
      setMembership(data);
    } catch {
      setMembership(null);
    } finally {
      setMembershipLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (customer) {
      void fetchOrders();
      void fetchComments();
      void fetchMembership();
    }
  }, [customer, fetchOrders, fetchComments, fetchMembership]);

  const handleSaveProfile = useCallback(async () => {
    if (!id) return;
    setSaveMessage(null);
    setSaveLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/customers/${id}`, {
        body: JSON.stringify({
          firstName: firstName.trim() || null,
          lastName: lastName.trim() || null,
          phone: phone.trim() || null,
        }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        firstName?: null | string;
        lastName?: null | string;
        phone?: null | string;
      };
      if (!res.ok) {
        setSaveMessage({ text: data.error ?? "Failed to save", type: "error" });
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

      // If the lookup/editable address form has content, persist it to the customer's saved addresses
      const addr = editableAddress;
      const hasAllRequired =
        addr &&
        addr.address1.trim() &&
        addr.city.trim() &&
        addr.zip.trim() &&
        addr.countryCode.trim();
      if (hasAllRequired) {
        const addrRes = await fetch(
          `${API_BASE}/api/admin/customers/${id}/addresses`,
          {
            body: JSON.stringify({
              address1: addr!.address1.trim(),
              address2: addr!.address2?.trim() || null,
              city: addr!.city.trim(),
              countryCode: addr!.countryCode.trim().toUpperCase().slice(0, 2),
              stateCode: addr!.stateCode?.trim() || null,
              zip: addr!.zip.trim(),
            }),
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            method: "POST",
          },
        );
        if (addrRes.ok) {
          await fetchCustomer();
          setSaveMessage({ text: "Saved.", type: "success" });
        } else {
          const errData = (await addrRes.json().catch(() => ({}))) as {
            error?: string;
          };
          setSaveMessage({
            text: errData.error ?? "Profile saved; address could not be saved.",
            type: "error",
          });
        }
        setSaveLoading(false);
        return;
      }
      if (
        addr &&
        (addr.address1.trim() ||
          addr.city.trim() ||
          addr.zip.trim() ||
          addr.countryCode.trim())
      ) {
        setSaveMessage({
          text: "Profile saved. To save the address, fill in address line 1, city, zip, and country.",
          type: "error",
        });
        setSaveLoading(false);
        return;
      }
      setSaveMessage({ text: "Saved.", type: "success" });
    } catch {
      setSaveMessage({ text: "Failed to save", type: "error" });
    } finally {
      setSaveLoading(false);
    }
  }, [id, firstName, lastName, phone, editableAddress, fetchCustomer]);

  const handleResetPassword = useCallback(async () => {
    if (!id) return;
    setResetMessage(null);
    setResetLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/customers/${id}/reset-password`,
        {
          credentials: "include",
          method: "POST",
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        success?: boolean;
      };
      if (!res.ok) {
        setResetMessage({
          text: data.error ?? "Failed to send reset email",
          type: "error",
        });
        return;
      }
      setResetMessage({
        text: "Password reset email sent to customer.",
        type: "success",
      });
    } catch {
      setResetMessage({ text: "Failed to send reset email", type: "error" });
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
        { credentials: "include", method: "POST" },
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setDisable2faMessage({
          text: data.error ?? "Failed to disable 2FA",
          type: "error",
        });
        return;
      }
      setDisable2faMessage({
        text: "Two-factor authentication disabled for this customer.",
        type: "success",
      });
      void fetchCustomer();
    } catch {
      setDisable2faMessage({ text: "Failed to disable 2FA", type: "error" });
    } finally {
      setDisable2faLoading(false);
    }
  }, [id, fetchCustomer]);

  const updateNotifPref = useCallback(
    (
      type: "marketing" | "transactional",
      channel: keyof ChannelPrefs,
      value: boolean,
    ) => {
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
        body: JSON.stringify({
          notificationPreferences: {
            marketing: notifPrefs.marketing,
            transactional: notifPrefs.transactional,
          },
        }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setNotifSaveMessage({
          text: json.error ?? "Failed to save",
          type: "error",
        });
        return;
      }
      setNotifSaveMessage({
        text: "Notification preferences saved.",
        type: "success",
      });
      void fetchCustomer();
    } catch {
      setNotifSaveMessage({ text: "Failed to save", type: "error" });
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
          body: JSON.stringify({ body: newComment.trim() }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );
      const data = (await res.json().catch(() => ({}))) as
        | (CustomerComment & {})
        | { error?: string };
      if (!res.ok) {
        const err = data as { error?: string };
        throw new Error(err.error ?? "Failed to add comment");
      }
      const added = data as CustomerComment & {};
      setComments((prev) => [
        {
          authorId: added.authorId,
          authorName: added.authorName ?? "—",
          body: added.body,
          createdAt: added.createdAt,
          id: added.id,
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
            aria-label="Back to customers"
            size="icon"
            type="button"
            variant="ghost"
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
            aria-label="Back to customers"
            size="icon"
            type="button"
            variant="ghost"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div
          className={`
          flex min-h-[200px] items-center justify-center text-muted-foreground
        `}
        >
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
            aria-label="Back to customers"
            size="icon"
            type="button"
            variant="ghost"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div
          className={`
          rounded-lg border border-red-200 bg-red-50 p-4 text-red-800
          dark:border-red-800 dark:bg-red-950/30 dark:text-red-200
        `}
        >
          {error ?? "Customer not found."}
          <Button
            className="mt-2"
            onClick={() => void fetchCustomer()}
            size="sm"
            type="button"
            variant="outline"
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
          aria-label="Back to customers"
          asChild
          size="icon"
          variant="ghost"
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
          <div
            className={`
            flex flex-col gap-4
            sm:flex-row sm:items-center sm:gap-6
          `}
          >
            <div
              className={`
              relative h-16 w-16 shrink-0 overflow-hidden rounded-full border
              bg-muted
            `}
            >
              {customer.image ? (
                <Image
                  alt=""
                  className="object-cover"
                  fill
                  sizes="64px"
                  src={customer.image}
                />
              ) : (
                <span
                  aria-hidden
                  className={cn(
                    `
                      flex size-full items-center justify-center text-2xl
                      font-medium text-muted-foreground
                    `,
                  )}
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
          <div
            className={`
            grid gap-4
            sm:grid-cols-2
          `}
          >
            <div>
              <label className={labelClass} htmlFor="customer-first-name">
                <span
                  className={`
                  text-xs font-medium tracking-wider text-muted-foreground
                  uppercase
                `}
                >
                  First name
                </span>
              </label>
              <input
                className={inputClass}
                id="customer-first-name"
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="—"
                type="text"
                value={firstName}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="customer-last-name">
                <span
                  className={`
                  text-xs font-medium tracking-wider text-muted-foreground
                  uppercase
                `}
                >
                  Last name
                </span>
              </label>
              <input
                className={inputClass}
                id="customer-last-name"
                onChange={(e) => setLastName(e.target.value)}
                placeholder="—"
                type="text"
                value={lastName}
              />
            </div>
            <div>
              <span
                className={`
                text-xs font-medium tracking-wider text-muted-foreground
                uppercase
              `}
              >
                Email
              </span>
              <p className="mt-1 text-sm">{customer.email}</p>
            </div>
            <div>
              <label className={labelClass} htmlFor="customer-phone">
                <span
                  className={`
                  text-xs font-medium tracking-wider text-muted-foreground
                  uppercase
                `}
                >
                  Phone
                </span>
              </label>
              <input
                className={inputClass}
                id="customer-phone"
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 234 567 8900"
                type="tel"
                value={phone}
              />
            </div>
            <div>
              <span
                className={`
                text-xs font-medium tracking-wider text-muted-foreground
                uppercase
              `}
              >
                Location (from latest order)
              </span>
              <p className="mt-1 text-sm">
                {[customer.city, customer.country].filter(Boolean).join(", ") ||
                  "—"}
              </p>
            </div>
            <div
              className={`
              relative
              sm:col-span-2
            `}
            >
              <span
                className={`
                text-xs font-medium tracking-wider text-muted-foreground
                uppercase
              `}
              >
                <MapPin aria-hidden className="mr-1 inline-block h-3.5 w-3.5" />
                Look up address
              </span>
              <div className="mt-1 space-y-1">
                <input
                  autoComplete="off"
                  className={inputClass}
                  onChange={(e) => setAddressFindQuery(e.target.value)}
                  onFocus={() =>
                    addressFindResults.length > 0 && setAddressFindOpen(true)
                  }
                  placeholder="Type address or postcode…"
                  type="text"
                  value={addressFindQuery}
                />
                {addressFindLoading && (
                  <span className="text-muted-foreground">Searching…</span>
                )}
                {addressFindOpen && addressFindResults.length > 0 && (
                  <ul
                    className={`
                      z-10 max-h-40 overflow-auto rounded-md border border-input
                      bg-background py-1 shadow-md
                    `}
                    role="listbox"
                  >
                    {addressFindResults.map((item) => (
                      <li key={item.Id} role="option">
                        <button
                          className={`
                            w-full px-3 py-1.5 text-left text-sm
                            hover:bg-muted
                          `}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectAddressFromLoqate(item.Id, item.Text);
                          }}
                          type="button"
                        >
                          {item.Text}
                          {item.Description ? (
                            <span
                              className={`
                              block text-xs text-muted-foreground
                            `}
                            >
                              {item.Description}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {editableAddress && (
                  <div
                    className={`
                    space-y-2 rounded border border-input bg-muted/20 p-3
                  `}
                  >
                    <div
                      className={`
                      grid gap-2
                      sm:grid-cols-2
                    `}
                    >
                      <div className="sm:col-span-2">
                        <label className={labelClass}>Address line 1</label>
                        <input
                          className={inputClass}
                          onChange={(e) =>
                            setEditableAddress((prev) =>
                              prev
                                ? { ...prev, address1: e.target.value }
                                : null,
                            )
                          }
                          placeholder="Street address"
                          type="text"
                          value={editableAddress.address1}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className={labelClass}>Address line 2</label>
                        <input
                          className={inputClass}
                          onChange={(e) =>
                            setEditableAddress((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    address2: e.target.value.trim() || null,
                                  }
                                : null,
                            )
                          }
                          placeholder="Apt, suite, etc. (optional)"
                          type="text"
                          value={editableAddress.address2 ?? ""}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>City</label>
                        <input
                          className={inputClass}
                          onChange={(e) =>
                            setEditableAddress((prev) =>
                              prev ? { ...prev, city: e.target.value } : null,
                            )
                          }
                          placeholder="City"
                          type="text"
                          value={editableAddress.city}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>State / Province</label>
                        <input
                          className={inputClass}
                          onChange={(e) =>
                            setEditableAddress((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    stateCode: e.target.value.trim() || null,
                                  }
                                : null,
                            )
                          }
                          placeholder="State"
                          type="text"
                          value={editableAddress.stateCode ?? ""}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>ZIP / Postcode</label>
                        <input
                          className={inputClass}
                          onChange={(e) =>
                            setEditableAddress((prev) =>
                              prev ? { ...prev, zip: e.target.value } : null,
                            )
                          }
                          placeholder="ZIP"
                          type="text"
                          value={editableAddress.zip}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Country code</label>
                        <input
                          className={inputClass}
                          onChange={(e) =>
                            setEditableAddress((prev) =>
                              prev
                                ? { ...prev, countryCode: e.target.value }
                                : null,
                            )
                          }
                          placeholder="US, GB, …"
                          type="text"
                          value={editableAddress.countryCode}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={copyEditableAddress}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <Copy aria-hidden className="mr-1.5 h-4 w-4" />
                        Copy address
                      </Button>
                      <Button
                        onClick={clearEditableAddress}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="sm:col-span-2">
              <span
                className={`
                text-xs font-medium tracking-wider text-muted-foreground
                uppercase
              `}
              >
                Address
              </span>
              <div className="mt-1 space-y-2 text-sm">
                {customer.addresses && customer.addresses.length > 0 ? (
                  <ul className="list-inside list-disc space-y-1">
                    {customer.addresses.map((a) => (
                      <li className="text-muted-foreground" key={a.id}>
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
              <span
                className={`
                text-xs font-medium tracking-wider text-muted-foreground
                uppercase
              `}
              >
                Token balance
              </span>
              <p className="mt-1 text-sm">
                {formatTokenBalance(customer.tokenBalanceCents)}
              </p>
            </div>
            <div>
              <span
                className={`
                text-xs font-medium tracking-wider text-muted-foreground
                uppercase
              `}
              >
                Created
              </span>
              <p className="mt-1 text-sm">{formatDate(customer.createdAt)}</p>
            </div>
            <div>
              <span
                className={`
                text-xs font-medium tracking-wider text-muted-foreground
                uppercase
              `}
              >
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
                  ? `
                    border-green-200 bg-green-50 text-green-800
                    dark:border-green-800 dark:bg-green-950/30
                    dark:text-green-200
                  `
                  : `
                    border-red-200 bg-red-50 text-red-800
                    dark:border-red-800 dark:bg-red-950/30 dark:text-red-200
                  `,
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
                  ? `
                    border-green-200 bg-green-50 text-green-800
                    dark:border-green-800 dark:bg-green-950/30
                    dark:text-green-200
                  `
                  : `
                    border-red-200 bg-red-50 text-red-800
                    dark:border-red-800 dark:bg-red-950/30 dark:text-red-200
                  `,
              )}
            >
              {resetMessage.text}
            </p>
          )}
          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button
              disabled={saveLoading}
              onClick={() => void handleSaveProfile()}
              size="sm"
              type="button"
              variant="default"
            >
              <Save aria-hidden className="mr-1.5 h-4 w-4 shrink-0" />
              {saveLoading ? "Saving…" : "Save changes"}
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/orders?userId=${encodeURIComponent(customer.id)}`}>
                View orders
              </Link>
            </Button>
            <Button
              aria-label="Send password reset email to customer"
              disabled={resetLoading}
              onClick={() => void handleResetPassword()}
              size="sm"
              type="button"
              variant="outline"
            >
              <KeyRound aria-hidden className="mr-1.5 h-4 w-4 shrink-0" />
              {resetLoading ? "Sending…" : "Reset password"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Membership & staking (on-chain tier and lock) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown aria-hidden className="h-5 w-5" />
            Membership & staking
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Tier and lock from on-chain stake. Tier history is recorded daily
            and shown below.
          </p>
        </CardHeader>
        <CardContent>
          {membershipLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : membership ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <span
                    className={`
                    text-xs font-medium tracking-wider text-muted-foreground
                    uppercase
                  `}
                  >
                    Current tier
                  </span>
                  <p className="mt-1 text-sm font-medium">
                    {membership.bestTier != null
                      ? `Tier ${membership.bestTier}`
                      : "—"}
                  </p>
                </div>
                <div>
                  <span
                    className={`
                    text-xs font-medium tracking-wider text-muted-foreground
                    uppercase
                  `}
                  >
                    Member since
                  </span>
                  <p className="mt-1 text-sm">
                    {membership.memberSince
                      ? new Date(
                          membership.memberSince,
                        ).toLocaleDateString(undefined, {
                          dateStyle: "medium",
                        })
                      : "—"}
                  </p>
                </div>
              </div>
              {membership.wallets.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No Solana wallet linked. Customer can link a wallet in their
                  account to stake and get a tier.
                </p>
              ) : (
                <div className="space-y-3">
                  <span
                    className={`
                    text-xs font-medium tracking-wider text-muted-foreground
                    uppercase
                  `}
                  >
                    Linked Solana wallet(s)
                  </span>
                  <ul className="space-y-3 rounded-lg border p-3">
                    {membership.wallets.map((w) => (
                      <li
                        key={w.address}
                        className="flex flex-col gap-1.5 text-sm"
                      >
                        <span className="font-mono text-xs text-muted-foreground">
                          {w.address.slice(0, 4)}…{w.address.slice(-4)}
                        </span>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <span>
                            Staked:{" "}
                            <strong>
                              {w.stakedBalance} {membership.tokenSymbol}
                            </strong>
                            {w.tier != null && (
                              <span className="text-muted-foreground">
                                {" "}
                                → Tier {w.tier}
                              </span>
                            )}
                          </span>
                          {w.lock ? (
                            <span>
                              Lock: {w.lock.durationLabel}
                              {w.lock.isLocked && (
                                <>
                                  {" "}
                                  · Unlocks{" "}
                                  {new Date(
                                    w.lock.unlocksAt,
                                  ).toLocaleDateString(undefined, {
                                    dateStyle: "short",
                                  })}
                                </>
                              )}
                              {" · "}
                              Staked at{" "}
                              {new Date(
                                w.lock.stakedAt,
                              ).toLocaleDateString(undefined, {
                                dateStyle: "short",
                              })}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              No active stake
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {/* Tier history (from daily snapshots) */}
              {membership.history && (
                <div className="space-y-3 border-t pt-4">
                  <span
                    className={`
                    text-xs font-medium tracking-wider text-muted-foreground
                    uppercase
                  `}
                  >
                    Tier history
                  </span>
                  {membership.history.periods.length > 0 ? (
                    <ul className="space-y-1.5 text-sm">
                      {membership.history.periods.map((p, i) => (
                        <li key={i}>
                          <strong>Tier {p.tier}</strong>
                          {" — "}
                          {new Date(
                            p.startDate,
                          ).toLocaleDateString(undefined, {
                            dateStyle: "medium",
                          })}
                          {p.startDate !== p.endDate && (
                            <>
                              {" → "}
                              {new Date(
                                p.endDate,
                              ).toLocaleDateString(undefined, {
                                dateStyle: "medium",
                              })}
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No tier history yet. Run the daily snapshot job to
                      record history.
                    </p>
                  )}
                    {membership.history.rows.length > 0 && (
                      <details className="text-sm">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          {membership.history.rows.length} daily snapshot(s)
                        </summary>
                        <div className="mt-2 max-h-48 overflow-auto rounded border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Wallet</TableHead>
                                <TableHead>Tier</TableHead>
                                <TableHead className="text-right">
                                  Staked (raw)
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {membership.history.rows
                                .slice(0, 50)
                                .map((r, i) => (
                                  <TableRow key={i}>
                                    <TableCell>{r.date}</TableCell>
                                    <TableCell className="font-mono text-xs">
                                      {r.wallet.slice(0, 4)}…{r.wallet.slice(-4)}
                                    </TableCell>
                                    <TableCell>
                                      {r.tier != null ? `Tier ${r.tier}` : "—"}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-xs">
                                      {r.stakedAmountRaw}
                                    </TableCell>
                                  </TableRow>
                                ))}
                            </TableBody>
                          </Table>
                          {membership.history.rows.length > 50 && (
                            <p className="border-t px-2 py-1 text-xs text-muted-foreground">
                              Showing first 50 of{" "}
                              {membership.history.rows.length}
                            </p>
                          )}
                        </div>
                      </details>
                    )}
                  </div>
                )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Could not load membership. Staking may be disabled or RPC
              unavailable.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Two-Factor Authentication */}
      {customer.twoFactorEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield aria-hidden className="h-5 w-5" />
              Two-Factor Authentication
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              This customer has 2FA enabled. You can disable it so they can sign
              in without a code (e.g. if they lost their device).
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {disable2faMessage && (
              <p
                className={cn(
                  "rounded-md border px-3 py-2 text-sm",
                  disable2faMessage.type === "success"
                    ? `
                      border-green-200 bg-green-50 text-green-800
                      dark:border-green-800 dark:bg-green-950/30
                      dark:text-green-200
                    `
                    : `
                      border-red-200 bg-red-50 text-red-800
                      dark:border-red-800 dark:bg-red-950/30 dark:text-red-200
                    `,
                )}
              >
                {disable2faMessage.text}
              </p>
            )}
            <Button
              aria-label="Disable two-factor authentication for this customer"
              disabled={disable2faLoading}
              onClick={() => void handleDisable2fa()}
              size="sm"
              type="button"
              variant="destructive"
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
            <Link2 aria-hidden className="h-5 w-5" />
            Affiliate
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Customer&apos;s affiliate code and status (if they are in the
            program).
          </p>
        </CardHeader>
        <CardContent>
          {customer.affiliate ? (
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <span
                  className={`
                  text-xs font-medium tracking-wider text-muted-foreground
                  uppercase
                `}
                >
                  Code
                </span>
                <p className="mt-1 font-mono text-sm font-medium">
                  {customer.affiliate.code}
                </p>
              </div>
              <div>
                <span
                  className={`
                  text-xs font-medium tracking-wider text-muted-foreground
                  uppercase
                `}
                >
                  Status
                </span>
                <p className="mt-1 text-sm capitalize">
                  {customer.affiliate.status}
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link
                  href={`/affiliates?search=${encodeURIComponent(customer.affiliate.code)}`}
                >
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
      {customer.notificationPreferences &&
        (notifPrefs ?? customer.notificationPreferences) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell aria-hidden className="h-5 w-5" />
                Notification preferences
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Transactional and marketing preferences per channel. Same as
                customer dashboard Settings → Notifications. Telegram applies
                only when the customer has linked Telegram.
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
                          <span
                            className={`
                            text-xs font-normal text-muted-foreground
                          `}
                          >
                            Orders, shipping, account
                          </span>
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="font-semibold">Marketing</span>
                          <span
                            className={`
                            text-xs font-normal text-muted-foreground
                          `}
                          >
                            Promotions, news, offers
                          </span>
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      {
                        disabled: false,
                        id: "website" as const,
                        label: "Website",
                        note: null as null | string,
                      },
                      {
                        disabled: false,
                        id: "email" as const,
                        label: "Email",
                        note: null as null | string,
                      },
                      {
                        disabled: false,
                        id: "sms" as const,
                        label: "SMS",
                        note: null as null | string,
                      },
                      {
                        disabled:
                          !customer.notificationPreferences.hasTelegramLinked,
                        id: "telegram" as const,
                        label: "Telegram",
                        note: !customer.notificationPreferences
                          .hasTelegramLinked
                          ? " (not linked)"
                          : null,
                      },
                      {
                        disabled: false,
                        id: "aiCompanion" as const,
                        label: "AI Companion",
                        note: null as null | string,
                      },
                    ].map(({ disabled, id, label, note }) => {
                      const prefs =
                        notifPrefs ?? customer.notificationPreferences;
                      return (
                        <TableRow key={id}>
                          <TableCell className="font-medium">
                            {label}
                            {note && (
                              <span className="text-muted-foreground">
                                {note}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <input
                              aria-label={`${label} transactional`}
                              checked={prefs?.transactional[id] ?? false}
                              className="h-4 w-4 rounded border-input"
                              disabled={disabled}
                              onChange={(e) =>
                                updateNotifPref(
                                  "transactional",
                                  id,
                                  e.target.checked,
                                )
                              }
                              type="checkbox"
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <input
                              aria-label={`${label} marketing`}
                              checked={prefs?.marketing[id] ?? false}
                              className="h-4 w-4 rounded border-input"
                              disabled={disabled}
                              onChange={(e) =>
                                updateNotifPref(
                                  "marketing",
                                  id,
                                  e.target.checked,
                                )
                              }
                              type="checkbox"
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
                      ? `
                        border-green-200 bg-green-50 text-green-800
                        dark:border-green-800 dark:bg-green-950/30
                        dark:text-green-200
                      `
                      : `
                        border-red-200 bg-red-50 text-red-800
                        dark:border-red-800 dark:bg-red-950/30 dark:text-red-200
                      `,
                  )}
                >
                  {notifSaveMessage.text}
                </p>
              )}
              <Button
                className="mt-3"
                disabled={notifSaveLoading}
                onClick={() => void handleSaveNotificationPrefs()}
                size="sm"
                type="button"
                variant="default"
              >
                <Save aria-hidden className="mr-1.5 h-4 w-4 shrink-0" />
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
                  className={`
                    flex flex-wrap items-center justify-between gap-2 rounded-md
                    border p-3
                  `}
                  key={order.id}
                >
                  <div className="min-w-0">
                    <Link
                      className={`
                        font-medium text-primary
                        hover:underline
                      `}
                      href={`/orders/${order.id}`}
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
                        ? `
                          bg-green-100 text-green-800
                          dark:bg-green-900/30 dark:text-green-200
                        `
                        : order.paymentStatus === "pending"
                          ? `
                            bg-amber-100 text-amber-800
                            dark:bg-amber-900/30 dark:text-amber-200
                          `
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
            <Button asChild className="mt-3" size="sm" variant="outline">
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
            <MessageSquarePlus aria-hidden className="h-5 w-5" />
            Internal comments
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Notes visible only to admins. Not shared with the customer.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <textarea
              className={cn(inputClass, "min-h-[80px] resize-y")}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment…"
              rows={3}
              value={newComment}
            />
            <Button
              disabled={!newComment.trim() || addCommentLoading}
              onClick={() => void handleAddComment()}
              size="sm"
              type="button"
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
                  className="rounded-md border bg-muted/30 p-3 text-sm"
                  key={c.id}
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

function formatDate(s: null | string): string {
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

function formatOrderTotal(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(cents / 100);
}

function formatTokenBalance(cents: null | number): string {
  if (cents === null) return "—";
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(cents / 100);
}
