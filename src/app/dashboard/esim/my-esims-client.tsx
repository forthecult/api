"use client";

import {
  CheckCircle,
  Clock,
  ExternalLink,
  Loader2,
  Signal,
  Smartphone,
  Wifi,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "~/ui/primitives/badge";
import { Button } from "~/ui/primitives/button";
import { Card, CardContent, CardHeader } from "~/ui/primitives/card";

// ---------- Types ----------

type EsimOrder = {
  id: string;
  esimId: string | null;
  iccid: string | null;
  packageName: string;
  packageType: string;
  dataQuantity: number;
  dataUnit: string;
  validityDays: number;
  countryName: string | null;
  priceCents: number;
  status: string;
  activationLink: string | null;
  createdAt: string;
  activatedAt: string | null;
  expiresAt: string | null;
};

type UsageData = {
  initial_data_quantity: number | string;
  initial_data_unit: string;
  rem_data_quantity: number | string;
  rem_data_unit: string;
};

// ---------- Helpers ----------

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    icon: typeof CheckCircle;
    className: string;
  }
> = {
  active: {
    label: "Active",
    icon: CheckCircle,
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  processing: {
    label: "Processing",
    icon: Clock,
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  pending: {
    label: "Pending",
    icon: Clock,
    className: "bg-muted text-muted-foreground",
  },
  expired: {
    label: "Expired",
    icon: XCircle,
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

// ---------- Sub-components ----------

function EsimOrderCard({ order }: { order: EsimOrder }) {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);

  const statusConfig = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;

  const fetchUsage = () => {
    if (!order.esimId || usage) return;
    setLoadingUsage(true);
    fetch(`/api/esim/my-esims/${order.id}/usage`)
      .then((res) => res.json())
      .then(
        (data: {
          status: boolean;
          data?: UsageData;
        }) => {
          if (data.status && data.data) {
            setUsage(data.data);
          }
        },
      )
      .catch(console.error)
      .finally(() => setLoadingUsage(false));
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* Left: Package info */}
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-start gap-2 flex-wrap">
              <h3 className="font-semibold text-sm leading-tight">
                {order.packageName}
              </h3>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig.className}`}
              >
                <StatusIcon className="h-3 w-3" />
                {statusConfig.label}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Wifi className="h-3 w-3" />
                {order.dataQuantity} {order.dataUnit}
              </span>
              <span className="flex items-center gap-1">
                <Signal className="h-3 w-3" />
                {order.validityDays} days
              </span>
              {order.countryName && (
                <span className="flex items-center gap-1">
                  <Smartphone className="h-3 w-3" />
                  {order.countryName}
                </span>
              )}
              <Badge variant="outline" className="text-[10px]">
                {order.packageType}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>Purchased: {formatDate(order.createdAt)}</span>
              {order.iccid && (
                <span className="font-mono">ICCID: {order.iccid}</span>
              )}
            </div>

            {/* Usage info */}
            {usage && (
              <div className="mt-2 rounded-md bg-muted/50 p-2 text-xs">
                <span className="font-medium">Data Usage: </span>
                {usage.rem_data_quantity === "Unlimited" ? (
                  <span>Unlimited</span>
                ) : (
                  <span>
                    {usage.rem_data_quantity} {usage.rem_data_unit} remaining of{" "}
                    {usage.initial_data_quantity} {usage.initial_data_unit}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right: Price & actions */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className="text-lg font-bold">
              {formatCurrency(order.priceCents)}
            </span>

            <div className="flex gap-2">
              {order.esimId && order.status === "active" && !usage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchUsage}
                  disabled={loadingUsage}
                >
                  {loadingUsage ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "Check Usage"
                  )}
                </Button>
              )}
              {order.activationLink && (
                <Button asChild variant="outline" size="sm">
                  <a
                    href={order.activationLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Install eSIM
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Main Component ----------

export function MyEsimsClient() {
  const [orders, setOrders] = useState<EsimOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/esim/my-esims", { credentials: "include" })
      .then((res) => res.json())
      .then((data: { status: boolean; data?: EsimOrder[] }) => {
        if (data.status && data.data) {
          setOrders(data.data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Smartphone className="h-7 w-7" />
          <h1 className="text-2xl font-semibold tracking-tight">My eSIMs</h1>
        </div>
        <Button asChild size="sm">
          <Link href="/esim">Buy eSIM</Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Loading your eSIMs...
          </span>
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wifi className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">
              You haven&apos;t purchased any eSIMs yet.
            </p>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/esim">Browse eSIM plans</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <EsimOrderCard key={order.id} order={order} />
          ))}
        </div>
      )}

      {/* Info section */}
      <Card className="mt-6">
        <CardHeader>
          <h2 className="text-sm font-semibold">eSIM Installation Guide</h2>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>iPhone:</strong> Go to Settings &gt; Cellular &gt; Add
            eSIM &gt; Use QR Code. Scan the QR code or tap the activation link.
          </p>
          <p>
            <strong>Android:</strong> Go to Settings &gt; Network &gt; SIMs
            &gt; Add eSIM. Scan the QR code provided.
          </p>
          <p>
            <strong>Note:</strong> Make sure your device is eSIM compatible
            and connected to Wi-Fi before installing.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
