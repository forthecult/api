import { type NextRequest, NextResponse } from "next/server";

import { getClientIp, RATE_LIMITS, checkRateLimit, rateLimitResponse } from "~/lib/rate-limit";

/**
 * POST /api/solana-rpc
 *
 * Server-side proxy for Solana JSON-RPC calls.
 * Keeps the RPC API key (e.g. Helius) on the server so it isn't exposed in the client bundle.
 *
 * The client should send standard JSON-RPC payloads to this endpoint instead of
 * calling the RPC URL directly.
 *
 * Environment variable: SOLANA_RPC_URL (server-only, NOT NEXT_PUBLIC_)
 */

const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL ??
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
  "https://api.mainnet-beta.solana.com";

// Allowed JSON-RPC methods (whitelist to prevent abuse)
const ALLOWED_METHODS = new Set([
  "getBalance",
  "getAccountInfo",
  "getLatestBlockhash",
  "getSignatureStatuses",
  "getSignaturesForAddress",
  "getTokenAccountBalance",
  "getTokenAccountsByOwner",
  "getTransaction",
  "sendTransaction",
  "simulateTransaction",
  "getSlot",
  "getBlockHeight",
  "getRecentPrioritizationFees",
  "isBlockhashValid",
]);

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rl = await checkRateLimit(`solana-rpc:${ip}`, RATE_LIMITS.api);
  if (!rl.success) return rateLimitResponse(rl);

  let body: { method?: string; params?: unknown; id?: unknown; jsonrpc?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.method || !ALLOWED_METHODS.has(body.method)) {
    return NextResponse.json(
      { error: `Method not allowed: ${body.method ?? "(none)"}` },
      { status: 403 },
    );
  }

  try {
    const rpcResponse = await fetch(SOLANA_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: body.jsonrpc ?? "2.0",
        id: body.id ?? 1,
        method: body.method,
        params: body.params ?? [],
      }),
    });

    const data = await rpcResponse.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[solana-rpc proxy] Error:", err);
    return NextResponse.json(
      { error: "RPC request failed" },
      { status: 502 },
    );
  }
}
