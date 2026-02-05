"use client";

import { Loader2, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { cn } from "~/lib/cn";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

const API_BASE =
  typeof process.env.NEXT_PUBLIC_MAIN_APP_URL === "string"
    ? process.env.NEXT_PUBLIC_MAIN_APP_URL
    : "http://localhost:3000";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const labelClass = "mb-1.5 block text-sm font-medium";

const COUNTRY_OPTIONS = [
  { value: "", label: "Select country" },
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
  { value: "GB", label: "United Kingdom" },
  { value: "AU", label: "Australia" },
  { value: "DE", label: "Germany" },
  { value: "FR", label: "France" },
  { value: "OTHER", label: "Other" },
];

const US_STATE_OPTIONS = [
  { value: "", label: "State" },
  { value: "AL", label: "Alabama" },
  { value: "CA", label: "California" },
  { value: "FL", label: "Florida" },
  { value: "NY", label: "New York" },
  { value: "TX", label: "Texas" },
  { value: "WA", label: "Washington" },
  // add more as needed
];

const PAYMENT_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "refunded", label: "Refunded" },
  { value: "cancelled", label: "Cancelled" },
];

const FULFILLMENT_STATUS_OPTIONS = [
  { value: "unfulfilled", label: "Unfulfilled" },
  { value: "on_hold", label: "On hold" },
  { value: "partially_fulfilled", label: "Partially fulfilled" },
  { value: "fulfilled", label: "Fulfilled" },
];

type OrderItem = {
  id: string;
  name: string;
  productName: string;
  priceCents: number;
  quantity: number;
  imageUrl: string | null;
  productId: string | null;
};

type OrderDetail = {
  id: string;
  createdAt: string;
  updatedAt: string;
  email: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  totalCents: number;
  totalComputedCents: number;
  subtotalCents: number;
  customerNote: string;
  internalNotes: string;
  shippingFeeCents: number;
  taxCents: number;
  discountPercent: number;
  shippingMethod: string;
  shippingName: string;
  shippingAddress1: string;
  shippingAddress2: string;
  shippingCity: string;
  shippingStateCode: string;
  shippingZip: string;
  shippingCountryCode: string;
  shippingPhone: string;
  userId: string | null;
  user: { id: string; name: string; email: string } | null;
  items: OrderItem[];
  paymentMethod: string;
};

type ProductOption = {
  id: string;
  name: string;
  priceCents: number;
  imageUrl: string | null;
};

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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

export default function AdminOrderDetailsPage() {
  const params = useParams();
  const orderId = typeof params.orderId === "string" ? params.orderId : "";

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
  const [addingProductId, setAddingProductId] = useState<string | null>(null);
  const [refunding, setRefunding] = useState(false);

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
        items: Array<{
          id: string;
          name: string;
          imageUrl: string | null;
          priceCents: number;
        }>;
      };
      setProductResults(
        (json.items ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          priceCents: p.priceCents,
          imageUrl: p.imageUrl ?? null,
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
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            addItems: [{ productId, quantity }],
          }),
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
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ paymentStatus: "refunded" }),
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
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          paymentStatus: paymentStatus || undefined,
          fulfillmentStatus: fulfillmentStatus || undefined,
          customerNote: customerNote || null,
          internalNotes: internalNotes || null,
          shippingFeeCents,
          taxCents,
          discountPercent,
          shippingName: shippingName || null,
          shippingAddress1: shippingAddress1 || null,
          shippingAddress2: shippingAddress2 || null,
          shippingCity: shippingCity || null,
          shippingStateCode: shippingStateCode || null,
          shippingZip: shippingZip || null,
          shippingCountryCode: shippingCountryCode || null,
          shippingPhone: shippingPhone || null,
          items: order.items.map((i) => ({
            id: i.id,
            quantity: itemQuantities[i.id] ?? i.quantity,
          })),
        }),
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
      <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="space-y-4">
        <Link
          href="/orders"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          ← Back to orders
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/orders"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            ← Back to orders
          </Link>
          <h2 className="text-2xl font-semibold tracking-tight">
            Order Details
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleRefund()}
            disabled={refunding || paymentStatus === "refunded"}
            aria-label="Mark order as refunded"
          >
            {refunding ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Undo2 className="mr-2 h-4 w-4" aria-hidden />
            )}
            Refund
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
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
              ? "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200"
              : (paymentStatus ?? "pending").toLowerCase() === "paid"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                : (paymentStatus ?? "pending").toLowerCase() === "refunded" ||
                    (paymentStatus ?? "pending").toLowerCase() === "cancelled"
                  ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
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
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
              : (fulfillmentStatus ?? "unfulfilled").toLowerCase() ===
                  "unfulfilled"
                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                : (fulfillmentStatus ?? "unfulfilled").toLowerCase() ===
                    "on_hold"
                  ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  : (fulfillmentStatus ?? "unfulfilled").toLowerCase() ===
                      "partially_fulfilled"
                    ? "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200"
                    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
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
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
                className={cn(inputClass, "max-w-[180px]")}
                aria-label="Payment status"
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
                value={fulfillmentStatus}
                onChange={(e) => setFulfillmentStatus(e.target.value)}
                className={cn(inputClass, "max-w-[180px]")}
                aria-label="Fulfillment status"
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
                    href={`/customers/${order.user.id}`}
                    className="font-medium text-primary hover:underline"
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
              id="add-product"
              type="text"
              placeholder="Search products by name…"
              className={inputClass}
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && (e.preventDefault(), searchProducts())
              }
              aria-label="Search products"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => searchProducts()}
              disabled={productSearching}
            >
              {productSearching ? "Searching…" : "Search"}
            </Button>
          </div>
          {productResults.length > 0 && (
            <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {productResults.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50"
                >
                  <span className="min-w-0 truncate font-medium">{p.name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatCents(p.priceCents)}
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      defaultValue={1}
                      className={cn(inputClass, "w-16")}
                      id={`qty-add-${p.id}`}
                    />
                    <Button
                      type="button"
                      size="sm"
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
                  <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                    <th className="pb-2 pr-4">Product</th>
                    <th className="pb-2 pr-4">Variant</th>
                    <th className="pb-2 pr-4 text-right">Quantity</th>
                    <th className="pb-2 pr-4 text-right">Price</th>
                    <th className="pb-2 pr-4 text-right">Total</th>
                    <th className="pb-2 w-10" scope="col">
                      <span className="sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="relative flex h-10 w-10 shrink-0 overflow-hidden rounded border bg-muted">
                            {item.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.imageUrl}
                                alt=""
                                className="size-full object-cover"
                                width={40}
                                height={40}
                              />
                            ) : (
                              <span className="flex size-full items-center justify-center text-xs text-muted-foreground">
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
                          id={`qty-${item.id}`}
                          type="number"
                          min={0}
                          value={itemQuantities[item.id] ?? item.quantity}
                          onChange={(e) =>
                            updateItemQty(
                              item.id,
                              Number.parseInt(e.target.value, 10) || 0,
                            )
                          }
                          className={cn(inputClass, "w-20 text-right")}
                          aria-label={`Quantity for ${item.name}`}
                        />
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {formatCents(item.priceCents)}
                      </td>
                      <td className="py-3 text-right tabular-nums font-medium">
                        {formatCents(
                          item.priceCents *
                            (itemQuantities[item.id] ?? item.quantity),
                        )}
                      </td>
                      <td className="py-3 pl-2 text-right">
                        <button
                          type="button"
                          className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Remove ${item.name} from order`}
                          title="Remove item (save to apply)"
                          onClick={() => updateItemQty(item.id, 0)}
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Shipping Address</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div>
              <label htmlFor="shipping-name" className={labelClass}>
                Name
              </label>
              <input
                id="shipping-name"
                type="text"
                placeholder="Full name"
                value={shippingName}
                onChange={(e) => setShippingName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="shipping-address1" className={labelClass}>
                Address line 1
              </label>
              <input
                id="shipping-address1"
                type="text"
                placeholder="Street address"
                value={shippingAddress1}
                onChange={(e) => setShippingAddress1(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="shipping-address2" className={labelClass}>
                Address line 2
              </label>
              <input
                id="shipping-address2"
                type="text"
                placeholder="Apartment, suite, etc."
                value={shippingAddress2}
                onChange={(e) => setShippingAddress2(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="shipping-phone" className={labelClass}>
                Phone (required for Printful)
              </label>
              <input
                id="shipping-phone"
                type="tel"
                placeholder="+1 234 567 8900"
                value={shippingPhone}
                onChange={(e) => setShippingPhone(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="shipping-city" className={labelClass}>
                  City
                </label>
                <input
                  id="shipping-city"
                  type="text"
                  placeholder="City"
                  value={shippingCity}
                  onChange={(e) => setShippingCity(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="shipping-state" className={labelClass}>
                  State / Province
                </label>
                {isUS ? (
                  <select
                    id="shipping-state"
                    value={shippingStateCode}
                    onChange={(e) => setShippingStateCode(e.target.value)}
                    className={inputClass}
                  >
                    {US_STATE_OPTIONS.map((opt) => (
                      <option key={opt.value || "empty"} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="shipping-state"
                    type="text"
                    placeholder="State (2-letter)"
                    value={shippingStateCode}
                    onChange={(e) => setShippingStateCode(e.target.value)}
                    className={inputClass}
                  />
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="shipping-postal" className={labelClass}>
                  Postal code
                </label>
                <input
                  id="shipping-postal"
                  type="text"
                  placeholder="Postal code"
                  value={shippingZip}
                  onChange={(e) => setShippingZip(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="shipping-country" className={labelClass}>
                  Country
                </label>
                <select
                  id="shipping-country"
                  value={shippingCountryCode}
                  onChange={(e) => setShippingCountryCode(e.target.value)}
                  className={inputClass}
                >
                  {COUNTRY_OPTIONS.map((opt) => (
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
              <label htmlFor="shipping-fee" className={labelClass}>
                Shipping cost
              </label>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">$</span>
                <input
                  id="shipping-fee"
                  type="number"
                  min={0}
                  step={0.01}
                  value={shippingFeeCents / 100}
                  onChange={(e) =>
                    setShippingFeeCents(
                      Math.round(
                        Number.parseFloat(e.target.value || "0") * 100,
                      ),
                    )
                  }
                  className={cn(inputClass, "w-24")}
                />
              </div>
            </div>
            <div>
              <label htmlFor="tax-cents" className={labelClass}>
                Tax
              </label>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">$</span>
                <input
                  id="tax-cents"
                  type="number"
                  min={0}
                  step={0.01}
                  value={taxCents / 100}
                  onChange={(e) =>
                    setTaxCents(
                      Math.round(
                        Number.parseFloat(e.target.value || "0") * 100,
                      ),
                    )
                  }
                  className={cn(inputClass, "w-24")}
                />
              </div>
            </div>
            <div>
              <label htmlFor="discount-percent" className={labelClass}>
                Discount (%)
              </label>
              <input
                id="discount-percent"
                type="number"
                min={0}
                max={100}
                value={discountPercent}
                onChange={(e) =>
                  setDiscountPercent(
                    Math.max(
                      0,
                      Math.min(100, Number.parseInt(e.target.value, 10) || 0),
                    ),
                  )
                }
                className={cn(inputClass, "w-24")}
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
          <div className="flex justify-between border-t border-border pt-4 font-medium">
            <span>Total</span>
            <span className="tabular-nums">{formatCents(totalCents)}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Payment method: {order.paymentMethod}
          </div>
        </CardContent>
      </Card>

      {/* Notes: customer note + internal notes */}
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="customer-note" className={labelClass}>
              Customer&apos;s note
            </label>
            <textarea
              id="customer-note"
              rows={3}
              placeholder="Optional note from the customer"
              value={customerNote}
              onChange={(e) => setCustomerNote(e.target.value)}
              className={cn(inputClass, "resize-y")}
              aria-label="Customer's note"
            />
          </div>
          <div>
            <label htmlFor="internal-notes" className={labelClass}>
              Internal notes (admin only)
            </label>
            <textarea
              id="internal-notes"
              rows={4}
              placeholder="Internal notes about this order"
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              className={cn(inputClass, "resize-y")}
              aria-label="Internal notes"
            />
          </div>
        </CardContent>
      </Card>

      <Button type="button" onClick={handleSave} disabled={saving}>
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Saving…
          </>
        ) : (
          "Save Changes"
        )}
      </Button>
    </div>
  );
}
