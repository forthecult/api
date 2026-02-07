import { toNextJsHandler } from "better-auth/next-js";
import type { NextRequest } from "next/server";

import { auth } from "~/lib/auth";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
  rateLimitResponse,
} from "~/lib/rate-limit";

const { GET: authGet, POST: authPost } = toNextJsHandler(auth);

/** Allowed origins for CORS (admin app calling main app auth API). Must match trustedOrigins in auth config. */
function getAllowedAuthOrigins(): string[] {
  if (process.env.NODE_ENV === "development") {
    return [
      "http://localhost:3001",
      "http://127.0.0.1:3001",
    ];
  }
  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_APP_URL;
  return adminUrl ? [adminUrl] : [];
}

function withCorsIfAllowed(request: NextRequest, res: Response): Response {
  const origin = request.headers.get("origin");
  const allowed = getAllowedAuthOrigins();
  if (!origin || !allowed.includes(origin)) return res;

  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.append("Vary", "Origin");

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

const isDev = process.env.NODE_ENV === "development";

async function handleAuth(
  request: NextRequest,
  handler: (req: NextRequest) => Promise<Response>,
): Promise<Response> {
  try {
    const res = await handler(request);
    // Log 500 responses so we can see better-auth error details in server terminal
    if (res.status >= 500) {
      const clone = res.clone();
      try {
        const body = await clone.text();
        console.error("[auth] Server error response:", res.status, body);
        // In dev, return the server error body to the client so you can see it in Network tab
        if (isDev && body) {
          return withCorsIfAllowed(
            request,
            new Response(body, {
              status: res.status,
              headers: {
                "Content-Type": "application/json",
                ...Object.fromEntries(res.headers.entries()),
              },
            }),
          );
        }
      } catch {
        console.error(
          "[auth] Server error response:",
          res.status,
          "(body not readable)",
        );
      }
    }
    return withCorsIfAllowed(request, res);
  } catch (err) {
    console.error("[auth] Handler error:", err);
    if (err instanceof Error && err.stack) {
      console.error("[auth] Stack:", err.stack);
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    const stack = err instanceof Error ? err.stack : undefined;
    const res = new Response(
      JSON.stringify({
        error: "Authentication error",
        message,
        ...(isDev && stack && { _devStack: stack }),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
    return withCorsIfAllowed(request, res);
  }
}

// CORS preflight: allow admin app (localhost:3001) to send credentialed requests
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  const allowed = getAllowedAuthOrigins();
  const headers = new Headers();
  if (origin && allowed.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    headers.set("Access-Control-Max-Age", "86400");
  }
  headers.append("Vary", "Origin");
  return new Response(null, { status: 204, headers });
}

// Use a higher limit when IP is unknown so one shared bucket doesn't block all prod users (e.g. when proxy doesn't send X-Forwarded-For)
function getAuthRateLimitConfig(ip: string) {
  return ip === "unknown" ? RATE_LIMITS.authUnknownIp : RATE_LIMITS.auth;
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const result = checkRateLimit(`auth:${ip}`, getAuthRateLimitConfig(ip));
  if (!result.success) {
    return rateLimitResponse(result);
  }
  return handleAuth(request, authGet);
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const result = checkRateLimit(`auth:${ip}`, getAuthRateLimitConfig(ip));
  if (!result.success) {
    return rateLimitResponse(result);
  }
  return handleAuth(request, authPost);
}
