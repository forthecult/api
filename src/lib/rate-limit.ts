/**
 * Simple in-memory rate limiter for API routes.
 * For production with multiple instances, use Redis (e.g., @upstash/ratelimit).
 */

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      const now = Date.now();
      for (const [key, entry] of store.entries()) {
        if (entry.resetAt < now) {
          store.delete(key);
        }
      }
    },
    5 * 60 * 1000,
  );
}

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Time window in seconds */
  windowSeconds: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check rate limit for a given identifier (e.g., IP address, user ID).
 * Returns whether the request should be allowed.
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const key = identifier;

  let entry = store.get(key);

  // If no entry or window expired, create new entry
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 1,
      resetAt: now + windowMs,
    };
    store.set(key, entry);
    return {
      success: true,
      remaining: config.limit - 1,
      resetAt: entry.resetAt,
    };
  }

  // Increment count
  entry.count++;

  // Check if over limit
  if (entry.count > config.limit) {
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  return {
    success: true,
    remaining: config.limit - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Get client IP from request headers.
 * Works with Vercel, Cloudflare, and standard proxies.
 */
export function getClientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

/** Preset rate limit configs */
export const RATE_LIMITS = {
  /** Auth endpoints: 60 requests per minute per IP (get-session on each load + sign-in) */
  auth: { limit: 60, windowSeconds: 60 } as RateLimitConfig,
  /**
   * When client IP is missing (e.g. proxy not forwarding x-forwarded-for), all traffic shares one bucket.
   * Use a higher limit so we don't block every user. Prefer fixing proxy to send X-Forwarded-For in prod.
   */
  authUnknownIp: { limit: 300, windowSeconds: 60 } as RateLimitConfig,
  /** Checkout/order creation: 5 requests per minute */
  checkout: { limit: 5, windowSeconds: 60 } as RateLimitConfig,
  /** Admin endpoints: 60 requests per minute */
  admin: { limit: 60, windowSeconds: 60 } as RateLimitConfig,
  /** General API: 100 requests per minute */
  api: { limit: 100, windowSeconds: 60 } as RateLimitConfig,
  /** Contact form: 5 submissions per minute per IP (spam protection) */
  contact: { limit: 5, windowSeconds: 60 } as RateLimitConfig,
  /** Loqate address lookup: 30 requests per minute per IP (quota protection) */
  loqate: { limit: 30, windowSeconds: 60 } as RateLimitConfig,
} as const;

/**
 * Create a rate-limited response with proper headers.
 */
export function rateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: "Too many requests",
      retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(result.resetAt),
        "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
      },
    },
  );
}
