import { createConfig, http } from "wagmi";
import { arbitrum, base, bsc, mainnet, polygon } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

// WalletConnect project ID (required for WalletConnect v2)
const projectId =
  typeof process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID === "string" &&
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID.trim().length > 0
    ? process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID.trim()
    : undefined;

// ANKR RPC endpoints (no signup phone required; set in .env for paid sub later)
const ANKR_DEFAULTS: Record<number, string> = {
  [mainnet.id]: "https://rpc.ankr.com/eth",
  [arbitrum.id]: "https://rpc.ankr.com/arbitrum_one",
  [base.id]: "https://rpc.ankr.com/base",
  [polygon.id]: "https://rpc.ankr.com/polygon",
  [bsc.id]: "https://rpc.ankr.com/bsc",
};

function getRpcUrl(chainId: number): string {
  const envKey =
    chainId === mainnet.id
      ? "NEXT_PUBLIC_ETHEREUM_RPC_URL"
      : chainId === arbitrum.id
        ? "NEXT_PUBLIC_ARBITRUM_RPC_URL"
        : chainId === base.id
          ? "NEXT_PUBLIC_BASE_RPC_URL"
          : chainId === polygon.id
            ? "NEXT_PUBLIC_POLYGON_RPC_URL"
            : chainId === bsc.id
              ? "NEXT_PUBLIC_BNB_RPC_URL"
              : null;
  const url =
    envKey &&
    typeof process.env[envKey] === "string" &&
    process.env[envKey]!.trim()
      ? process.env[envKey]!.trim()
      : ANKR_DEFAULTS[chainId];
  return url ?? ANKR_DEFAULTS[mainnet.id]!;
}

const rpcConfig = {
  [mainnet.id]: getRpcUrl(mainnet.id),
  [arbitrum.id]: getRpcUrl(arbitrum.id),
  [base.id]: getRpcUrl(base.id),
  [polygon.id]: getRpcUrl(polygon.id),
  [bsc.id]: getRpcUrl(bsc.id),
} as const;

// Supported chains for the application
const chains = [mainnet, arbitrum, base, polygon, bsc] as const;

// Validate that we have proper RPC configuration in production
if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
  if (!projectId) {
    console.warn(
      "[wagmi-config] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID not set. WalletConnect will be disabled.",
    );
  }
}

export const wagmiConfig = createConfig({
  chains,
  connectors: [
    injected({ shimDisconnect: true }),
    ...(projectId
      ? [
          walletConnect({
            projectId,
            metadata: {
              name: "Culture",
              description: "Checkout with crypto",
              url: typeof window !== "undefined" ? window.location.origin : "",
              icons: [],
            },
            showQrModal: true,
          }),
        ]
      : []),
  ],
  multiInjectedProviderDiscovery: true,
  transports: {
    [mainnet.id]: http(rpcConfig[mainnet.id]),
    [arbitrum.id]: http(rpcConfig[arbitrum.id]),
    [base.id]: http(rpcConfig[base.id]),
    [polygon.id]: http(rpcConfig[polygon.id]),
    [bsc.id]: http(rpcConfig[bsc.id]),
  },
});

// Export supported chain IDs for validation elsewhere
export const SUPPORTED_CHAIN_IDS = chains.map((c) => c.id);

// Export chain names for display
export const CHAIN_NAMES: Record<number, string> = {
  [mainnet.id]: "Ethereum",
  [arbitrum.id]: "Arbitrum",
  [base.id]: "Base",
  [polygon.id]: "Polygon",
  [bsc.id]: "BNB Chain",
};

/**
 * Check if a chain ID is supported
 */
export function isSupportedChain(chainId: number): boolean {
  return SUPPORTED_CHAIN_IDS.includes(chainId);
}
