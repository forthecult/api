/**
 * Request ID propagation for distributed tracing.
 * 
 * Request IDs flow through the system to trace requests across
 * API boundaries, async jobs, and service calls.
 *
 * Usage:
 *   - In API routes: const requestId = getRequestId() ?? generateRequestId();
 *   - In async operations: await withRequestId(reqId, async () => { ... });
 *   - In logs: logger.info(`[${getRequestId()}] Starting operation`);
 */

import { logger } from "./logger";

const REQUEST_ID_HEADER = "x-request-id";

/** Type for request IDs (typically UUID v4) */
export type RequestId = string;

// Use AsyncLocalStorage for request context propagation
import { AsyncLocalStorage } from "async_hooks";

const requestIdStorage = new AsyncLocalStorage<RequestId>();

/**
 * Generate a new request ID (UUID v4 format)
 */
export function generateRequestId(): RequestId {
  // Use crypto.randomUUID if available (Node.js 14.17+)
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback implementation
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get the current request ID from async context
 */
export function getRequestId(): RequestId | undefined {
  return requestIdStorage.getStore();
}

/**
 * Run a function with a specific request ID in context
 */
export async function withRequestId<T>(
  requestId: RequestId,
  fn: () => Promise<T>
): Promise<T> {
  return requestIdStorage.run(requestId, fn);
}

/**
 * Extract or generate a request ID from incoming headers
 */
export function extractRequestId(
  headers: Headers | Record<string, string | string[] | undefined>
): RequestId {
  // Try to extract from headers
  let headerValue: string | undefined;

  if (headers instanceof Headers) {
    headerValue = headers.get(REQUEST_ID_HEADER) ?? undefined;
  } else {
    const raw = headers[REQUEST_ID_HEADER.toLowerCase()];
    headerValue = Array.isArray(raw) ? raw[0] : raw;
  }

  // Validate and use, or generate new
  if (headerValue && isValidRequestId(headerValue)) {
    return headerValue;
  }

  return generateRequestId();
}

/**
 * Create headers with the current request ID for outgoing requests
 */
export function withRequestIdHeaders(
  headers: Record<string, string> = {}
): Record<string, string> {
  const requestId = getRequestId();
  if (requestId) {
    return { ...headers, [REQUEST_ID_HEADER]: requestId };
  }
  return headers;
}

/**
 * Log with request ID context
 */
export function logWithRequestId(
  level: "info" | "warn" | "error" | "debug",
  message: string,
  meta?: Record<string, unknown>
): void {
  const requestId = getRequestId();
  const fn = logger[level];
  if (requestId) {
    fn(message, { ...meta, requestId });
  } else {
    fn(message, meta);
  }
}

/**
 * Validate request ID format (basic UUID-like check)
 */
function isValidRequestId(id: string): boolean {
  // Allow UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  // Also allow simple request IDs like "req_" prefix or base64-like strings
  if (id.length > 64) return false; // Too long
  if (id.length < 8) return false; // Too short
  // Basic validation - alphanumeric with dashes and underscores
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

/**
 * Next.js middleware helper to extract/inject request IDs
 */
export function middlewareWithRequestId(
  request: Request,
  handler: (req: Request, requestId: RequestId) => Response | Promise<Response>
): Promise<Response> {
  const requestId = extractRequestId(request.headers);

  return withRequestId(requestId, async () => {
    const response = await handler(request, requestId);
    // Ensure response headers include request ID
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  });
}

/**
 * Format a log prefix with request ID
 */
export function requestIdPrefix(): string {
  const id = getRequestId();
  return id ? `[${id.slice(0, 8)}] ` : "";
}
