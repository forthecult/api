/**
 * Shared formatting helpers. Use these instead of duplicating Intl logic.
 */

/** e.g. "Feb 4, 2026" */
export function formatDateShort(date: Date | string | number): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(typeof date === "object" ? date : new Date(date));
}

/** e.g. "Feb 4, 2026" — same as short, alias for medium style */
export function formatDate(date: Date | string | number): string {
  return formatDateShort(date);
}

/** e.g. "February 4, 2026" */
export function formatDateLong(date: Date | string | number): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(typeof date === "object" ? date : new Date(date));
}

/** e.g. "Feb 4, 2026, 3:45 PM" */
export function formatDateTime(date: Date | string | number): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(typeof date === "object" ? date : new Date(date));
  } catch {
    return "—";
  }
}

/** Format cents as USD e.g. "$12.34" */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(cents / 100);
}

/** Format USD amount e.g. "$12.34" */
export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(amount);
}
