/**
 * Sign in with Moltbook — verify AI agent identity tokens.
 * See: https://moltbook.com/developers.md
 *
 * Set MOLTBOOK_APP_KEY in env (from https://moltbook.com/developers/dashboard).
 * Optional: MOLTBOOK_AUDIENCE to restrict tokens to your service (e.g. "forthecult.store").
 */

import { type NextRequest, NextResponse } from "next/server";

const MOLTBOOK_VERIFY_URL =
  "https://moltbook.com/api/v1/agents/verify-identity";
const IDENTITY_HEADER = "x-moltbook-identity";

/** Verified agent profile returned by Moltbook (subset of full response). */
export interface MoltbookAgent {
  avatar_url?: string;
  created_at?: string;
  description?: string;
  follower_count?: number;
  following_count?: number;
  human?: {
    email_verified?: boolean;
    username?: string;
  };
  id: string;
  is_claimed: boolean;
  karma: number;
  name: string;
  owner?: {
    x_avatar?: string;
    x_follower_count?: number;
    x_handle?: string;
    x_name?: string;
    x_verified?: boolean;
  };
  stats?: { comments: number; posts: number };
}

/** Response shape from Moltbook verify-identity API. */
interface MoltbookVerifyResponse {
  agent?: MoltbookAgent;
  error?: string;
  hint?: string;
  success?: boolean;
  valid: boolean;
}

/** Known error codes from Moltbook (for appropriate HTTP status/messages). */
const MOLTBOOK_ERROR_STATUS: Record<string, number> = {
  agent_deactivated: 403,
  agent_not_found: 404,
  audience_mismatch: 401,
  audience_required: 401,
  identity_token_expired: 401,
  invalid_app_key: 401,
  invalid_token: 401,
  missing_app_key: 401,
  rate_limit_exceeded: 429,
};

/**
 * Extract X-Moltbook-Identity from request, verify with Moltbook, and return either
 * the verified agent or an error NextResponse. Use in route handlers that require
 * Moltbook auth.
 *
 * @example
 *   const result = await getMoltbookAgentFromRequest(request);
 *   if (result.error) return result.error;
 *   const agent = result.agent; // use agent.id, agent.name, agent.karma, etc.
 */
export async function getMoltbookAgentFromRequest(
  request: NextRequest,
  options?: { audience?: string },
): Promise<{ agent: MoltbookAgent } | { error: NextResponse }> {
  const token = request.headers.get(IDENTITY_HEADER)?.trim();
  if (!token) {
    return {
      error: NextResponse.json(
        { code: "missing_identity", error: "No identity token provided" },
        { status: 401 },
      ),
    };
  }

  const audience =
    options?.audience ??
    (typeof process.env.MOLTBOOK_AUDIENCE === "string" &&
    process.env.MOLTBOOK_AUDIENCE.trim()
      ? process.env.MOLTBOOK_AUDIENCE.trim()
      : undefined);

  const result = await verifyMoltbookToken(token, { audience });

  if (result.valid) {
    return { agent: result.agent };
  }

  return {
    error: NextResponse.json(
      {
        error: result.error,
        hint:
          result.error === "identity_token_expired"
            ? "Generate a new identity token from Moltbook and retry."
            : undefined,
      },
      { status: result.status },
    ),
  };
}

/**
 * Optionally get the verified Moltbook agent from the request.
 * Does not return an error response: if no token or invalid token, returns { agent: null }.
 * Use in public endpoints (e.g. checkout) to attach agent id when the header is present and valid.
 */
export async function getOptionalMoltbookAgentFromRequest(
  request: NextRequest,
  options?: { audience?: string },
): Promise<{ agent: MoltbookAgent | null }> {
  const token = request.headers.get(IDENTITY_HEADER)?.trim();
  if (!token) return { agent: null };

  const audience =
    options?.audience ??
    (typeof process.env.MOLTBOOK_AUDIENCE === "string" &&
    process.env.MOLTBOOK_AUDIENCE.trim()
      ? process.env.MOLTBOOK_AUDIENCE.trim()
      : undefined);

  const result = await verifyMoltbookToken(token, { audience });
  if (result.valid) return { agent: result.agent };
  return { agent: null };
}

/**
 * Verify an identity token with Moltbook.
 * Uses MOLTBOOK_APP_KEY; optionally pass audience (recommended) to match token audience.
 */
export async function verifyMoltbookToken(
  token: string,
  options?: { audience?: string },
): Promise<
  | { agent: MoltbookAgent; valid: true }
  | { error: string; status: number; valid: false }
> {
  const appKey = process.env.MOLTBOOK_APP_KEY?.trim();
  if (!appKey) {
    return { error: "missing_app_key", status: 401, valid: false };
  }

  const body: { audience?: string; token: string } = { token };
  if (options?.audience) body.audience = options.audience;

  let res: Response;
  try {
    res = await fetch(MOLTBOOK_VERIFY_URL, {
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        "X-Moltbook-App-Key": appKey,
      },
      method: "POST",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { error: `verify_failed: ${message}`, status: 502, valid: false };
  }

  let data: MoltbookVerifyResponse;
  try {
    data = (await res.json()) as MoltbookVerifyResponse;
  } catch {
    return { error: "invalid_response", status: 502, valid: false };
  }

  if (data.valid && data.agent) {
    return { agent: data.agent, valid: true };
  }

  const errorCode = data.error ?? "invalid_token";
  const status = MOLTBOOK_ERROR_STATUS[errorCode] ?? 401;
  return { error: errorCode, status, valid: false };
}
