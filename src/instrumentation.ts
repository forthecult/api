/**
 * Runs once when the Next.js server starts. Used to suppress noisy dependency warnings
 * that are harmless (e.g. bigint-buffer falling back to pure JS when native bindings
 * aren't available under Bun).
 */
export function register(): void {
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const msg = typeof args[0] === "string" ? args[0] : String(args[0]);
    if (msg.includes("bigint") && msg.includes("Failed to load bindings")) {
      return;
    }
    originalWarn.apply(console, args);
  };
}
