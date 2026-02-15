"use client";

import {
  createNetworkConfig,
  SuiClientProvider,
  WalletProvider as SuiWalletProviderBase,
} from "@mysten/dapp-kit";
import { getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

const { networkConfig } = createNetworkConfig({
  mainnet: { network: "mainnet", url: getJsonRpcFullnodeUrl("mainnet") },
  testnet: { network: "testnet", url: getJsonRpcFullnodeUrl("testnet") },
});

export function SuiWalletProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider defaultNetwork="mainnet" networks={networkConfig}>
        <SuiWalletProviderBase>{children}</SuiWalletProviderBase>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
