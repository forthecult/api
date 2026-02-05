"use client";

import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  // Start with false during SSR
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media =
      typeof window !== "undefined" ? window.matchMedia?.(query) : null;
    if (!media) return;

    setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}
