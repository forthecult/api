"use client";

import * as React from "react";

type ShippingCountryState = {
  /** ISO 3166-1 alpha-2 from geo (or null if unknown). */
  shippingCountry: string | null;
  isLoading: boolean;
};

const CACHE_KEY = "shipping-country-cache";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getCached(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { country, at } = JSON.parse(raw) as {
      country: string | null;
      at: number;
    };
    if (at && Date.now() - at < CACHE_TTL_MS && country) return country;
    return null;
  } catch {
    return null;
  }
}

function setCached(country: string | null) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ country, at: Date.now() }),
    );
  } catch {
    // ignore
  }
}

/**
 * Returns the current request's country from geo (for shipping availability).
 * Cached in session for the same tab. When loading or unknown, shippingCountry is null
 * (callers should not block add-to-cart on null unless they want to require geo).
 */
export function useShippingCountry(): ShippingCountryState {
  // Always start with null to match the server render and avoid hydration mismatch.
  // sessionStorage is read in the useEffect below (client-only).
  const [state, setState] = React.useState<ShippingCountryState>({
    shippingCountry: null,
    isLoading: true,
  });

  React.useEffect(() => {
    const cached = getCached();
    if (cached) {
      setState({ shippingCountry: cached, isLoading: false });
      return;
    }
    let cancelled = false;
    fetch("/api/geo", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { country: null }))
      .then((data: { country?: string | null }) => {
        const country =
          typeof data?.country === "string" && data.country.length === 2
            ? data.country.toUpperCase()
            : null;
        if (!cancelled) {
          setCached(country);
          setState({ shippingCountry: country, isLoading: false });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ shippingCountry: null, isLoading: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
