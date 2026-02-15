"use client";

import {
  Check,
  CheckCircle,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  Signal,
  Smartphone,
  Wifi,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge } from "~/ui/primitives/badge";
import { Button } from "~/ui/primitives/button";
import { Card, CardContent, CardHeader } from "~/ui/primitives/card";

// ---------- Types ----------

interface EsimOrder {
  activatedAt: null | string;
  activationLink: null | string;
  countryName: null | string;
  createdAt: string;
  dataQuantity: number;
  dataUnit: string;
  esimId: null | string;
  expiresAt: null | string;
  iccid: null | string;
  id: string;
  packageName: string;
  packageType: string;
  priceCents: number;
  status: string;
  validityDays: number;
}

interface UsageData {
  initial_data_quantity: number | string;
  initial_data_unit: string;
  rem_data_quantity: number | string;
  rem_data_unit: string;
}

// ---------- Helpers ----------

const STATUS_CONFIG: Record<
  string,
  {
    className: string;
    icon: typeof CheckCircle;
    label: string;
  }
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

export function MyEsimsClient() {
  const searchParams = useSearchParams();
  const justPurchased = searchParams.get("purchased");

  const [orders, setOrders] = useState<EsimOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBanner, setShowBanner] = useState(!!justPurchased);

  useEffect(() => {
    fetch("/api/esim/my-esims", { credentials: "include" })
      .then((res) => res.json())
      .then((data: { data?: EsimOrder[]; status: boolean }) => {
        if (data.status && data.data) {
          setOrders(data.data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Auto-dismiss banner after 10 seconds
  useEffect(() => {
    if (showBanner) {
      const timer = setTimeout(() => setShowBanner(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [showBanner]);

  return (
    <>
      {/* Post-purchase success banner */}
      {showBanner && (
        <div
          className={`
          mb-4 rounded-lg border border-green-200 bg-green-50 p-4
          dark:border-green-800 dark:bg-green-950/30
        `}
        >
          <div className="flex items-center gap-2">
            <CheckCircle
              className={`
              h-5 w-5 text-green-600
              dark:text-green-400
            `}
            />
            <div>
              <p
                className={`
                font-medium text-green-800
                dark:text-green-300
              `}
              >
                Payment successful!
              </p>
              <p
                className={`
                text-sm text-green-700
                dark:text-green-400
              `}
              >
                Your eSIM is being provisioned. It may take a few moments to
                become active. Refresh this page to check the latest status.
              </p>
            </div>
          </div>
        </div>
      )}

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
          <CardContent
            className={`
            flex flex-col items-center justify-center py-12
          `}
          >
            <Wifi className="mb-3 h-12 w-12 text-muted-foreground/50" />
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
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Each eSIM card above shows a <strong>QR code</strong> and an{" "}
            <strong>activation link</strong>. Use the QR code on this page (scan
            it with your phone) for the most reliable setup on both iPhone and
            Android.
          </p>
          <p>
            <strong>iPhone:</strong> Settings → Cellular → Add eSIM → Use QR
            Code, then scan the QR code in the card. Or tap &quot;Open
            activation link&quot; (may open in a new tab).
          </p>
          <p>
            <strong>Android:</strong> Settings → Network &amp; internet → SIMs →
            Add eSIM, then &quot;Scan QR code&quot; and scan the QR code in the
            card. If your phone has no QR option, copy the activation link and
            open it in Chrome on your phone.
          </p>
          <p>
            <strong>Note:</strong> Use Wi‑Fi and ensure your device is eSIM
            compatible before installing.
          </p>
        </CardContent>
      </Card>
    </>
  );
}

function EsimOrderCard({ order }: { order: EsimOrder }) {
  const [usage, setUsage] = useState<null | UsageData>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<null | string>(null);
  const [qrError, setQrError] = useState<null | string>(null);
  const [copied, setCopied] = useState(false);

  const statusConfig = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;

  // Generate QR code from activation link so Android and iPhone can scan it
  useEffect(() => {
    if (!order.activationLink?.trim()) {
      setQrDataUrl(null);
      setQrError(null);
      return;
    }
    let cancelled = false;
    setQrError(null);
    import("qrcode")
      .then((QRCodeModule) => {
        const QRCode = QRCodeModule.default;
        return QRCode.toDataURL(order.activationLink!.trim(), {
          errorCorrectionLevel: "M",
          margin: 2,
          width: 200,
        });
      })
      .then((dataUrl) => {
        if (!cancelled && dataUrl?.startsWith("data:")) {
          setQrDataUrl(dataUrl);
        } else if (!cancelled) {
          setQrError("QR code unavailable");
        }
      })
      .catch(() => {
        if (!cancelled) setQrError("QR code unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [order.activationLink]);

  const copyActivationLink = () => {
    if (!order.activationLink) return;
    navigator.clipboard.writeText(order.activationLink).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {},
    );
  };

  const fetchUsage = () => {
    if (!order.esimId || usage) return;
    setLoadingUsage(true);
    fetch(`/api/esim/my-esims/${order.id}/usage`)
      .then((res) => res.json())
      .then((data: { data?: UsageData; status: boolean }) => {
        if (data.status && data.data) {
          setUsage(data.data);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingUsage(false));
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div
          className={`
          flex flex-col gap-4
          sm:flex-row sm:items-start sm:justify-between
        `}
        >
          {/* Left: Package info */}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-start gap-2">
              <h3 className="text-sm leading-tight font-semibold">
                {order.packageName}
              </h3>
              <span
                className={`
                  inline-flex items-center gap-1 rounded-full px-2 py-0.5
                  text-xs font-medium
                  ${statusConfig.className}
                `}
              >
                <StatusIcon className="h-3 w-3" />
                {statusConfig.label}
              </span>
            </div>

            <div
              className={`
              flex flex-wrap items-center gap-3 text-xs text-muted-foreground
            `}
            >
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
              <Badge className="text-[10px]" variant="outline">
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
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className="text-lg font-bold">
              {formatCurrency(order.priceCents)}
            </span>

            <div className="flex flex-wrap justify-end gap-2">
              {order.esimId && order.status === "active" && !usage && (
                <Button
                  disabled={loadingUsage}
                  onClick={fetchUsage}
                  size="sm"
                  variant="outline"
                >
                  {loadingUsage ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "Check Usage"
                  )}
                </Button>
              )}
              {order.activationLink && (
                <>
                  <Button
                    onClick={copyActivationLink}
                    size="sm"
                    variant="outline"
                  >
                    {copied ? (
                      <Check className="ml-1 h-3 w-3" />
                    ) : (
                      <Copy className="ml-1 h-3 w-3" />
                    )}
                    {copied ? "Copied" : "Copy link"}
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a
                      href={order.activationLink}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Open activation link
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Activate: QR code + instructions (when we have an activation link) */}
        {order.activationLink && (order.status === "active" || order.status === "processing") && (
          <div
            className={`
            mt-5 border-t border-border pt-5
          `}
          >
            <h4 className="mb-3 text-sm font-semibold">Activate your eSIM</h4>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
              {qrDataUrl && (
                <div className="flex shrink-0 flex-col items-center gap-1">
                  <img
                    alt="eSIM activation QR code — scan with your phone"
                    className="rounded-lg border border-border bg-white p-2"
                    height={200}
                    src={qrDataUrl}
                    width={200}
                  />
                  <span className="text-xs text-muted-foreground">
                    Scan with your phone camera or eSIM installer
                  </span>
                </div>
              )}
              {qrError && (
                <p className="text-xs text-muted-foreground">
                  {qrError}. Use &quot;Copy link&quot; or &quot;Open activation link&quot; instead.
                </p>
              )}
              <div className="min-w-0 flex-1 space-y-2 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">iPhone:</strong> Open
                  Settings → Cellular → Add eSIM → Use QR Code, then scan the QR
                  code above. Or tap &quot;Open activation link&quot; (may open
                  in Apple&apos;s installer).
                </p>
                <p>
                  <strong className="text-foreground">Android:</strong> Open
                  Settings → Network &amp; internet → SIMs → Add eSIM (or
                  Settings → Connections → SIM manager → Add eSIM). Choose &quot;Scan
                  QR code&quot; and scan the QR code above. If your device has no
                  QR option, copy the activation link and open it in Chrome on
                  your phone.
                </p>
                <p className="text-xs">
                  Use Wi‑Fi when installing. Your device must support eSIM.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Sub-components ----------

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

// ---------- Main Component ----------

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
