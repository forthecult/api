"use client";

import { useEffect } from "react";

const TEMP_KEY = "culture-ai-temperature";
const TOP_P_KEY = "culture-ai-top-p";
const WEB_KEY = "culture-ai-web-enabled";
const URL_SCRAPE_KEY = "culture-ai-url-scraping";

/**
 * Sync AI UI prefs across tabs/windows via the StorageEvent API (same origin).
 */
export function useAiLocalStorageSync(options: {
  setTemperature: (v: number) => void;
  setTopP: (v: number) => void;
  setUrlScrapingEnabled: (v: boolean) => void;
  setWebEnabled: (v: boolean) => void;
}): void {
  const { setTemperature, setTopP, setUrlScrapingEnabled, setWebEnabled } =
    options;

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.newValue == null) return;
      if (e.key === TEMP_KEY) {
        const n = Number.parseFloat(e.newValue);
        if (Number.isFinite(n) && n >= 0 && n <= 2) setTemperature(n);
        return;
      }
      if (e.key === TOP_P_KEY) {
        const n = Number.parseFloat(e.newValue);
        if (Number.isFinite(n) && n > 0 && n <= 1) setTopP(n);
        return;
      }
      if (e.key === WEB_KEY) {
        setWebEnabled(e.newValue === "1");
        return;
      }
      if (e.key === URL_SCRAPE_KEY) {
        setUrlScrapingEnabled(e.newValue === "1");
        return;
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [setTemperature, setTopP, setWebEnabled, setUrlScrapingEnabled]);
}
