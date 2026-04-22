"use client";

import { Loader2, MapPin, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "~/lib/cn";
import { COUNTRIES_BY_CONTINENT } from "~/lib/countries-by-continent";
import { getAdminApiBaseUrl } from "~/lib/env";
import { mapRetrieveToShipping } from "~/lib/loqate";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

const API_BASE = getAdminApiBaseUrl();

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const labelClass = "mb-1.5 block text-sm font-medium";

const ALL_COUNTRY_OPTIONS: { label: string; value: string }[] = [
  { label: "Select country", value: "" },
  ...COUNTRIES_BY_CONTINENT.flatMap((c) =>
    c.countries.map((x) => ({ label: x.name, value: x.code })),
  ),
];

const US_STATE_OPTIONS = [
  { label: "State", value: "" },
  { label: "Alabama", value: "AL" },
  { label: "California", value: "CA" },
  { label: "Florida", value: "FL" },
  { label: "New York", value: "NY" },
  { label: "Texas", value: "TX" },
  { label: "Washington", value: "WA" },
  // add more as needed
];

const PAYMENT_STATUS_OPTIONS = [
  { label: "Pending", value: "pending" },
  { label: "Paid", value: "paid" },
  { label: "Refund pending", value: "refund_pending" },
  { label: "Refunded", value: "refunded" },
  { label: "Cancelled", value: "cancelled" },
];

const FULFILLMENT_STATUS_OPTIONS = [
  { label: "Unfulfilled", value: "unfulfilled" },
  { label: "On hold", value: "on_hold" },
  { label: "Partially fulfilled", value: "partially_fulfilled" },
  { label: "Fulfilled", value: "fulfilled" },
];

interface CryptoPayment {
  amount: null | string;
  chainId: null | number;
  currency: null | string;
  network: null | string;
  payerWallet: null | string;
  txHash: null | string;
}

interface OrderDetail {
  /** When set, only these countries are shippable for this order (product restrictions). Empty or null = all countries. */
  allowedCountryCodes?: null | string[];
  createdAt: string;
  cryptoPayment?: CryptoPayment | null;
  customerNote: string;
  discountPercent: number;
  email: string;
  fulfillmentStatus: string;
  id: string;
  internalNotes: string;
  items: OrderItem[];
  paymentMethod: string;
  paymentStatus: string;
  printfulCosts?: null | PrintfulCosts;
  shippingAddress1: string;
  shippingAddress2: string;
  shippingCity: string;
  shippingCountryCode: string;
  shippingFeeCents: number;
  shippingMethod: string;
  shippingName: string;
  shippingPhone: string;
  shippingStateCode: string;
  shippingZip: string;
  status: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  totalComputedCents: number;
  tracking?: null | TrackingInfo;
  updatedAt: string;
  user: null | { email: string; id: string; name: string };
  userId: null | string;
}

interface OrderItem {
  id: string;
  imageUrl: null | string;
  name: string;
  priceCents: number;
  productId: null | string;
  productName: string;
  quantity: number;
}

interface PrintfulCosts {
  shippingCents: null | number;
  taxCents: null | number;
  totalCents: null | number;
}

interface ProductOption {
  id: string;
  imageUrl: null | string;
  name: string;
  priceCents: number;
}

interface TrackingInfo {
  carrier: null | string;
  deliveredAt: null | string;
  estimatedDeliveryFrom: null | string;
  estimatedDeliveryTo: null | string;
  events: null | { description: string; triggered_at: string }[];
  shippedAt: null | string;
  trackingNumber: null | string;
  trackingUrl: null | string;
}

export default function AdminOrderDetailsPage() {
  const params = useParams();
  const orderId = typeof params.orderId === "string" ? params.orderId : "";

  const [order, setOrder] = useState<null | OrderDetail>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | string>(null);
  const [saving, setSaving] = useState(false);

  const [paymentStatus, setPaymentStatus] = useState("");
  const [fulfillmentStatus, setFulfillmentStatus] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [shippingFeeCents, setShippingFeeCents] = useState(0);
  const [taxCents, setTaxCents] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [shippingName, setShippingName] = useState("");
  const [shippingAddress1, setShippingAddress1] = useState("");
  const [shippingAddress2, setShippingAddress2] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingStateCode, setShippingStateCode] = useState("");
  const [shippingZip, setShippingZip] = useState("");
  const [shippingCountryCode, setShippingCountryCode] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>(
    {},
  );
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState<ProductOption[]>([]);
  const [productSearching, setProductSearching] = useState(false);
  const [addingProductId, setAddingProductId] = useState<null | string>(null);
  const [refunding, setRefunding] = useState(false);

  const [addressFindQuery, setAddressFindQuery] = useState("");
  const [addressFindResults, setAddressFindResults] = useState<
    { Description?: string; Id: string; Text: string; Type?: string }[]
  >([]);
  const [addressFindOpen, setAddressFindOpen] = useState(false);
  const [addressFindLoading, setAddressFindLoading] = useState(false);
  const addressFindDebounceRef = useRef<null | ReturnType<typeof setTimeout>>(
    null,
  );

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/${orderId}`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 404) {
          setError("Order not found.");
          return;
        }
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as OrderDetail;
      setOrder(data);
      setPaymentStatus(data.paymentStatus ?? "pending");
      setFulfillmentStatus(data.fulfillmentStatus ?? "unfulfilled");
      setCustomerNote(data.customerNote ?? "");
      setInternalNotes(data.internalNotes ?? "");
      setShippingFeeCents(data.shippingFeeCents ?? 0);
      setTaxCents(data.taxCents ?? 0);
      setDiscountPercent(data.discountPercent ?? 0);
      setShippingName(data.shippingName ?? "");
      setShippingAddress1(data.shippingAddress1 ?? "");
      setShippingAddress2(data.shippingAddress2 ?? "");
      setShippingCity(data.shippingCity ?? "");
      setShippingStateCode(data.shippingStateCode ?? "");
      setShippingZip(data.shippingZip ?? "");
      setShippingCountryCode(data.shippingCountryCode ?? "");
      setShippingPhone(data.shippingPhone ?? "");
      setItemQuantities(
        Object.fromEntries(data.items.map((i) => [i.id, i.quantity])),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load order");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void fetchOrder();
  }, [fetchOrder]);

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
        const data = (await res.json()) as {
          Items?: {
            Description?: string;
            Id: string;
            Text: string;
            Type?: string;
          }[];
        };
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

  const selectAddressFromLoqate = useCallback(async (id: string) => {
    setAddressFindOpen(false);
    setAddressFindQuery("");
    setAddressFindResults([]);
    try {
      const res = await fetch(
        `${API_BASE}/api/loqate/retrieve?id=${encodeURIComponent(id)}`,
        { credentials: "include" },
      );
      if (!res.ok) return;
      const addr = (await res.json()) as Parameters<
        typeof mapRetrieveToShipping
      >[0];
      const mapped = mapRetrieveToShipping(addr);
      setShippingAddress1(mapped.street);
      setShippingAddress2(mapped.apartment);
      setShippingCity(mapped.city);
      setShippingStateCode(mapped.state);
      setShippingZip(mapped.zip);
      if (mapped.country) setShippingCountryCode(mapped.country);
    } catch {
      // ignore
    }
  }, []);

  const updateItemQty = useCallback((itemId: string, qty: number) => {
    setItemQuantities((prev) => ({ ...prev, [itemId]: Math.max(0, qty) }));
  }, []);

  const searchProducts = useCallback(async () => {
    const q = productSearch.trim();
    if (!q) {
      setProductResults([]);
      return;
    }
    setProductSearching(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/products?search=${encodeURIComponent(q)}&limit=20`,
        { credentials: "include" },
      );
      if (!res.ok) return;
      const json = (await res.json()) as {
        items: {
          id: string;
          imageUrl: null | string;
          name: string;
          priceCents: number;
        }[];
      };
      setProductResults(
        (json.items ?? []).map((p) => ({
          id: p.id,
          imageUrl: p.imageUrl ?? null,
          name: p.name,
          priceCents: p.priceCents,
        })),
      );
    } finally {
      setProductSearching(false);
    }
  }, [productSearch]);

  const handleAddProduct = useCallback(
    async (productId: string, quantity: number) => {
      if (!orderId || quantity < 1) return;
      setAddingProductId(productId);
      try {
        const res = await fetch(`${API_BASE}/api/admin/orders/${orderId}`, {
          body: JSON.stringify({
            addItems: [{ productId, quantity }],
          }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? "Failed to add product");
        }
        setProductSearch("");
        setProductResults([]);
        void fetchOrder();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add product");
      } finally {
        setAddingProductId(null);
      }
    },
    [orderId, fetchOrder],
  );

  const handleRefund = useCallback(async () => {
    if (!orderId || !order) return;
    if (
      !window.confirm(
        "Mark this order as refunded? This updates the order status only.",
      )
    )
      return;
    setRefunding(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/${orderId}`, {
        body: JSON.stringify({ paymentStatus: "refunded" }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to mark as refunded");
      }
      void fetchOrder();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to mark as refunded",
      );
    } finally {
      setRefunding(false);
    }
  }, [orderId, order, fetchOrder]);

  const handleSave = useCallback(async () => {
    if (!orderId || !order) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/orders/${orderId}`, {
        body: JSON.stringify({
          customerNote: customerNote || null,
          discountPercent,
          fulfillmentStatus: fulfillmentStatus || undefined,
          internalNotes: internalNotes || null,
          items: order.items.map((i) => ({
            id: i.id,
            quantity: itemQuantities[i.id] ?? i.quantity,
          })),
          paymentStatus: paymentStatus || undefined,
          shippingAddress1: shippingAddress1 || null,
          shippingAddress2: shippingAddress2 || null,
          shippingCity: shippingCity || null,
          shippingCountryCode: shippingCountryCode || null,
          shippingFeeCents,
          shippingName: shippingName || null,
          shippingPhone: shippingPhone || null,
          shippingStateCode: shippingStateCode || null,
          shippingZip: shippingZip || null,
          taxCents,
        }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to save");
      }
      void fetchOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [
    orderId,
    order,
    paymentStatus,
    fulfillmentStatus,
    customerNote,
    internalNotes,
    shippingFeeCents,
    taxCents,
    discountPercent,
    shippingName,
    shippingAddress1,
    shippingAddress2,
    shippingCity,
    shippingStateCode,
    shippingZip,
    shippingCountryCode,
    shippingPhone,
    itemQuantities,
    fetchOrder,
  ]);

  if (loading) {
    return (
      <div
        className={`
          flex min-h-[200px] items-center justify-center text-muted-foreground
        `}
      >
        <Loader2 aria-hidden className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="space-y-4">
        <Link
          className={`
            text-sm font-medium text-muted-foreground
            hover:text-foreground
          `}
          href="/orders"
        >
          ← Back to orders
        </Link>
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

  if (!order) return null;

  const subtotalCents = order.items.reduce(
    (sum, i) => sum + i.priceCents * (itemQuantities[i.id] ?? i.quantity),
    0,
  );
  const totalCents = Math.round(
    subtotalCents +
      shippingFeeCents +
      taxCents -
      (subtotalCents * discountPercent) / 100,
  );
  const isUS = shippingCountryCode === "US";

  const countryOptions =
    order?.allowedCountryCodes && order.allowedCountryCodes.length > 0
      ? [
          { label: "Select country", value: "" },
          ...order.allowedCountryCodes
            .map(
              (code) =>
                ALL_COUNTRY_OPTIONS.find((o) => o.value === code) ?? {
                  label: code,
                  value: code,
                },
            )
            .filter((o) => o.value !== ""),
        ]
      : ALL_COUNTRY_OPTIONS;

  return (
    <div className="space-y-6">
      <div
        className={`
          flex flex-col gap-4
          sm:flex-row sm:items-center sm:justify-between
        `}
      >
        <div className="flex items-center gap-4">
          <Link
            className={`
              text-sm font-medium text-muted-foreground
              hover:text-foreground
            `}
            href="/orders"
          >
            ← Back to orders
          </Link>
          <h2 className="text-2xl font-semibold tracking-tight">
            Order Details
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={saving} onClick={handleSave} type="button">
            {saving ? (
              <>
                <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
          <Button
            aria-label="Mark order as refunded"
            disabled={
              refunding ||
              paymentStatus === "refunded" ||
              paymentStatus === "refund_pending"
            }
            onClick={() => void handleRefund()}
            type="button"
            variant="outline"
          >
            {refunding ? (
              <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Undo2 aria-hidden className="mr-2 h-4 w-4" />
            )}
            Refund
          </Button>
        </div>
      </div>

      {error && (
        <div
          className={`
            rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800
            dark:border-red-800 dark:bg-red-950/30 dark:text-red-200
          `}
        >
          {error}
        </div>
      )}

      {/* Order number with Payment and Fulfillment status badges (separate fields) */}
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-semibold tracking-tight">
          Order #{order.id.slice(0, 8)}
        </h3>
        <span
          className={cn(
            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
            (paymentStatus ?? "pending").toLowerCase() === "pending"
              ? `
                bg-sky-100 text-sky-800
                dark:bg-sky-900/40 dark:text-sky-200
              `
              : (paymentStatus ?? "pending").toLowerCase() === "paid"
                ? `
                  bg-emerald-100 text-emerald-800
                  dark:bg-emerald-900/40 dark:text-emerald-200
                `
                : (paymentStatus ?? "pending").toLowerCase() ===
                    "refund_pending"
                  ? `
                    bg-amber-100 text-amber-800
                    dark:bg-amber-900/40 dark:text-amber-200
                  `
                  : (paymentStatus ?? "pending").toLowerCase() === "refunded" ||
                      (paymentStatus ?? "pending").toLowerCase() === "cancelled"
                    ? `
                      bg-red-100 text-red-800
                      dark:bg-red-900/40 dark:text-red-200
                    `
                    : `
                      bg-slate-100 text-slate-700
                      dark:bg-slate-800 dark:text-slate-200
                    `,
          )}
        >
          Payment:{" "}
          {PAYMENT_STATUS_OPTIONS.find(
            (o) => o.value === (paymentStatus || "pending"),
          )?.label ??
            paymentStatus ??
            "Pending"}
        </span>
        <span
          className={cn(
            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
            (fulfillmentStatus ?? "unfulfilled").toLowerCase() === "fulfilled"
              ? `
                bg-emerald-100 text-emerald-800
                dark:bg-emerald-900/40 dark:text-emerald-200
              `
              : (fulfillmentStatus ?? "unfulfilled").toLowerCase() ===
                  "unfulfilled"
                ? `
                  bg-amber-100 text-amber-800
                  dark:bg-amber-900/40 dark:text-amber-200
                `
                : (fulfillmentStatus ?? "unfulfilled").toLowerCase() ===
                    "on_hold"
                  ? `
                    bg-slate-100 text-slate-700
                    dark:bg-slate-800 dark:text-slate-200
                  `
                  : (fulfillmentStatus ?? "unfulfilled").toLowerCase() ===
                      "partially_fulfilled"
                    ? `
                      bg-sky-100 text-sky-800
                      dark:bg-sky-900/40 dark:text-sky-200
                    `
                    : `
                      bg-slate-100 text-slate-700
                      dark:bg-slate-800 dark:text-slate-200
                    `,
          )}
        >
          Fulfillment:{" "}
          {FULFILLMENT_STATUS_OPTIONS.find(
            (o) => o.value === (fulfillmentStatus || "unfulfilled"),
          )?.label ??
            fulfillmentStatus ??
            "Unfulfilled"}
        </span>
      </div>

      {/* Order ID, date, payment status, shipping status, customer */}
      <Card>
        <CardHeader>
          <CardTitle>Order info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 gap-y-2">
            <div>
              <span className="text-xs font-medium text-muted-foreground">
                Order ID
              </span>
              <p className="font-mono text-sm">{order.id}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground">
                Placed on
              </span>
              <p className="text-sm">{formatDate(order.createdAt)}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground">
                Payment status
              </span>
              <select
                aria-label="Payment status"
                className={cn(inputClass, "max-w-[180px]")}
                onChange={(e) => setPaymentStatus(e.target.value)}
                value={paymentStatus}
              >
                {PAYMENT_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground">
                Fulfillment status
              </span>
              <select
                aria-label="Fulfillment status"
                className={cn(inputClass, "max-w-[180px]")}
                onChange={(e) => setFulfillmentStatus(e.target.value)}
                value={fulfillmentStatus}
              >
                {FULFILLMENT_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {order.user && (
              <div>
                <span className="text-xs font-medium text-muted-foreground">
                  Customer
                </span>
                <p className="text-sm">
                  <Link
                    className={`
                      font-medium text-primary
                      hover:underline
                    `}
                    href={`/customers/${order.user.id}`}
                  >
                    {order.user.name || order.user.email}
                  </Link>
                </p>
              </div>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Email:</span>{" "}
            {order.email}
          </div>
        </CardContent>
      </Card>

      {/* Add product lookup */}
      <Card>
        <CardHeader>
          <CardTitle>Add product to order</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <input
              aria-label="Search products"
              className={inputClass}
              id="add-product"
              onChange={(e) => setProductSearch(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && (e.preventDefault(), searchProducts())
              }
              placeholder="Search products by name…"
              type="text"
              value={productSearch}
            />
            <Button
              disabled={productSearching}
              onClick={() => searchProducts()}
              type="button"
              variant="secondary"
            >
              {productSearching ? "Searching…" : "Search"}
            </Button>
          </div>
          {productResults.length > 0 && (
            <ul
              className={`
                max-h-48 space-y-1 overflow-y-auto rounded-md border
                border-border p-2
              `}
            >
              {productResults.map((p) => (
                <li
                  className={`
                    flex items-center justify-between gap-2 rounded px-2 py-1.5
                    text-sm
                    hover:bg-muted/50
                  `}
                  key={p.id}
                >
                  <span className="min-w-0 truncate font-medium">{p.name}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatCents(p.priceCents)}
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      className={cn(inputClass, "w-16")}
                      defaultValue={1}
                      id={`qty-add-${p.id}`}
                      min={1}
                      type="number"
                    />
                    <Button
                      disabled={addingProductId === p.id}
                      onClick={() => {
                        const input = document.getElementById(
                          `qty-add-${p.id}`,
                        ) as HTMLInputElement | null;
                        const qty = Math.max(
                          1,
                          Number.parseInt(input?.value ?? "1", 10) || 1,
                        );
                        handleAddProduct(p.id, qty);
                      }}
                      size="sm"
                      type="button"
                    >
                      {addingProductId === p.id ? "Adding…" : "Add"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Products: product, quantity, variant, price */}
      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
        </CardHeader>
        <CardContent>
          {order.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No items in this order. Use the search above to add products.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className={`
                      border-b border-border text-left text-xs font-medium
                      text-muted-foreground
                    `}
                  >
                    <th className="pr-4 pb-2">Product</th>
                    <th className="pr-4 pb-2">Variant</th>
                    <th className="pr-4 pb-2 text-right">Quantity</th>
                    <th className="pr-4 pb-2 text-right">Price</th>
                    <th className="pr-4 pb-2 text-right">Total</th>
                    <th className="w-10 pb-2" scope="col">
                      <span className="sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr
                      className={`
                        border-b border-border
                        last:border-0
                      `}
                      key={item.id}
                    >
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div
                            className={`
                              relative flex h-10 w-10 shrink-0 overflow-hidden
                              rounded border bg-muted
                            `}
                          >
                            {item.imageUrl ? (
                              <img
                                alt=""
                                className="size-full object-cover"
                                height={40}
                                src={item.imageUrl}
                                width={40}
                              />
                            ) : (
                              <span
                                className={`
                                  flex size-full items-center justify-center
                                  text-xs text-muted-foreground
                                `}
                              >
                                —
                              </span>
                            )}
                          </div>
                          <span className="font-medium">
                            {item.productName || item.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">—</td>
                      <td className="py-3 pr-4 text-right">
                        <input
                          aria-label={`Quantity for ${item.name}`}
                          className={cn(inputClass, "w-20 text-right")}
                          id={`qty-${item.id}`}
                          min={0}
                          onChange={(e) =>
                            updateItemQty(
                              item.id,
                              Number.parseInt(e.target.value, 10) || 0,
                            )
                          }
                          type="number"
                          value={itemQuantities[item.id] ?? item.quantity}
                        />
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {formatCents(item.priceCents)}
                      </td>
                      <td className="py-3 text-right font-medium tabular-nums">
                        {formatCents(
                          item.priceCents *
                            (itemQuantities[item.id] ?? item.quantity),
                        )}
                      </td>
                      <td className="py-3 pl-2 text-right">
                        <button
                          aria-label={`Remove ${item.name} from order`}
                          className={`
                            rounded p-1.5 text-muted-foreground
                            hover:bg-destructive/10 hover:text-destructive
                          `}
                          onClick={() => updateItemQty(item.id, 0)}
                          title="Remove item (save to apply)"
                          type="button"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shipping address + Shipping/taxes side by side (50% each) */}
      <div
        className={`
          grid grid-cols-1 gap-6
          lg:grid-cols-2
        `}
      >
        <Card>
          <CardHeader>
            <CardTitle>Shipping Address</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div>
              <label className={labelClass} htmlFor="shipping-name">
                Name
              </label>
              <input
                className={inputClass}
                id="shipping-name"
                onChange={(e) => setShippingName(e.target.value)}
                placeholder="Full name"
                type="text"
                value={shippingName}
              />
            </div>
            <div className="relative">
              <label className={labelClass} htmlFor="address-finder">
                <MapPin aria-hidden className="mr-1.5 inline-block h-4 w-4" />
                Find address
              </label>
              <input
                autoComplete="off"
                className={inputClass}
                id="address-finder"
                onBlur={() => setTimeout(() => setAddressFindOpen(false), 200)}
                onChange={(e) => setAddressFindQuery(e.target.value)}
                onFocus={() =>
                  addressFindResults.length > 0 && setAddressFindOpen(true)
                }
                placeholder="Start typing address or postcode…"
                type="text"
                value={addressFindQuery}
              />
              {addressFindLoading && (
                <span className="absolute top-9 right-3 text-muted-foreground">
                  <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                </span>
              )}
              {addressFindOpen && addressFindResults.length > 0 && (
                <ul
                  className={`
                    absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md
                    border border-input bg-background py-1 shadow-md
                  `}
                >
                  {addressFindResults.map((item) => (
                    <li key={item.Id}>
                      <button
                        className={`
                          w-full px-3 py-2 text-left text-sm
                          hover:bg-muted
                        `}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selectAddressFromLoqate(item.Id);
                        }}
                        type="button"
                      >
                        {item.Text}
                        {item.Description ? (
                          <span className="block text-muted-foreground">
                            {item.Description}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <label className={labelClass} htmlFor="shipping-address1">
                Address line 1
              </label>
              <input
                className={inputClass}
                id="shipping-address1"
                onChange={(e) => setShippingAddress1(e.target.value)}
                placeholder="Street address"
                type="text"
                value={shippingAddress1}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="shipping-address2">
                Address line 2
              </label>
              <input
                className={inputClass}
                id="shipping-address2"
                onChange={(e) => setShippingAddress2(e.target.value)}
                placeholder="Apartment, suite, etc."
                type="text"
                value={shippingAddress2}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="shipping-phone">
                Phone (required for Printful)
              </label>
              <input
                className={inputClass}
                id="shipping-phone"
                onChange={(e) => setShippingPhone(e.target.value)}
                placeholder="+1 234 567 8900"
                type="tel"
                value={shippingPhone}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="shipping-city">
                  City
                </label>
                <input
                  className={inputClass}
                  id="shipping-city"
                  onChange={(e) => setShippingCity(e.target.value)}
                  placeholder="City"
                  type="text"
                  value={shippingCity}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="shipping-state">
                  State / Province
                </label>
                {isUS ? (
                  <select
                    className={inputClass}
                    id="shipping-state"
                    onChange={(e) => setShippingStateCode(e.target.value)}
                    value={shippingStateCode}
                  >
                    {US_STATE_OPTIONS.map((opt) => (
                      <option key={opt.value || "empty"} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={inputClass}
                    id="shipping-state"
                    onChange={(e) => setShippingStateCode(e.target.value)}
                    placeholder="State (2-letter)"
                    type="text"
                    value={shippingStateCode}
                  />
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="shipping-postal">
                  Postal code
                </label>
                <input
                  className={inputClass}
                  id="shipping-postal"
                  onChange={(e) => setShippingZip(e.target.value)}
                  placeholder="Postal code"
                  type="text"
                  value={shippingZip}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="shipping-country">
                  Country
                </label>
                <select
                  className={inputClass}
                  id="shipping-country"
                  onChange={(e) => setShippingCountryCode(e.target.value)}
                  value={shippingCountryCode}
                >
                  {countryOptions.map((opt) => (
                    <option key={opt.value || "empty"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shipping method & costs, taxes & discounts */}
        <Card>
          <CardHeader>
            <CardTitle>Shipping, taxes &amp; discounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-xs font-medium text-muted-foreground">
                Shipping method
              </span>
              <p className="text-sm">{order.shippingMethod || "—"}</p>
            </div>
            <div>
              <label className={labelClass} htmlFor="shipping-fee">
                Shipping cost
              </label>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">$</span>
                <input
                  className={cn(inputClass, "w-24")}
                  id="shipping-fee"
                  min={0}
                  onChange={(e) =>
                    setShippingFeeCents(
                      Math.round(
                        Number.parseFloat(e.target.value || "0") * 100,
                      ),
                    )
                  }
                  step={0.01}
                  type="number"
                  value={shippingFeeCents / 100}
                />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="tax-cents">
                Tax
              </label>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">$</span>
                <input
                  className={cn(inputClass, "w-24")}
                  id="tax-cents"
                  min={0}
                  onChange={(e) =>
                    setTaxCents(
                      Math.round(
                        Number.parseFloat(e.target.value || "0") * 100,
                      ),
                    )
                  }
                  step={0.01}
                  type="number"
                  value={taxCents / 100}
                />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="discount-percent">
                Discount (%)
              </label>
              <input
                className={cn(inputClass, "w-24")}
                id="discount-percent"
                max={100}
                min={0}
                onChange={(e) =>
                  setDiscountPercent(
                    Math.max(
                      0,
                      Math.min(100, Number.parseInt(e.target.value, 10) || 0),
                    ),
                  )
                }
                type="number"
                value={discountPercent}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Total summary */}
      <Card>
        <CardHeader>
          <CardTitle>Total Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{formatCents(subtotalCents)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Shipping</span>
            <span className="tabular-nums">
              {formatCents(shippingFeeCents)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax</span>
            <span className="tabular-nums">{formatCents(taxCents)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Discount ({discountPercent}%)
            </span>
            <span className="tabular-nums">
              -
              {formatCents(Math.round((subtotalCents * discountPercent) / 100))}
            </span>
          </div>
          <div
            className={`
              flex justify-between border-t border-border pt-4 font-medium
            `}
          >
            <span>Total</span>
            <span className="tabular-nums">{formatCents(totalCents)}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Payment method:{" "}
            {order.cryptoPayment?.currency && order.cryptoPayment?.network
              ? `${order.cryptoPayment.currency} - ${order.cryptoPayment.network}`
              : order.cryptoPayment?.currency
                ? `${order.paymentMethod} · ${order.cryptoPayment.currency}`
                : order.paymentMethod}
          </div>
        </CardContent>
      </Card>

      {/* Crypto payment details (if applicable) */}
      {order.cryptoPayment && (
        <Card>
          <CardHeader>
            <CardTitle>Crypto Payment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {order.cryptoPayment.txHash && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Transaction ID</span>
                {(() => {
                  const explorerUrl = getBlockExplorerUrl(
                    order.cryptoPayment.txHash,
                    order.cryptoPayment.network,
                    order.cryptoPayment.chainId,
                  );
                  return explorerUrl ? (
                    <a
                      className={`
                        max-w-[280px] truncate font-mono text-blue-600 underline
                        hover:text-blue-800
                      `}
                      href={explorerUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                      title={order.cryptoPayment.txHash}
                    >
                      {order.cryptoPayment.txHash.slice(0, 10)}…
                      {order.cryptoPayment.txHash.slice(-8)}
                    </a>
                  ) : (
                    <span
                      className="max-w-[280px] truncate font-mono"
                      title={order.cryptoPayment.txHash}
                    >
                      {order.cryptoPayment.txHash.slice(0, 10)}…
                      {order.cryptoPayment.txHash.slice(-8)}
                    </span>
                  );
                })()}
              </div>
            )}
            {order.cryptoPayment.network && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Network</span>
                <span>{order.cryptoPayment.network}</span>
              </div>
            )}
            {order.cryptoPayment.currency && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Token</span>
                <span>
                  {order.cryptoPayment.currency}
                  {order.cryptoPayment.network && (
                    <span className="ml-1 text-muted-foreground">
                      ({order.cryptoPayment.network})
                    </span>
                  )}
                </span>
              </div>
            )}
            {order.cryptoPayment.amount && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="tabular-nums">
                  {order.cryptoPayment.amount}{" "}
                  {order.cryptoPayment.currency ?? ""}
                </span>
              </div>
            )}
            {order.cryptoPayment.payerWallet && (
              <div className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">Payer wallet</span>
                <span
                  className="font-mono text-xs break-all select-all"
                  title={order.cryptoPayment.payerWallet}
                >
                  {order.cryptoPayment.payerWallet}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tracking info */}
      <Card>
        <CardHeader>
          <CardTitle>Shipment Tracking</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {order.tracking?.trackingNumber ? (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tracking #</span>
                {order.tracking.trackingUrl ? (
                  <a
                    className={`
                      font-mono text-blue-600 underline
                      hover:text-blue-800
                    `}
                    href={order.tracking.trackingUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {order.tracking.trackingNumber}
                  </a>
                ) : (
                  <span className="font-mono">
                    {order.tracking.trackingNumber}
                  </span>
                )}
              </div>
              {order.tracking.carrier && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Carrier</span>
                  <span>{order.tracking.carrier}</span>
                </div>
              )}
              {order.tracking.shippedAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipped</span>
                  <span>
                    {new Date(order.tracking.shippedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
              {order.tracking.deliveredAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Delivered</span>
                  <span>
                    {new Date(order.tracking.deliveredAt).toLocaleDateString()}
                  </span>
                </div>
              )}
              {(order.tracking.estimatedDeliveryFrom ||
                order.tracking.estimatedDeliveryTo) && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Est. delivery</span>
                  <span>
                    {order.tracking.estimatedDeliveryFrom ?? "?"} –{" "}
                    {order.tracking.estimatedDeliveryTo ?? "?"}
                  </span>
                </div>
              )}
              {order.tracking.events &&
                Array.isArray(order.tracking.events) &&
                order.tracking.events.length > 0 && (
                  <div className="mt-2 border-t pt-2">
                    <p
                      className={`
                        mb-1 text-xs font-medium text-muted-foreground
                      `}
                    >
                      Tracking events
                    </p>
                    <ul className="space-y-1">
                      {(
                        order.tracking.events as {
                          description: string;
                          triggered_at: string;
                        }[]
                      ).map((ev, i) => (
                        <li className="flex items-start gap-2 text-xs" key={i}>
                          <span
                            className={`whitespace-nowrap text-muted-foreground`}
                          >
                            {new Date(ev.triggered_at).toLocaleDateString()}
                          </span>
                          <span>{ev.description}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No tracking information yet.
            </p>
          )}
          <div className="border-t pt-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Manual tracking entry
            </p>
            <div className="grid grid-cols-3 gap-2">
              <input
                className={cn(inputClass, "text-xs")}
                defaultValue={order.tracking?.trackingNumber ?? ""}
                id="tracking-number"
                placeholder="Tracking #"
                type="text"
              />
              <input
                className={cn(inputClass, "text-xs")}
                defaultValue={order.tracking?.trackingUrl ?? ""}
                id="tracking-url"
                placeholder="Tracking URL"
                type="text"
              />
              <input
                className={cn(inputClass, "text-xs")}
                defaultValue={order.tracking?.carrier ?? ""}
                id="tracking-carrier"
                placeholder="Carrier"
                type="text"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Printful wholesale costs (admin-only) */}
      {order.printfulCosts && (
        <Card>
          <CardHeader>
            <CardTitle>Printful Costs (Wholesale)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {order.printfulCosts.totalCents != null && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Printful Total</span>
                <span className="tabular-nums">
                  {formatCents(order.printfulCosts.totalCents)}
                </span>
              </div>
            )}
            {order.printfulCosts.shippingCents != null && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Printful Shipping</span>
                <span className="tabular-nums">
                  {formatCents(order.printfulCosts.shippingCents)}
                </span>
              </div>
            )}
            {order.printfulCosts.taxCents != null && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Printful Tax/VAT</span>
                <span className="tabular-nums">
                  {formatCents(order.printfulCosts.taxCents)}
                </span>
              </div>
            )}
            {order.printfulCosts.totalCents != null && (
              <div
                className={`
                  flex justify-between border-t border-border pt-2 text-sm
                  font-medium
                `}
              >
                <span>Your Margin</span>
                <span className="tabular-nums">
                  {formatCents(
                    order.totalCents - order.printfulCosts.totalCents,
                  )}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notes: customer note + internal notes */}
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className={labelClass} htmlFor="customer-note">
              Customer&apos;s note
            </label>
            <textarea
              aria-label="Customer's note"
              className={cn(inputClass, "resize-y")}
              id="customer-note"
              onChange={(e) => setCustomerNote(e.target.value)}
              placeholder="Optional note from the customer"
              rows={3}
              value={customerNote}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="internal-notes">
              Internal notes (admin only)
            </label>
            <textarea
              aria-label="Internal notes"
              className={cn(inputClass, "resize-y")}
              id="internal-notes"
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Internal notes about this order"
              rows={4}
              value={internalNotes}
            />
          </div>
        </CardContent>
      </Card>

      <Button disabled={saving} onClick={handleSave} type="button">
        {saving ? (
          <>
            <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />
            Saving…
          </>
        ) : (
          "Save Changes"
        )}
      </Button>
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Get block explorer URL for a transaction hash based on network/chainId */
function getBlockExplorerUrl(
  txHash: string,
  network: null | string,
  chainId: null | number,
): null | string {
  if (!txHash) return null;

  // Normalize network name
  const net = (network ?? "").toLowerCase();

  // Solana
  if (net === "solana" || net === "sol") {
    return `https://solscan.io/tx/${txHash}`;
  }

  // EVM chains by chainId
  if (chainId) {
    switch (chainId) {
      case 1: // Ethereum mainnet
        return `https://etherscan.io/tx/${txHash}`;
      case 10: // Optimism
        return `https://optimistic.etherscan.io/tx/${txHash}`;
      case 56: // BNB Chain
        return `https://bscscan.com/tx/${txHash}`;
      case 137: // Polygon
        return `https://polygonscan.com/tx/${txHash}`;
      case 8453: // Base
        return `https://basescan.org/tx/${txHash}`;
      case 42161: // Arbitrum
        return `https://arbiscan.io/tx/${txHash}`;
      case 43114: // Avalanche
        return `https://snowtrace.io/tx/${txHash}`;
      default:
        break;
    }
  }

  // Fallback by network name
  if (net === "ethereum" || net === "eth") {
    return `https://etherscan.io/tx/${txHash}`;
  }
  if (net === "base") {
    return `https://basescan.org/tx/${txHash}`;
  }
  if (net === "polygon" || net === "matic") {
    return `https://polygonscan.com/tx/${txHash}`;
  }
  if (net === "arbitrum" || net === "arb") {
    return `https://arbiscan.io/tx/${txHash}`;
  }
  if (net === "bnb" || net === "bsc") {
    return `https://bscscan.com/tx/${txHash}`;
  }
  if (net === "avalanche" || net === "avax") {
    return `https://snowtrace.io/tx/${txHash}`;
  }
  if (net === "optimism" || net === "op") {
    return `https://optimistic.etherscan.io/tx/${txHash}`;
  }

  // Bitcoin (BTCPay)
  if (net === "bitcoin" || net === "btc") {
    return `https://mempool.space/tx/${txHash}`;
  }

  return null;
}
