"use client";

import type { ReactNode } from "react";
import { WalletContext } from "@solana/wallet-adapter-react";

/**
 * Stub value that matches WalletContextState so useWallet() doesn't throw.
 * Used only until the real SolanaWalletProvider chunk loads (after idle).
 */
const STUB_VALUE = {
  autoConnect: false,
  connected: false,
  connecting: false,
  disconnecting: false,
  publicKey: null,
  wallet: null,
  wallets: [] as never[],
  select: () => {},
  connect: () => Promise.resolve(),
  disconnect: () => Promise.resolve(),
  sendTransaction: async () => {
    throw new Error("Solana wallet not loaded yet");
  },
  signTransaction: undefined,
  signAllTransactions: undefined,
  signMessage: undefined,
  signIn: undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- stub matches WalletContextState
} as any;

/**
 * Minimal provider that supplies WalletContext so useWallet() works before
 * the real SolanaWalletProvider loads. Swap to real provider after idle.
 */
export function SolanaWalletStub({ children }: { children: ReactNode }) {
  return (
    <WalletContext.Provider value={STUB_VALUE}>
      {children}
    </WalletContext.Provider>
  );
}
