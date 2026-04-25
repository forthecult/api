import { NextResponse } from "next/server";

import { openApiSpec } from "~/lib/openapi";

/**
 * OpenAPI 3.0 spec for For the Cult API.
 * GET /api/openapi.json
 * Used by Swagger UI at /api/docs and by external tools (RapidAPI, MCP, etc.).
 */
export async function GET() {
  return NextResponse.json(openApiSpec, {
    headers: {
      "Cache-Control": "public, max-age=300",
      "Content-Type": "application/json",
    },
  });
}
