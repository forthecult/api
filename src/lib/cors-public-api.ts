import { NextResponse } from "next/server";

/**
 * CORS for public agent-facing API (shipping, checkout, etc.) so AI agents
 * and browser clients on other origins can call the API with minimal friction.
 * Allow-Origin: * (no credentials).
 */
export const PUBLIC_API_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Max-Age": "86400",
};

export function publicApiCorsPreflight() {
  return new NextResponse(null, {
    headers: PUBLIC_API_CORS_HEADERS,
    status: 204,
  });
}

export function withPublicApiCors<T extends Response>(response: T): T {
  for (const [key, value] of Object.entries(PUBLIC_API_CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}
