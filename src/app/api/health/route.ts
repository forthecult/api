import { NextResponse } from "next/server";

import {
  publicApiCorsPreflight,
  withPublicApiCors,
} from "~/lib/cors-public-api";

/**
 * Health check for AI agents and monitoring.
 * GET /api/health — use this to verify the API is reachable before calling /api/products/search.
 */
export async function OPTIONS() {
  return publicApiCorsPreflight();
}

export async function GET() {
  return withPublicApiCors(
    NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
    }),
  );
}
