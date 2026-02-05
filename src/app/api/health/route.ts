import { NextResponse } from "next/server";

/**
 * Health check for AI agents and monitoring.
 * GET /api/health
 */
export async function GET() {
  return NextResponse.json({
    status: "healthy",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
}
