import { NextResponse } from "next/server";

import {
  publicApiCorsPreflight,
  withPublicApiCors,
} from "~/lib/cors-public-api";

export async function GET() {
  const commitSha =
    process.env.RAILWAY_GIT_COMMIT_SHA ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GITHUB_SHA ??
    "";
  const commitShaShort = commitSha ? commitSha.slice(0, 12) : null;

  const response = NextResponse.json({
    commitShaShort,
    status: "ok",
    timestamp: new Date().toISOString(),
  });
  // Health responses are deployment-state probes; never cache them.
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");

  return withPublicApiCors(
    response,
  );
}

/**
 * Health check for AI agents and monitoring.
 * GET /api/health — use this to verify the API is reachable before calling /api/products/search.
 */
export async function OPTIONS() {
  return publicApiCorsPreflight();
}
