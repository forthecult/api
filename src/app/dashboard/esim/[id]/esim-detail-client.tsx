"use client";

import {
  ArrowLeft,
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
import { useCallback, useEffect, useState } from "react";

import { Badge } from "~/ui/primitives/badge";
import { Button } from "~/ui/primitives/button";
import { Card, CardContent } from "~/ui/primitives/card";

const STATUS_CONFIG: Record<
  string,
  { className: string; icon: typeof CheckCircle; label: string }
> = {
  active: {
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    icon: CheckCircle,
    label: "Active",
  },
  expired: {
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    icon: XCircle,
    label: "Expired",
  },
  failed: {
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    icon: XCircle,
    label: "Failed",
  },
  pending: {
    className: "bg-muted text-muted-foreground",
    icon: Clock,
    label: "Pending",
  },
  processing: {
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    icon: Clock,
    label: "Processing",
  },
};

interface LiveDetail {
  sim?: { iccid: string; id: string; status: string; total_bundles: number };
  universal_link?: string;
}

interface OrderRow {
  activationLink: null | string;
  countryName: null | string;
  createdAt: string;
  dataQuantity: number;
  dataUnit: string;
  esimId: null | string;
  iccid: null | string;
  id: string;
  orderId: null | string;
  packageName: string;
  packageType: string;
  priceCents: number;
  status: string;
  validityDays: number;
}

export function EsimDetailClient({ esimOrderId }: { esimOrderId: string }) {
  const [order, setOrder] = useState<null | OrderRow>(null);
  const [liveDetail, setLiveDetail] = useState<LiveDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [checking, setChecking] = useState(false);

  const fetchDetail = useCallback(() => {
    setLoading(true);
    setNotFound(false);
    fetch(`/api/esim/my-esims/${esimOrderId}`, { credentials: "include" })
      .then((res) => {
        if (res.status === 404) {
          setNotFound(true);
          return null;
        }
        return res.json();
      })
      .then((raw: unknown) => {
        const data = raw as null | {
          data?: { liveDetail: LiveDetail | null; order: OrderRow };
          status: boolean;
        };
        if (data?.status && data.data) {
          setOrder(data.data.order);
          setLiveDetail(data.data.liveDetail ?? null);
        } else if (data !== null) {
          setOrder(null);
        }
      })
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [esimOrderId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const checkStatus = useCallback(() => {
    if (!order?.orderId) return;
    setChecking(true);
    fetch(`/api/esim/orders/${order.orderId}/retry-provisioning`, {
      credentials: "include",
      method: "POST",
    })
      .then(() => fetchDetail())
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [order?.orderId, fetchDetail]);

  if (loading && !order) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          Loading eSIM details…
        </span>
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="flex flex-col gap-4">
        <Button asChild size="sm" variant="ghost">
          <Link href="/dashboard/esim">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to My eSIMs
          </Link>
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {notFound ? "eSIM order not found." : "Failed to load details."}
            </p>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/dashboard/esim">Back to My eSIMs</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;
  const canCheckStatus =
    order.status === "processing" && !order.esimId && order.orderId;
  const activationLink =
    order.activationLink ?? liveDetail?.universal_link ?? null;

  return (
    <div className="flex flex-col gap-6">
      <Button asChild size="sm" variant="ghost">
        <Link href="/dashboard/esim">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to My eSIMs
        </Link>
      </Button>

      <Card>
        <CardContent className="p-6">
          <div
            className={`
              flex flex-col gap-6
              sm:flex-row sm:items-start sm:justify-between
            `}
          >
            <div className="min-w-0 flex-1 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold">{order.packageName}</h1>
                <span
                  className={`
                    inline-flex items-center gap-1 rounded-full px-2.5 py-0.5
                    text-xs font-medium
                    ${statusConfig.className}
                  `}
                >
                  <StatusIcon className="h-3.5 w-3.5" />
                  {statusConfig.label}
                </span>
              </div>
              <div
                className={`
                  flex flex-wrap items-center gap-4 text-sm
                  text-muted-foreground
                `}
              >
                <span className="flex items-center gap-1">
                  <Wifi className="h-4 w-4" />
                  {order.dataQuantity} {order.dataUnit}
                </span>
                <span className="flex items-center gap-1">
                  <Signal className="h-4 w-4" />
                  {order.validityDays} days
                </span>
                {order.countryName && (
                  <span className="flex items-center gap-1">
                    <Smartphone className="h-4 w-4" />
                    {order.countryName}
                  </span>
                )}
                <Badge variant="outline">{order.packageType}</Badge>
              </div>
              <div
                className={`flex flex-wrap gap-4 text-sm text-muted-foreground`}
              >
                <span>Purchased: {formatDate(order.createdAt)}</span>
                {(order.iccid ?? liveDetail?.sim?.iccid) && (
                  <span className="font-mono">
                    ICCID: {order.iccid ?? liveDetail?.sim?.iccid}
                  </span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-3">
              <span className="text-2xl font-bold">
                {formatCurrency(order.priceCents)}
              </span>
              {canCheckStatus && (
                <Button
                  disabled={checking}
                  onClick={checkStatus}
                  variant="default"
                >
                  {checking ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Checking…
                    </>
                  ) : (
                    "Check status"
                  )}
                </Button>
              )}
            </div>
          </div>

          {order.status === "processing" && !order.esimId && (
            <p className="mt-4 text-sm text-muted-foreground">
              Your eSIM is being set up. This can take a few minutes. Use
              &quot;Check status&quot; to refresh — we&apos;ll link your eSIM
              when it&apos;s ready.
            </p>
          )}

          {activationLink && (
            <div className="mt-6 border-t border-border pt-6">
              <h2 className="mb-3 text-sm font-semibold">Activate your eSIM</h2>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="sm">
                  <a
                    href={activationLink}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Install on this device
                    <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a
                    href={activationLink}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Open activation link
                  </a>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
