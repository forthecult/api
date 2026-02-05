"use client";

/**
 * MetaMask SDK for ETH/EVM wallet connection.
 * Wrap EVM checkout (or any route that needs MetaMask) with MetaMaskProvider.
 * Use useSDK() for connect(), provider, chainId, accounts, etc.
 * @see https://metamask.io/developer/sdk
 */

import {
  MetaMaskProvider as SDKMetaMaskProvider,
  useSDK,
} from "@metamask/sdk-react";
import type { MetaMaskSDKOptions } from "@metamask/sdk";

type MetaMaskProviderProps = React.PropsWithChildren<{
  /** optional overrides; dappMetadata is set by default */
  sdkOptions?: Partial<MetaMaskSDKOptions>;
}>;

const defaultSdkOptions: MetaMaskSDKOptions = {
  dappMetadata: {
    name:
      typeof process.env.NEXT_PUBLIC_APP_NAME === "string"
        ? process.env.NEXT_PUBLIC_APP_NAME
        : "Culture",
    url: typeof window !== "undefined" ? window.location.origin : "",
  },
  // Disable SDK analytics to avoid "Failed to fetch" when requests to
  // mm-sdk-analytics.api.cx.metamask.io are blocked (e.g. by ad blockers).
  enableAnalytics: false,
};

/** wrap EVM checkout or any subtree that needs MetaMask (ETH/EVM) */
export function MetaMaskProvider({
  children,
  sdkOptions: overrides,
}: MetaMaskProviderProps) {
  const opts: MetaMaskSDKOptions = {
    ...defaultSdkOptions,
    ...overrides,
  };
  return (
    <SDKMetaMaskProvider sdkOptions={opts}>{children}</SDKMetaMaskProvider>
  );
}

export { useSDK };
