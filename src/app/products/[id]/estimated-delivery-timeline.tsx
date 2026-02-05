"use client";

import { format } from "date-fns";
import { Package, ShoppingBag, Truck } from "lucide-react";
import * as React from "react";

import { getEstimatedDeliveryRanges } from "~/lib/estimated-delivery-dates";
import { cn } from "~/lib/cn";

const DEFAULT_HANDLING_MIN = 2;
const DEFAULT_HANDLING_MAX = 5;
const DEFAULT_TRANSIT_MIN = 3;
const DEFAULT_TRANSIT_MAX = 7;

export interface EstimatedDeliveryTimelineProps {
  /** Fulfillment (handling) days min/max from Printify, Printful, or manual. */
  handlingDaysMin?: number | null;
  handlingDaysMax?: number | null;
  /** Transit (shipping) days min/max. Defaults used when null. */
  transitDaysMin?: number | null;
  transitDaysMax?: number | null;
  className?: string;
}

/**
 * Renders an estimated delivery timeline: "⚡ Order within Xh Ym to get it by {date}",
 * then Ordered (Today) → Shipped (date range) → Delivered (date range).
 * Uses business days; defaults for handling/transit when not provided.
 */
export function EstimatedDeliveryTimeline({
  handlingDaysMin,
  handlingDaysMax,
  transitDaysMin,
  transitDaysMax,
  className,
}: EstimatedDeliveryTimelineProps) {
  const handlingMin =
    handlingDaysMin ?? handlingDaysMax ?? DEFAULT_HANDLING_MIN;
  const handlingMax =
    handlingDaysMax ?? handlingDaysMin ?? DEFAULT_HANDLING_MAX;
  const transitMin = transitDaysMin ?? transitDaysMax ?? DEFAULT_TRANSIT_MIN;
  const transitMax = transitDaysMax ?? transitDaysMin ?? DEFAULT_TRANSIT_MAX;

  const ranges = React.useMemo(
    () =>
      getEstimatedDeliveryRanges({
        handlingDaysMin: Math.max(0, handlingMin),
        handlingDaysMax: Math.max(handlingMin, handlingMax),
        transitDaysMin: Math.max(0, transitMin),
        transitDaysMax: Math.max(transitMin, transitMax),
      }),
    [handlingMin, handlingMax, transitMin, transitMax],
  );

  const [countdown, setCountdown] = React.useState<{
    hours: number;
    minutes: number;
  } | null>(null);

  React.useEffect(() => {
    const getTimeUntilEndOfDay = () => {
      const now = new Date();
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      const ms = end.getTime() - now.getTime();
      if (ms <= 0) return { hours: 0, minutes: 0 };
      const hours = Math.floor(ms / (1000 * 60 * 60));
      const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
      return { hours, minutes };
    };

    setCountdown(getTimeUntilEndOfDay());
    const interval = setInterval(() => {
      setCountdown(getTimeUntilEndOfDay());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const { formatted } = ranges;
  const getItByDate = format(ranges.deliveredStart, "MMM d");

  return (
    <div className={cn("space-y-4", className)}>
      {countdown != null && (countdown.hours > 0 || countdown.minutes > 0) && (
        <p className="text-sm text-muted-foreground">
          ⚡ Order within{" "}
          <span className="font-semibold text-green-600 dark:text-green-400">
            {countdown.hours}h {countdown.minutes}m
          </span>{" "}
          to get it by {getItByDate}
        </p>
      )}

      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: "1fr minmax(1.5rem, 2fr) 1fr minmax(1.5rem, 2fr) 1fr",
        }}
      >
        {/* Ordered */}
        <div className="flex flex-col items-center gap-2">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-border bg-muted/50"
            aria-hidden
          >
            <ShoppingBag className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-center text-sm">
            <p className="font-semibold text-foreground">Ordered</p>
            <p className="text-muted-foreground">{formatted.ordered}</p>
          </div>
        </div>
        {/* Line 1 */}
        <div
          className="self-center border-b-2 border-dashed border-border"
          aria-hidden
        />
        {/* Shipped */}
        <div className="flex flex-col items-center gap-2">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-border bg-muted/50"
            aria-hidden
          >
            <Truck className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-center text-sm">
            <p className="font-semibold text-foreground">Shipped</p>
            <p className="text-muted-foreground">{formatted.shippedRange}</p>
          </div>
        </div>
        {/* Line 2 */}
        <div
          className="self-center border-b-2 border-dashed border-border"
          aria-hidden
        />
        {/* Delivered */}
        <div className="flex flex-col items-center gap-2">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-border bg-muted/50"
            aria-hidden
          >
            <Package className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-center text-sm">
            <p className="font-semibold text-foreground">Delivered</p>
            <p className="text-muted-foreground">{formatted.deliveredRange}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
