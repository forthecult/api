"use client";

import { useEffect, useState } from "react";

const DEFAULT_EXPIRY_MINUTES = 60;

/**
 * Countdown timer for payment expiry.
 *
 * Recalculates `timeLeft` every second based on `expiresAt`.
 * When no parseable `expiresAt` is supplied it falls back to a
 * simple decrement-by-one countdown starting at `expiryMinutes * 60`.
 */
export function usePaymentCountdown({
  expiresAt,
  expiryMinutes = DEFAULT_EXPIRY_MINUTES,
}: {
  expiresAt: null | string;
  expiryMinutes?: number;
}): {
  formattedTime: string;
  isExpired: boolean;
  timeLeft: number;
} {
  const [timeLeft, setTimeLeft] = useState(() =>
    getInitialTimeLeft(expiresAt, expiryMinutes),
  );

  // Re-sync when expiresAt changes (e.g. when order first loads)
  useEffect(() => {
    setTimeLeft(getInitialTimeLeft(expiresAt, expiryMinutes));
  }, [expiresAt, expiryMinutes]);

  // Tick every second
  useEffect(() => {
    const interval = setInterval(() => {
      if (expiresAt) {
        const ts = expiresAt.includes("T")
          ? Date.parse(expiresAt)
          : Number(expiresAt);
        if (Number.isFinite(ts)) {
          const remaining = Math.max(0, Math.floor((ts - Date.now()) / 1000));
          setTimeLeft(remaining);
          return;
        }
      }
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return { formattedTime, isExpired: timeLeft === 0, timeLeft };
}

function getInitialTimeLeft(
  expiresAt: null | string,
  expiryMinutes: number,
): number {
  if (!expiresAt) return expiryMinutes * 60;
  const ts = expiresAt.includes("T")
    ? Date.parse(expiresAt)
    : Number(expiresAt);
  if (!Number.isFinite(ts)) return expiryMinutes * 60;
  return Math.max(0, Math.floor((ts - Date.now()) / 1000));
}
