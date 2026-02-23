"use client";

import * as React from "react";
import type { ReactNode } from "react";

/**
 * Stub wallet/connection state so useSolanaWallet/useSolanaConnection work before
 * the real SolanaWalletProvider loads. This file must NOT import from
 * @solana/wallet-adapter-react so the main bundle doesn't pull in @solana-mobile
 * (chunk 8886). The real provider sets window.__SOLANA_WALLET_CONTEXT and
 * __SOLANA_CONNECTION_CONTEXT when it loads; our hooks use those when set.
 */

declare global {
  interface Window {
    __SOLANA_CONNECTION_CONTEXT?: React.Context<{ connection?: unknown }>;
    __SOLANA_WALLET_CONTEXT?: React.Context<StubWalletState>;
  }
}

/** PublicKey-like (real adapter uses @solana/web3.js PublicKey). Stub uses null. */
export type StubPublicKey = { toBase58(): string } | null;

/** Wallet-like (real has adapter: Adapter with icon, name). Stub uses null. */
export type StubWallet = { adapter: { icon?: string; name?: string } } | null;

/** Minimal wallet-like shape so stub and real context both type-check (real has Wallet[]). */
export interface StubWalletState {
  autoConnect: boolean;
  connect: () => Promise<void>;
  connected: boolean;
  connecting: boolean;
  disconnecting: boolean;
  disconnect: () => Promise<void>;
  publicKey: StubPublicKey;
  select: (name?: string) => void;
  /** matches @solana/wallet-adapter sendTransaction(transaction, connection, options) */
  sendTransaction: (
    transaction: unknown,
    connection: unknown,
    options?: unknown,
  ) => Promise<string>;
  signAllTransactions: undefined;
  /** real adapter provides (message: Uint8Array) => Promise<...>; stub leaves undefined */
  signMessage?: (message: Uint8Array) => Promise<unknown>;
  signIn: undefined;
  signTransaction: undefined;
  wallet: StubWallet;
  wallets: Array<{ adapter: { icon?: string; name?: string }; readyState?: number | string }>;
}

const STUB_WALLET: StubWalletState = {
  autoConnect: false,
  connect: () => Promise.resolve(),
  connected: false,
  connecting: false,
  disconnecting: false,
  disconnect: () => Promise.resolve(),
  publicKey: null,
  select: (_name?: string) => {},
  sendTransaction: async (_transaction, _connection, _options) => {
    throw new Error("Solana wallet not loaded yet");
  },
  signAllTransactions: undefined,
  signIn: undefined,
  signMessage: undefined,
  signTransaction: undefined,
  wallet: null,
  wallets: [] as StubWalletState["wallets"],
};

const STUB_CONNECTION: { connection?: unknown } = { connection: null };

const StubWalletContext = React.createContext<StubWalletState>(STUB_WALLET);
const StubConnectionContext =
  React.createContext<{ connection?: unknown }>(STUB_CONNECTION);

export function useSolanaWallet(): StubWalletState {
  const real = typeof window !== "undefined" && window.__SOLANA_WALLET_CONTEXT
    ? React.useContext(window.__SOLANA_WALLET_CONTEXT)
    : undefined;
  const stub = React.useContext(StubWalletContext);
  return (real ?? stub) as StubWalletState;
}

export function useSolanaConnection(): { connection?: unknown } {
  const real = typeof window !== "undefined" && window.__SOLANA_CONNECTION_CONTEXT
    ? React.useContext(window.__SOLANA_CONNECTION_CONTEXT)
    : undefined;
  const stub = React.useContext(StubConnectionContext);
  return real ?? stub;
}

/**
 * Minimal provider so useSolanaWallet/useSolanaConnection work before the real
 * SolanaWalletProvider loads. Swap to real provider after idle.
 */
export function SolanaWalletStub({ children }: { children: ReactNode }) {
  return (
    <StubConnectionContext.Provider value={STUB_CONNECTION}>
      <StubWalletContext.Provider value={STUB_WALLET}>
        {children}
      </StubWalletContext.Provider>
    </StubConnectionContext.Provider>
  );
}
