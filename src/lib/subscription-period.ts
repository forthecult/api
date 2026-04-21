/** Compute the end of a billing period from `from` (week / month / year × count). */
export function addBillingPeriod(
  from: Date,
  unit: string,
  count: number,
): Date {
  const d = new Date(from.getTime());
  const u = unit.toLowerCase();
  if (u === "week") {
    d.setUTCDate(d.getUTCDate() + 7 * count);
    return d;
  }
  if (u === "month") {
    d.setUTCMonth(d.getUTCMonth() + count);
    return d;
  }
  if (u === "year") {
    d.setUTCFullYear(d.getUTCFullYear() + count);
    return d;
  }
  d.setUTCDate(d.getUTCDate() + 7 * count);
  return d;
}
