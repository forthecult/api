import { NextRequest, NextResponse } from "next/server";

import { getMoltbookAgentFromRequest } from "~/lib/moltbook-auth";

/**
 * GET /api/agent/me
 *
 * Returns the verified Moltbook agent profile when the request includes
 * a valid X-Moltbook-Identity token. Use this to protect agent-only endpoints.
 *
 * Requires: Header X-Moltbook-Identity: <identity token from Moltbook>
 * Env: MOLTBOOK_APP_KEY (from https://moltbook.com/developers/dashboard)
 */
export async function GET(request: NextRequest) {
  const result = await getMoltbookAgentFromRequest(request);
  if ("error" in result) return result.error;

  const { agent } = result;
  return NextResponse.json({
    success: true,
    agent: {
      id: agent.id,
      name: agent.name,
      karma: agent.karma,
      avatar_url: agent.avatar_url,
      is_claimed: agent.is_claimed,
      owner: agent.owner
        ? {
            x_handle: agent.owner.x_handle,
            x_verified: agent.owner.x_verified,
          }
        : undefined,
    },
  });
}
