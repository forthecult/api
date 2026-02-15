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
  id: string;
  name: string;
  description?: string;
  karma: number;
  avatar_url?: string;
  is_claimed: boolean;
  created_at?: string;
  follower_count?: number;
  following_count?: number;
  stats?: { posts: number; comments: number };
  owner?: {
    x_handle?: string;
    x_name?: string;
    x_avatar?: string;
    x_verified?: boolean;
    x_follower_count?: number;
  };
  human?: {
    username?: string;
    email_verified?: boolean;
  };
}

/** Response shape from Moltbook verify-identity API. */
interface MoltbookVerifyResponse {
  success?: boolean;
  valid: boolean;
  agent?: MoltbookAgent;
  error?: string;
  hint?: string;
}

/** Known error codes from Moltbook (for appropriate HTTP status/messages). */
const MOLTBOOK_ERROR_STATUS: Record<string, number> = {
  identity_token_expired: 401,
  invalid_token: 401,
  invalid_app_key: 401,
  missing_app_key: 401,
  agent_not_found: 404,
  agent_deactivated: 403,
  audience_required: 401,
  audience_mismatch: 401,
  rate_limit_exceeded: 429,
};

/**
 * Verify an identity token with Moltbook.
 * Uses MOLTBOOK_APP_KEY; optionally pass audience (recommended) to match token audience.
 */
export async function verifyMoltbookToken(
  token: string,
  options?: { audience?: string },
): Promise<
  | { valid: true; agent: MoltbookAgent }
  | { valid: false; error: string; status: number }
> {
  const appKey = process.env.MOLTBOOK_APP_KEY?.trim();
  if (!appKey) {
    return { valid: false, error: "missing_app_key", status: 401 };
  }

  const body: { token: string; audience?: string } = { token };
  if (options?.audience) body.audience = options.audience;

  let res: Response;
  try {
    res = await fetch(MOLTBOOK_VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Moltbook-App-Key": appKey,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { valid: false, error: `verify_failed: ${message}`, status: 502 };
  }

  let data: MoltbookVerifyResponse;
  try {
    data = (await res.json()) as MoltbookVerifyResponse;
  } catch {
    return { valid: false, error: "invalid_response", status: 502 };
  }

  if (data.valid && data.agent) {
    return { valid: true, agent: data.agent };
  }

  const errorCode = data.error ?? "invalid_token";
  const status = MOLTBOOK_ERROR_STATUS[errorCode] ?? 401;
  return { valid: false, error: errorCode, status };
}

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
        { error: "No identity token provided", code: "missing_identity" },
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
