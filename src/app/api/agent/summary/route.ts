import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { getAgentApiSummary } from "~/lib/agent-api-summary";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitHeaders,
  RATE_LIMITS,
  rateLimitResponse,
} from "~/lib/rate-limit";

/**
 * GET /api/agent/summary
 *
 * Machine-readable API summary for AI agents. Same data as the JSON script
 * on the for-agents page; use this when you prefer a single JSON response
 * (e.g. Accept: application/json or no HTML parsing).
 */
export async function GET() {
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const rl = await checkRateLimit(`agent:summary:${ip}`, RATE_LIMITS.api);
  if (!rl.success) {
    return rateLimitResponse(rl, RATE_LIMITS.api.limit);
  }

  const summary = getAgentApiSummary();
  return NextResponse.json(summary, {
    headers: {
      "Cache-Control": "public, max-age=300",
      ...getRateLimitHeaders(rl, RATE_LIMITS.api.limit),
    },
  });
}
