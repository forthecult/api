/**
 * Rate limiter for API routes.
 * Uses in-memory store by default. When UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN are set (e.g. in production), uses Upstash Redis
 * for consistent limits across instances.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

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
  remaining: number;
  resetAt: number;
  success: boolean;
}

/** In-memory check (sync). */
function checkRateLimitMemory(
  identifier: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const key = identifier;

  let entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    entry = {
      count: 1,
      resetAt: now + windowMs,
    };
    store.set(key, entry);
    return {
      remaining: config.limit - 1,
      resetAt: entry.resetAt,
      success: true,
    };
  }

  entry.count++;

  if (entry.count > config.limit) {
    return {
      remaining: 0,
      resetAt: entry.resetAt,
      success: false,
    };
  }

  return {
    remaining: config.limit - entry.count,
    resetAt: entry.resetAt,
    success: true,
  };
}

/** Cache Upstash limiters by config key to avoid creating one per request. */
const redisLimiterCache = new Map<
  string,
  Awaited<ReturnType<typeof createRedisLimiter>>
>();

/**
 * m8: fail boot in production if upstash isn't configured — without it
 * rate-limits are per-instance and therefore per-deploy-lottery-bypass.
 */
export function assertRateLimitStoreConfigured(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (isRedisConfigured()) return;
  throw new Error(
    "Rate limiting requires UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN in production. In-memory is per-instance and effectively bypassable.",
  );
}

/**
 * Check rate limit for a given identifier (e.g. IP address, user ID).
 * Uses Redis when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set;
 * otherwise uses in-memory store (per-instance). In production the absence of
 * redis is a hard boot-time error (see assertRateLimitStoreConfigured).
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  if (isRedisConfigured()) {
    return checkRateLimitRedis(identifier, config);
  }
  return Promise.resolve(checkRateLimitMemory(identifier, config));
}

/** Redis-backed check when Upstash env is set. */
async function checkRateLimitRedis(
  identifier: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const cacheKey = `${config.limit}:${config.windowSeconds}`;
  let limiter = redisLimiterCache.get(cacheKey);
  if (!limiter) {
    limiter = await createRedisLimiter(config);
    redisLimiterCache.set(cacheKey, limiter);
  }

  const res = await limiter.limit(identifier);
  return {
    remaining: res.remaining,
    resetAt: res.reset,
    success: res.success,
  };
}

async function createRedisLimiter(config: RateLimitConfig) {
  const { Ratelimit } = await import("@upstash/ratelimit");
  const { Redis } = await import("@upstash/redis");
  const redis = Redis.fromEnv();
  return new Ratelimit({
    limiter: Ratelimit.fixedWindow(config.limit, `${config.windowSeconds} s`),
    prefix: "rl",
    redis,
  });
}

function isRedisConfigured(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return Boolean(url && token);
}

/**
 * m7: when running behind a CDN/proxy, the client ip only lives in the header
 * the proxy writes (e.g. `cf-connecting-ip` behind Cloudflare). Any of those
 * headers sent by an arbitrary client can be forged unless we're actually
 * behind that proxy, so we don't trust them unless the operator has opted in.
 *
 * Set TRUSTED_PROXY_HEADER to the one header that the edge writes (one of
 * `cf-connecting-ip`, `x-real-ip`, `x-forwarded-for`, `true-client-ip`). In
 * production this env is REQUIRED; without it we fall back to a single global
 * bucket instead of bucketing by a spoofable header.
 */
const TRUSTED_PROXY_HEADERS = new Set([
  "cf-connecting-ip",
  "fly-client-ip",
  "true-client-ip",
  "x-forwarded-for",
  "x-real-ip",
  "x-vercel-forwarded-for",
]);

function getTrustedProxyHeader(): null | string {
  const raw = process.env.TRUSTED_PROXY_HEADER?.trim().toLowerCase();
  if (!raw) return null;
  if (!TRUSTED_PROXY_HEADERS.has(raw)) {
    console.warn(
      `[rate-limit] TRUSTED_PROXY_HEADER="${raw}" is not a recognized header; ignoring.`,
    );
    return null;
  }
  return raw;
}

let _missingProxyHeaderWarned = false;

/**
 * Get client IP from request headers. Only reads headers the operator has
 * explicitly opted in via TRUSTED_PROXY_HEADER; other IP-ish headers are
 * ignored because any user-agent can set them.
 *
 * When no trusted header is configured we return a single sentinel
 * (`proxyless`) so a forged `x-forwarded-for` can't bucket-jump rate limits.
 */
export function getClientIp(headers: Headers): string {
  const trusted = getTrustedProxyHeader();
  if (!trusted) {
    if (process.env.NODE_ENV === "production" && !_missingProxyHeaderWarned) {
      _missingProxyHeaderWarned = true;
      console.warn(
        "⚠️  [SECURITY] TRUSTED_PROXY_HEADER is unset — rate limits are not per-client-ip. Set it to the header your edge writes (e.g. 'cf-connecting-ip').",
      );
    }
    return "proxyless";
  }
  const raw = headers.get(trusted);
  if (!raw) return "proxyless";
  // x-forwarded-for is comma-separated; the leftmost entry is the original
  // client when the proxy appends its own hop. all other trusted headers are
  // single-valued, so splitting+trim is safe too.
  const first = raw.split(",")[0]?.trim();
  return first && first.length > 0 ? first : "proxyless";
}

/** Preset rate limit configs. Kept generous to avoid blocking normal use. */
export const RATE_LIMITS = {
  /** Admin API: 200/min per IP so dashboards and scripts are not blocked */
  admin: { limit: 200, windowSeconds: 60 } as RateLimitConfig,
  /** General API: 100 requests per minute (agent capabilities, me, orders, preferences) */
  api: { limit: 100, windowSeconds: 60 } as RateLimitConfig,
  /** Auth endpoints: 180/min per IP so multiple admin tabs (session checks) don't hit 429 */
  auth: { limit: 180, windowSeconds: 60 } as RateLimitConfig,
  /**
   * When client IP is missing (e.g. proxy not forwarding x-forwarded-for), all traffic shares one bucket.
   */
  authUnknownIp: { limit: 300, windowSeconds: 60 } as RateLimitConfig,
  /** Checkout: create-order + confirm per payment method. Generous so normal use (retries, back button, one extra tab) doesn’t 429. */
  checkout: { limit: 20, windowSeconds: 60 } as RateLimitConfig,
  /** Contact form: 5 submissions per minute per IP (spam protection) */
  contact: { limit: 5, windowSeconds: 60 } as RateLimitConfig,
  /** Loqate address lookup: 30 requests per minute per IP (quota protection) */
  loqate: { limit: 30, windowSeconds: 60 } as RateLimitConfig,
  /** Order status polling: 120/min per IP (~2/s, enough for several orders polling every 5s) */
  orderStatus: { limit: 120, windowSeconds: 60 } as RateLimitConfig,
  /** Search / product listing: 30 requests per minute (agent/products, semantic-search) */
  search: { limit: 30, windowSeconds: 60 } as RateLimitConfig,
} as const;

/**
 * Headers for rate limiting so agents can throttle without reading docs.
 * Include on both success and 429 responses when you have a RateLimitResult and the limit value.
 */
export function getRateLimitHeaders(
  result: RateLimitResult,
  limit: number,
): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.resetAt),
  };
}

/**
 * Create a rate-limited response with proper headers.
 * Pass limit when you have it so 429 responses include X-RateLimit-Limit for agents.
 */
export function rateLimitResponse(
  result: RateLimitResult,
  limit?: number,
): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...getRateLimitHeaders(result, limit ?? 0),
    "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
  };
  return new Response(
    JSON.stringify({
      error: "Too many requests",
      retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
    }),
    { headers, status: 429 },
  );
}
