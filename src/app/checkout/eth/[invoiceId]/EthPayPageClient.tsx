"use client";

import { MetaMaskProvider } from "~/lib/metamask-sdk";
import { WagmiProvider } from "~/lib/wagmi-provider";

import { EthPayClient } from "../EthPayClient";

export function EthPayPageClient() {
  return (
    <WagmiProvider>
      <MetaMaskProvider>
        <EthPayClient />
      </MetaMaskProvider>
    </WagmiProvider>
  );
}
