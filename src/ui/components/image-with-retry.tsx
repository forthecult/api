"use client";

import Image, { type ImageProps } from "next/image";
import * as React from "react";

const RETRY_DELAY_MS = 2000;

/**
 * Wraps next/image and retries once on load error.
 * Handles transient failures like ERR_NETWORK_CHANGED in incognito or flaky connections.
 */
export function ImageWithRetry(props: ImageProps) {
  const [retryKey, setRetryKey] = React.useState(0);
  const [errored, setErrored] = React.useState(false);

  const handleError = React.useCallback(() => {
    if (errored) return; // already retried
    setErrored(true);
  }, [errored]);

  React.useEffect(() => {
    if (!errored) return;
    const t = setTimeout(() => setRetryKey((k) => k + 1), RETRY_DELAY_MS);
    return () => clearTimeout(t);
  }, [errored]);

  React.useEffect(() => {
    if (retryKey > 0) setErrored(false);
  }, [retryKey]);

  return <Image {...props} key={retryKey} onError={handleError} />;
}
