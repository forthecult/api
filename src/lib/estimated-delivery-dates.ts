/**
 * Helpers for estimated delivery timeline (business days).
 * Used by EstimatedDeliveryTimeline on product pages.
 */

import { addBusinessDays, format } from "date-fns";

/**
 * Add business days to a date (weekends excluded).
 */
export function addBusinessDaysToDate(date: Date, days: number): Date {
  return addBusinessDays(date, days);
}

/**
 * Format a date for display in the timeline (e.g. "February 7").
 */
export function formatDeliveryDate(date: Date): string {
  return format(date, "MMMM d");
}

/**
 * Compute ordered/shipped/delivered date ranges from today using handling and transit days.
 * All days are business days.
 */
export function getEstimatedDeliveryRanges(options: {
  fromDate?: Date;
  handlingDaysMax: number;
  handlingDaysMin: number;
  transitDaysMax: number;
  transitDaysMin: number;
}) {
  const {
    fromDate = new Date(),
    handlingDaysMax,
    handlingDaysMin,
    transitDaysMax,
    transitDaysMin,
  } = options;

  const orderedStart = fromDate;
  const shippedStart = addBusinessDays(fromDate, handlingDaysMin);
  const shippedEnd = addBusinessDays(fromDate, handlingDaysMax);
  const deliveredStart = addBusinessDays(
    fromDate,
    handlingDaysMin + transitDaysMin,
  );
  const deliveredEnd = addBusinessDays(
    fromDate,
    handlingDaysMax + transitDaysMax,
  );

  return {
    deliveredEnd,
    deliveredStart,
    formatted: {
      deliveredRange:
        deliveredStart.getTime() === deliveredEnd.getTime()
          ? formatDeliveryDate(deliveredStart)
          : `${formatDeliveryDate(deliveredStart)} - ${formatDeliveryDate(deliveredEnd)}`,
      ordered: formatDeliveryDate(orderedStart),
      shippedRange:
        shippedStart.getTime() === shippedEnd.getTime()
          ? formatDeliveryDate(shippedStart)
          : `${formatDeliveryDate(shippedStart)} - ${formatDeliveryDate(shippedEnd)}`,
    },
    orderedDate: orderedStart,
    shippedEnd,
    shippedStart,
  };
}
