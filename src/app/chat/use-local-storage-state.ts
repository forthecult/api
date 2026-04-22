"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

/**
 * React 19-compatible `localStorage` binding.
 *
 * Uses `useSyncExternalStore` so:
 * - Initial render reads from storage (no hydration flash, no set-state-in-effect).
 * - Cross-tab updates (the native `storage` event) propagate automatically.
 * - Same-tab updates broadcast via a synthetic event so every subscriber resyncs.
 *
 * The generic `T` is stored as JSON. `parse` must return `null` on malformed data.
 */
export function useLocalStorageState<T>(
  key: string,
  parse: (raw: null | string) => T,
): [T, (next: ((prev: T) => T) | T) => void] {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const handler = (e: Event) => {
        if (e instanceof StorageEvent && e.key != null && e.key !== key) return;
        onChange();
      };
      window.addEventListener("storage", handler);
      window.addEventListener(SYNTHETIC_EVENT, handler);
      return () => {
        window.removeEventListener("storage", handler);
        window.removeEventListener(SYNTHETIC_EVENT, handler);
      };
    },
    [key],
  );

  const getSnapshot = useCallback(() => readSnapshot(key, parse), [key, parse]);
  const getServerSnapshot = useCallback(() => parse(null), [parse]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const latestRef = useRef(value);
  useEffect(() => {
    latestRef.current = value;
  }, [value]);

  const set = useCallback(
    (next: ((prev: T) => T) | T) => {
      const resolved =
        typeof next === "function"
          ? (next as (prev: T) => T)(latestRef.current)
          : next;
      try {
        localStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        /* ignore quota / disabled storage */
      }
      latestRef.current = resolved;
      window.dispatchEvent(
        new CustomEvent(SYNTHETIC_EVENT, { detail: { key } }),
      );
    },
    [key],
  );

  return [value, set];
}

const SYNTHETIC_EVENT = "ftc-ai-localstorage";

/**
 * Cache snapshot results so `useSyncExternalStore` returns a stable reference
 * for unchanged keys. Without this, every render allocates a fresh parsed
 * object and triggers infinite re-renders in React 19.
 */
const snapshotCache = new Map<string, { raw: null | string; value: unknown }>();

function readRaw(key: string): null | string {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readSnapshot<T>(key: string, parse: (raw: null | string) => T): T {
  const raw = typeof window === "undefined" ? null : readRaw(key);
  const cached = snapshotCache.get(key);
  if (cached && cached.raw === raw) return cached.value as T;
  const value = parse(raw);
  snapshotCache.set(key, { raw, value });
  return value;
}
