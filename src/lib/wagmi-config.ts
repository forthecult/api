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
  [arbitrum.id]: "https://rpc.ankr.com/arbitrum_one",
  [base.id]: "https://rpc.ankr.com/base",
  [bsc.id]: "https://rpc.ankr.com/bsc",
  [mainnet.id]: "https://rpc.ankr.com/eth",
  [polygon.id]: "https://rpc.ankr.com/polygon",
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
  [arbitrum.id]: getRpcUrl(arbitrum.id),
  [base.id]: getRpcUrl(base.id),
  [bsc.id]: getRpcUrl(bsc.id),
  [mainnet.id]: getRpcUrl(mainnet.id),
  [polygon.id]: getRpcUrl(polygon.id),
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
            metadata: {
              description: "Checkout with crypto",
              icons: [],
              name: "For the Culture",
              url: typeof window !== "undefined" ? window.location.origin : "",
            },
            projectId,
            showQrModal: true,
            // Disable Pulse/analytics to avoid tracker flags and ERR_BLOCKED_BY_CLIENT when
            // ad blockers or privacy extensions block pulse.walletconnect.org.
            telemetryEnabled: false,
          }),
        ]
      : []),
  ],
  multiInjectedProviderDiscovery: true,
  transports: {
    [arbitrum.id]: http(rpcConfig[arbitrum.id]),
    [base.id]: http(rpcConfig[base.id]),
    [bsc.id]: http(rpcConfig[bsc.id]),
    [mainnet.id]: http(rpcConfig[mainnet.id]),
    [polygon.id]: http(rpcConfig[polygon.id]),
  },
});

// Export supported chain IDs for validation elsewhere
export const SUPPORTED_CHAIN_IDS = chains.map((c) => c.id);

// Export chain names for display
export const CHAIN_NAMES: Record<number, string> = {
  [arbitrum.id]: "Arbitrum",
  [base.id]: "Base",
  [bsc.id]: "BNB Chain",
  [mainnet.id]: "Ethereum",
  [polygon.id]: "Polygon",
};

/**
 * Check if a chain ID is supported
 */
export function isSupportedChain(chainId: number): boolean {
  return SUPPORTED_CHAIN_IDS.includes(chainId);
}
