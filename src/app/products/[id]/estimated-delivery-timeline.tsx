"use client";

import { format } from "date-fns";
import { Package, ShoppingBag, Truck } from "lucide-react";
import * as React from "react";

import { cn } from "~/lib/cn";
import { getEstimatedDeliveryRanges } from "~/lib/estimated-delivery-dates";

const DEFAULT_HANDLING_MIN = 2;
const DEFAULT_HANDLING_MAX = 5;
const DEFAULT_TRANSIT_MIN = 3;
const DEFAULT_TRANSIT_MAX = 7;

export interface EstimatedDeliveryTimelineProps {
  className?: string;
  handlingDaysMax?: null | number;
  /** Fulfillment (handling) days min/max from fulfillment provider or manual. */
  handlingDaysMin?: null | number;
  transitDaysMax?: null | number;
  /** Transit (shipping) days min/max. Defaults used when null. */
  transitDaysMin?: null | number;
}

/**
 * Renders an estimated delivery timeline: "⚡ Order within Xh Ym to get it by {date}",
 * then Ordered (Today) → Shipped (date range) → Delivered (date range).
 * Uses business days; defaults for handling/transit when not provided.
 */
export function EstimatedDeliveryTimeline({
  className,
  handlingDaysMax,
  handlingDaysMin,
  transitDaysMax,
  transitDaysMin,
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
        handlingDaysMax: Math.max(handlingMin, handlingMax),
        handlingDaysMin: Math.max(0, handlingMin),
        transitDaysMax: Math.max(transitMin, transitMax),
        transitDaysMin: Math.max(0, transitMin),
      }),
    [handlingMin, handlingMax, transitMin, transitMax],
  );

  const [countdown, setCountdown] = React.useState<null | {
    hours: number;
    minutes: number;
  }>(null);

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
    <div className={cn("space-y-5", className)}>
      {countdown != null && (countdown.hours > 0 || countdown.minutes > 0) && (
        <p className="text-lg text-muted-foreground">
          ⚡ Order within{" "}
          <span
            className={`
            font-semibold text-green-600
            dark:text-green-400
          `}
          >
            {countdown.hours}h {countdown.minutes}m
          </span>{" "}
          to get it by {getItByDate}
        </p>
      )}

      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns:
            "1fr minmax(1.5rem, 2fr) 1fr minmax(1.5rem, 2fr) 1fr",
        }}
      >
        {/* Ordered */}
        <div className="flex flex-col items-center gap-2">
          <div
            aria-hidden
            className={`
              flex h-11 w-11 shrink-0 items-center justify-center rounded-full
              border-2 border-border bg-muted/50
            `}
          >
            <ShoppingBag className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-center text-base">
            <p className="font-semibold text-foreground">Ordered</p>
            <p className="text-muted-foreground">{formatted.ordered}</p>
          </div>
        </div>
        {/* Line 1 */}
        <div
          aria-hidden
          className="self-center border-b-2 border-dashed border-border"
        />
        {/* Shipped */}
        <div className="flex flex-col items-center gap-2">
          <div
            aria-hidden
            className={`
              flex h-11 w-11 shrink-0 items-center justify-center rounded-full
              border-2 border-border bg-muted/50
            `}
          >
            <Truck className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-center text-base">
            <p className="font-semibold text-foreground">Shipped</p>
            <p className="text-muted-foreground">{formatted.shippedRange}</p>
          </div>
        </div>
        {/* Line 2 */}
        <div
          aria-hidden
          className="self-center border-b-2 border-dashed border-border"
        />
        {/* Delivered */}
        <div className="flex flex-col items-center gap-2">
          <div
            aria-hidden
            className={`
              flex h-11 w-11 shrink-0 items-center justify-center rounded-full
              border-2 border-border bg-muted/50
            `}
          >
            <Package className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-center text-base">
            <p className="font-semibold text-foreground">Delivered</p>
            <p className="text-muted-foreground">{formatted.deliveredRange}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
