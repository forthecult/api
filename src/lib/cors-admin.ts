import type { NextRequest } from "next/server";

/**
 * Allowed origins for CORS when the admin app (different origin) calls main app APIs.
 * Must match auth trustedOrigins for credentialled requests.
 */
export function getAdminAllowedOrigins(): string[] {
  if (process.env.NODE_ENV === "development") {
    return [
      "http://localhost:3001",
      "http://127.0.0.1:3001",
    ];
  }
  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_APP_URL;
  return adminUrl ? [adminUrl] : [];
}

/**
 * Add CORS headers to a response when the request origin is the admin app.
 * Use this in API routes that the admin dashboard calls (e.g. Loqate).
 */
export function addCorsIfAdminOrigin<T extends Response>(
  request: NextRequest,
  response: T,
): T {
  const origin = request.headers.get("origin");
  const allowed = getAdminAllowedOrigins();
  if (!origin || !allowed.includes(origin)) return response;

  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.append("Vary", "Origin");
  return response;
}
