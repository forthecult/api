"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { LoqateFindItem, MappedShippingAddress } from "~/lib/loqate";
import { mapRetrieveToShipping } from "~/lib/loqate";

const LOQATE_FIND_TIMEOUT_MS = 10_000;
const LOQATE_DEBOUNCE_MS = 200;

interface UseLoqateAutocompleteOptions {
  /** Current street/address text to search */
  text: string;
  /** ISO country code to bias results */
  country?: string;
  /** Whether autocomplete is active (e.g. form is visible) */
  enabled?: boolean;
  /** Called when a full address is retrieved from Loqate */
  onSelect?: (address: MappedShippingAddress) => void;
}

interface UseLoqateAutocompleteReturn {
  suggestions: LoqateFindItem[];
  loading: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Call when user selects a suggestion by its Loqate Id */
  selectAddress: (id: string) => void;
  /** Reset suggestions and close dropdown */
  reset: () => void;
  /** Ref to track if address input is focused (controls auto-open) */
  inputFocusedRef: React.RefObject<boolean>;
  /** Ref for the container div (useful for click-outside detection) */
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function useLoqateAutocomplete({
  text,
  country,
  enabled = true,
  onSelect,
}: UseLoqateAutocompleteOptions): UseLoqateAutocompleteReturn {
  const [suggestions, setSuggestions] = useState<LoqateFindItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextFindRef = useRef(false);
  const inputFocusedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Debounced find when text or country change
  useEffect(() => {
    if (!enabled) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const trimmed = text?.trim() ?? "";
    if (trimmed.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      if (skipNextFindRef.current) {
        skipNextFindRef.current = false;
        return;
      }
      setLoading(true);
      if (inputFocusedRef.current) setOpen(true);
      const params = new URLSearchParams({ text: trimmed, limit: "6" });
      if (country?.trim()) params.set("countries", country.trim());
      const ac = new AbortController();
      const timeoutId = setTimeout(() => ac.abort(), LOQATE_FIND_TIMEOUT_MS);
      fetch(`/api/loqate/find?${params.toString()}`, { signal: ac.signal })
        .then((res) => (res.ok ? res.json() : { Items: [] }))
        .then((data: { Items?: LoqateFindItem[] }) => {
          setSuggestions(data.Items ?? []);
          // Only open dropdown if input is focused (prevents auto-open on page load with pre-filled data)
          if (inputFocusedRef.current && (data.Items?.length ?? 0) > 0) {
            setOpen(true);
          }
        })
        .catch(() => setSuggestions([]))
        .finally(() => {
          clearTimeout(timeoutId);
          setLoading(false);
        });
    }, LOQATE_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [enabled, text, country]);

  const selectAddress = useCallback(
    (id: string) => {
      setLoading(true);
      fetch(`/api/loqate/retrieve?id=${encodeURIComponent(id)}`)
        .then((res) => {
          if (!res.ok) throw new Error("Retrieve failed");
          return res.json();
        })
        .then((addr) => {
          const mapped = mapRetrieveToShipping(addr);
          onSelect?.(mapped);
          skipNextFindRef.current = true;
          setOpen(false);
          setSuggestions([]);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    [onSelect],
  );

  const reset = useCallback(() => {
    setSuggestions([]);
    setOpen(false);
  }, []);

  return {
    suggestions,
    loading,
    open,
    setOpen,
    selectAddress,
    reset,
    inputFocusedRef,
    containerRef,
  };
}
