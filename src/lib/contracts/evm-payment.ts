/**
 * EVM Payment Utilities
 *
 * This module provides utilities for:
 * - Computing deterministic payment receiver addresses (CREATE2)
 * - Token contract addresses per chain
 * - Payment amount calculations
 * - Transaction verification
 */

import {
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  concat,
  toHex,
  pad,
} from "viem";

// ============================================================================
// FACTORY DEPLOYMENTS
// ============================================================================

/**
 * PaymentReceiverFactory contract addresses per chain.
 * These must be deployed using the contracts/scripts/deploy.ts script.
 *
 * IMPORTANT: Update these addresses after deploying to each chain!
 */
export const FACTORY_ADDRESSES: Record<number, `0x${string}`> = {
  // Mainnets - Deploy and update these addresses
  1: "0x0000000000000000000000000000000000000000", // Ethereum Mainnet
  42161: "0x0000000000000000000000000000000000000000", // Arbitrum One
  8453: "0x0000000000000000000000000000000000000000", // Base
  137: "0x0000000000000000000000000000000000000000", // Polygon
  56: "0x0000000000000000000000000000000000000000", // BNB Smart Chain
  10: "0x0000000000000000000000000000000000000000", // Optimism
  // Testnets
  11155111: "0x0000000000000000000000000000000000000000", // Sepolia
  84532: "0x0000000000000000000000000000000000000000", // Base Sepolia
};

/**
 * PaymentReceiver implementation addresses per chain (set during factory deployment)
 */
export const IMPLEMENTATION_ADDRESSES: Record<number, `0x${string}`> = {
  1: "0x0000000000000000000000000000000000000000",
  42161: "0x0000000000000000000000000000000000000000",
  8453: "0x0000000000000000000000000000000000000000",
  137: "0x0000000000000000000000000000000000000000",
  56: "0x0000000000000000000000000000000000000000",
  10: "0x0000000000000000000000000000000000000000",
  11155111: "0x0000000000000000000000000000000000000000",
  84532: "0x0000000000000000000000000000000000000000",
};

// ============================================================================
// TOKEN ADDRESSES
// ============================================================================

/**
 * USDC contract addresses per chain
 */
export const USDC_ADDRESSES: Record<number, `0x${string}`> = {
  1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // Ethereum
  42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // Arbitrum (native USDC)
  8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base
  137: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", // Polygon (native USDC)
  56: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", // BNB (Binance-Peg)
  10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", // Optimism (native USDC)
  // Testnets
  11155111: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Sepolia
  84532: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia
};

/**
 * USDT (Tether) contract addresses per chain
 */
export const USDT_ADDRESSES: Record<number, `0x${string}`> = {
  1: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // Ethereum
  42161: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", // Arbitrum
  137: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", // Polygon
  56: "0x55d398326f99059fF775485246999027B3197955", // BNB (Binance-Peg)
  10: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", // Optimism
  // Note: USDT not available on Base mainnet
};

/**
 * Token decimals (USDC and USDT both use 6 decimals on most chains)
 */
export const TOKEN_DECIMALS: Record<string, number> = {
  ETH: 18,
  USDC: 6,
  USDT: 6,
};

// ============================================================================
// CHAIN CONFIGURATION
// ============================================================================

export const CHAIN_NAMES: Record<number, string> = {
  1: "ethereum",
  42161: "arbitrum",
  8453: "base",
  137: "polygon",
  56: "bnb",
  10: "optimism",
  11155111: "sepolia",
  84532: "base-sepolia",
};

export const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  arbitrum: 42161,
  base: 8453,
  polygon: 137,
  bnb: 56,
  optimism: 10,
  sepolia: 11155111,
  "base-sepolia": 84532,
};

/**
 * RPC URLs for each chain (for server-side verification)
 * These can be overridden via environment variables
 */
export function getRpcUrl(chainId: number): string {
  const envKey = `${CHAIN_NAMES[chainId]?.toUpperCase().replace("-", "_")}_RPC_URL`;
  const envUrl = process.env[envKey];
  if (envUrl) return envUrl;

  // Default ANKR public RPCs (set * _RPC_URL in .env for paid sub)
  const defaults: Record<number, string> = {
    1: "https://rpc.ankr.com/eth",
    42161: "https://rpc.ankr.com/arbitrum_one",
    8453: "https://rpc.ankr.com/base",
    137: "https://rpc.ankr.com/polygon",
    56: "https://rpc.ankr.com/bsc",
    10: "https://rpc.ankr.com/optimism",
    11155111: "https://rpc.sepolia.org",
    84532: "https://sepolia.base.org",
  };
  return defaults[chainId] ?? "";
}

// ============================================================================
// CREATE2 ADDRESS COMPUTATION
// ============================================================================

/**
 * EIP-1167 Minimal Proxy bytecode prefix and suffix
 * The implementation address is inserted between these
 */
const PROXY_BYTECODE_PREFIX = "0x3d602d80600a3d3981f3363d3d373d3d3d363d73";
const PROXY_BYTECODE_SUFFIX = "5af43d82803e903d91602b57fd5bf3";

/**
 * Compute the CREATE2 address for a payment receiver clone
 * This matches the OpenZeppelin Clones.predictDeterministicAddress function
 *
 * @param factoryAddress The PaymentReceiverFactory contract address
 * @param implementationAddress The PaymentReceiver implementation address
 * @param orderId The order ID (will be converted to bytes32 salt)
 * @returns The deterministic address where the receiver will be deployed
 */
export function computePaymentReceiverAddress(
  factoryAddress: `0x${string}`,
  implementationAddress: `0x${string}`,
  orderId: string,
): `0x${string}` {
  // Convert orderId to bytes32 salt
  const salt = orderIdToBytes32(orderId);

  // Build the minimal proxy bytecode (EIP-1167)
  const implementation = implementationAddress.toLowerCase().slice(2);
  const bytecode = `${PROXY_BYTECODE_PREFIX}${implementation}${PROXY_BYTECODE_SUFFIX}`;
  const bytecodeHash = keccak256(bytecode as `0x${string}`);

  // CREATE2 address = keccak256(0xff ++ factory ++ salt ++ keccak256(bytecode))[12:]
  const data = concat(["0xff", factoryAddress, salt, bytecodeHash]);

  const hash = keccak256(data);
  return `0x${hash.slice(26)}` as `0x${string}`;
}

/**
 * Convert an order ID string to bytes32 for use as CREATE2 salt
 * Uses keccak256 to ensure consistent 32-byte output
 */
export function orderIdToBytes32(orderId: string): `0x${string}` {
  return keccak256(toHex(orderId));
}

/**
 * Compute payment receiver address for a given chain and order
 */
export function getPaymentReceiverAddress(
  chainId: number,
  orderId: string,
): `0x${string}` | null {
  const factoryAddress = FACTORY_ADDRESSES[chainId];
  const implementationAddress = IMPLEMENTATION_ADDRESSES[chainId];

  if (
    !factoryAddress ||
    factoryAddress === "0x0000000000000000000000000000000000000000"
  ) {
    return null; // Factory not deployed on this chain
  }
  if (
    !implementationAddress ||
    implementationAddress === "0x0000000000000000000000000000000000000000"
  ) {
    return null;
  }

  return computePaymentReceiverAddress(
    factoryAddress,
    implementationAddress,
    orderId,
  );
}

// ============================================================================
// AMOUNT CALCULATIONS
// ============================================================================

/**
 * Convert USD cents to token amount (wei/smallest unit)
 *
 * @param usdCents Amount in USD cents (e.g., 1999 for $19.99)
 * @param token Token symbol (ETH, USDC, USDT)
 * @param ethPriceUsd ETH price in USD (required for ETH payments)
 * @returns Amount in smallest token unit (wei for ETH, 6 decimals for USDC/USDT)
 */
export function usdCentsToTokenAmount(
  usdCents: number,
  token: "ETH" | "USDC" | "USDT",
  ethPriceUsd?: number,
): bigint {
  const decimals = TOKEN_DECIMALS[token];

  if (token === "ETH") {
    if (!ethPriceUsd || ethPriceUsd <= 0) {
      throw new Error("ETH price required for ETH payments");
    }
    // Convert USD to ETH: (usdCents / 100) / ethPriceUsd * 10^18
    const usd = usdCents / 100;
    const ethAmount = usd / ethPriceUsd;
    // Add 1% buffer for price volatility
    const ethWithBuffer = ethAmount * 1.01;
    return BigInt(Math.ceil(ethWithBuffer * 10 ** decimals));
  }

  // USDC/USDT: 1 USD = 1 token, 6 decimals
  // usdCents / 100 * 10^6 = usdCents * 10^4
  return BigInt(usdCents) * BigInt(10 ** (decimals - 2));
}

/**
 * Format token amount for display
 */
export function formatTokenAmount(
  amount: bigint,
  token: "ETH" | "USDC" | "USDT",
  maxDecimals = 6,
): string {
  const decimals = TOKEN_DECIMALS[token];
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;

  if (fraction === 0n) {
    return whole.toString();
  }

  const fractionStr = fraction.toString().padStart(decimals, "0");
  const trimmed = fractionStr.slice(0, maxDecimals).replace(/0+$/, "");

  return trimmed ? `${whole}.${trimmed}` : whole.toString();
}

// ============================================================================
// TOKEN HELPERS
// ============================================================================

/**
 * Get token contract address for a chain
 */
export function getTokenAddress(
  chainId: number,
  token: "USDC" | "USDT",
): `0x${string}` | null {
  if (token === "USDC") {
    return USDC_ADDRESSES[chainId] ?? null;
  }
  if (token === "USDT") {
    return USDT_ADDRESSES[chainId] ?? null;
  }
  return null;
}

/**
 * Check if a token is supported on a chain
 */
export function isTokenSupportedOnChain(
  chainId: number,
  token: "ETH" | "USDC" | "USDT",
): boolean {
  if (token === "ETH") return true; // ETH is native on all EVM chains
  const address = getTokenAddress(chainId, token);
  return address !== null;
}

/**
 * Check if factory is deployed on a chain
 */
export function isFactoryDeployed(chainId: number): boolean {
  const address = FACTORY_ADDRESSES[chainId];
  return (
    address !== undefined &&
    address !== "0x0000000000000000000000000000000000000000"
  );
}
