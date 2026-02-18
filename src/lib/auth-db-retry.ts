/**
 * Shared retry helpers for wallet auth plugins (Solana, Ethereum).
 *
 * When a new user signs up via wallet, the flow is:
 *   1. INSERT user (via adapter – may use connection A from the pool)
 *   2. INSERT account (via internalAdapter – may use connection B)
 *   3. INSERT session (via internalAdapter – may use connection C)
 *
 * With connection pooling (postgres.js max:12, PgBouncer, Neon, etc.),
 * the user row committed on connection A may not be immediately visible
 * to connections B/C, causing foreign-key violations (error code 23503).
 *
 * These helpers retry the operation with exponential back-off so the
 * second connection has time to see the committed user row.
 */

const FK_RETRY_DELAYS_MS = [200, 400, 800] as const;

/** True if the error is a PostgreSQL foreign-key violation (23503). */
export function isFkConstraintError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;

  // Check top-level code
  const code = (err as { code?: string }).code;
  if (code === "23503") return true;

  // Check message / cause message
  const message =
    (err as Error).message ??
    (err as { cause?: Error }).cause?.message ??
    "";
  const messageStr = String(message);
  if (
    messageStr.includes("foreign key") ||
    messageStr.includes("_user_id_user_id_fk")
  ) {
    return true;
  }

  // Check nested cause code (Postgres errors often wrap)
  const cause =
    err && typeof err === "object" && "cause" in err
      ? (err as { cause: unknown }).cause
      : null;
  if (
    cause &&
    typeof cause === "object" &&
    "code" in cause &&
    (cause as { code?: string }).code === "23503"
  ) {
    return true;
  }

  return false;
}

/**
 * Execute `fn` and retry up to 3 times on FK constraint errors.
 * Useful for createAccount / createSession after a user INSERT
 * when connection pooling may delay row visibility.
 */
export async function withFkRetry<T>(
  fn: () => Promise<T>,
  label: string,
): Promise<T> {
  let lastErr: unknown;
  // First attempt (no delay)
  try {
    return await fn();
  } catch (err) {
    if (!isFkConstraintError(err)) throw err;
    lastErr = err;
    console.warn(
      `[${label}] FK violation on first attempt, will retry ${FK_RETRY_DELAYS_MS.length} times`,
    );
  }

  // Retries with increasing delays
  for (const delay of FK_RETRY_DELAYS_MS) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      return await fn();
    } catch (err) {
      if (!isFkConstraintError(err)) throw err;
      lastErr = err;
      console.warn(
        `[${label}] FK violation still after ${delay}ms delay, retrying…`,
      );
    }
  }

  // All retries exhausted — throw the last error
  console.error(
    `[${label}] FK violation persisted after all retries, giving up`,
  );
  throw lastErr;
}
