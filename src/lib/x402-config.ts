/**
 * x402 payment config for paid data APIs (rates, bulk product prices, shipping).
 * Env: X402_PAY_TO_ADDRESS (EVM 0x), X402_PAY_TO_SOLANA_ADDRESS (base58), X402_NETWORK (base | base-sepolia | solana | solana-devnet), X402_ENABLED.
 */

import type { NextRequest } from "next/server";
import { withX402 } from "x402-next";

const EVM_NETWORKS = ["base", "base-sepolia"] as const;
const SOLANA_NETWORKS = ["solana", "solana-devnet"] as const;
export type X402NetworkEvm = (typeof EVM_NETWORKS)[number];
export type X402NetworkSolana = (typeof SOLANA_NETWORKS)[number];
export type X402Network = X402NetworkEvm | X402NetworkSolana;

/** x402 receiving address: EVM (0x...) or Solana (base58). */
const X402_PAY_TO_EVM = process.env.X402_PAY_TO_ADDRESS?.trim();
const X402_PAY_TO_SOLANA = process.env.X402_PAY_TO_SOLANA_ADDRESS?.trim();
/** base | base-sepolia | solana | solana-devnet. Default base-sepolia. */
const X402_NETWORK_RAW = process.env.X402_NETWORK?.trim()?.toLowerCase();
const X402_NETWORK: X402Network =
  X402_NETWORK_RAW === "solana" || X402_NETWORK_RAW === "solana-devnet"
    ? X402_NETWORK_RAW
    : EVM_NETWORKS.includes(X402_NETWORK_RAW as X402NetworkEvm)
      ? (X402_NETWORK_RAW as X402NetworkEvm)
      : "base-sepolia";
/** Set to "false" to disable x402 even when a pay-to address is set. */
const X402_ENABLED = process.env.X402_ENABLED !== "false";

const isEvm = EVM_NETWORKS.includes(X402_NETWORK as X402NetworkEvm);
const isSolana = SOLANA_NETWORKS.includes(X402_NETWORK as X402NetworkSolana);

export const x402Enabled = Boolean(
  X402_ENABLED &&
    ((isEvm && X402_PAY_TO_EVM?.startsWith("0x")) ||
      (isSolana && X402_PAY_TO_SOLANA && X402_PAY_TO_SOLANA.length >= 32)),
);

/** Pay-to address for the selected network (0x for EVM, base58 for Solana). */
export const x402PayTo: `0x${string}` | string | null = x402Enabled
  ? isEvm
    ? (X402_PAY_TO_EVM as `0x${string}`)
    : (X402_PAY_TO_SOLANA ?? null)
  : null;

export const x402Network = X402_NETWORK;
export const x402NetworkKind = isEvm ? ("evm" as const) : ("solana" as const);

/** Base config for paid data endpoints. Supports Base (EVM) and Solana. */
const defaultRouteConfig = {
  price: "$0.01" as const,
  network: X402_NETWORK,
  config: {
    description: "For the Cult — paid data API",
    maxTimeoutSeconds: 120,
  },
};

/** Per-route descriptions for 402 paywall. Exchange rates and metals only; product prices, shipping, catalog are free. */
export const x402RouteConfigs = {
  "x402/rates/fiat": {
    ...defaultRouteConfig,
    config: {
      ...defaultRouteConfig.config,
      description: "Fiat-to-fiat exchange rates — GET /api/x402/rates/fiat?from=USD&to=EUR",
    },
  },
  "x402/rates/crypto-fiat": {
    ...defaultRouteConfig,
    config: {
      ...defaultRouteConfig.config,
      description: "Crypto-to-fiat rates — GET /api/x402/rates/crypto-fiat?crypto=ETH&fiat=USD",
    },
  },
  "x402/rates/crypto": {
    ...defaultRouteConfig,
    config: {
      ...defaultRouteConfig.config,
      description: "Crypto-to-crypto rates — GET /api/x402/rates/crypto?from=ETH&to=BTC",
    },
  },
  "x402/rates/metals-fiat": {
    ...defaultRouteConfig,
    config: {
      ...defaultRouteConfig.config,
      description: "Precious metals to fiat (XAU, XAG) — GET /api/x402/rates/metals-fiat?metal=XAU&fiat=USD",
    },
  },
  "x402/rates/metals-crypto": {
    ...defaultRouteConfig,
    config: {
      ...defaultRouteConfig.config,
      description: "Precious metals to crypto — GET /api/x402/rates/metals-crypto?metal=XAU&crypto=ETH",
    },
  },
} as const;

export type X402RouteKey = keyof typeof x402RouteConfigs;

type RouteContext = { params?: Promise<Record<string, string>> };
type RouteHandler = (
  request: NextRequest,
  context?: RouteContext,
) => Promise<Response>;

/**
 * Wraps an API route handler with x402 payment when a pay-to address is set.
 * Supports EVM (Base) and Solana: set X402_NETWORK to base | base-sepolia | solana | solana-devnet
 * and the matching X402_PAY_TO_ADDRESS (0x) or X402_PAY_TO_SOLANA_ADDRESS (base58).
 * For Solana, a facilitator that supports Solana may be required (see x402 docs).
 * When x402 is disabled, returns the handler unchanged.
 */
export function withOptionalX402<T extends RouteHandler>(
  handler: T,
  routeKey: X402RouteKey,
): T {
  if (!x402Enabled || !x402PayTo) return handler;
  const routeConfig = x402RouteConfigs[routeKey];
  return ((request: NextRequest, context?: RouteContext) => {
    const boundHandler = (req: NextRequest) => handler(req, context);
    return withX402(boundHandler, x402PayTo as `0x${string}`, routeConfig)(request);
  }) as T;
}
