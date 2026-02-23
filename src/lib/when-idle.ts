/**
 * Run a callback when the main thread is idle (or after timeout).
 * Use for non-critical init so long tasks don't block TBT.
 */
export function whenIdle(cb: () => void, timeoutMs: number): () => void {
  if (typeof requestIdleCallback !== "undefined") {
    const id = requestIdleCallback(cb, { timeout: timeoutMs });
    return () => cancelIdleCallback(id);
  }
  const t = setTimeout(cb, Math.min(timeoutMs, 100));
  return () => clearTimeout(t);
}
