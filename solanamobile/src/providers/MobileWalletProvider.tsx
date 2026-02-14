import type React from 'react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { transact, type Web3MobileWallet } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { PublicKey, type Transaction, type VersionedTransaction } from '@solana/web3.js';
import { toByteArray } from 'react-native-quick-base64';
import { APP_IDENTITY } from '../constants/config';

const AUTH_TOKEN_KEY = 'mwa_auth_token';

type AuthorizationResult = {
  publicKey: PublicKey;
  authToken: string;
  walletUriBase: string;
};

type MobileWalletContextValue = {
  address: string | null;
  publicKey: PublicKey | null;
  connected: boolean;
  connect: () => Promise<string | null>;
  disconnect: () => Promise<void>;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  signAndSendTransactions: (transactions: (Transaction | VersionedTransaction)[]) => Promise<string[]>;
};

const MobileWalletContext = createContext<MobileWalletContextValue | null>(null);

export function MobileWalletProvider({ children }: { children: React.ReactNode }) {
  const [authorization, setAuthorization] = useState<AuthorizationResult | null>(null);

  const connect = useCallback(async (): Promise<string | null> => {
    const storedAuthToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
    const result = await transact(async (wallet: Web3MobileWallet) => {
      const authResult = await wallet.authorize({
        chain: 'solana:mainnet',
        identity: APP_IDENTITY,
        auth_token: storedAuthToken ?? undefined,
      });
      const account = authResult.accounts[0];
      if (!account) throw new Error('No account returned');
      const publicKey = new PublicKey(toByteArray(account.address));
      await SecureStore.setItemAsync(AUTH_TOKEN_KEY, authResult.auth_token);
      return {
        publicKey,
        authToken: authResult.auth_token,
        walletUriBase: authResult.wallet_uri_base,
      };
    });
    setAuthorization(result);
    return result.publicKey.toBase58();
  }, []);

  const disconnect = useCallback(async () => {
    if (authorization?.authToken) {
      try {
        await transact(async (wallet) => {
          await wallet.deauthorize({ auth_token: authorization.authToken });
        });
      } catch {
        // ignore
      }
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    }
    setAuthorization(null);
  }, [authorization?.authToken]);

  const signMessage = useCallback(
    async (message: Uint8Array): Promise<Uint8Array> => {
      if (!authorization) throw new Error('Wallet not connected');
      const [signed] = await transact(async (wallet) => {
        const authResult = await wallet.authorize({
          chain: 'solana:mainnet',
          identity: APP_IDENTITY,
          auth_token: authorization.authToken,
        });
        const address = authResult.accounts[0]?.address;
        if (!address) throw new Error('No account');
        return wallet.signMessages({
          payloads: [message],
          addresses: [address],
        });
      });
      return signed;
    },
    [authorization]
  );

  const signAndSendTransactions = useCallback(
    async (transactions: (Transaction | VersionedTransaction)[]): Promise<string[]> => {
      if (!authorization) throw new Error('Wallet not connected');
      return transact(async (wallet) => {
        await wallet.authorize({
          chain: 'solana:mainnet',
          identity: APP_IDENTITY,
          auth_token: authorization.authToken,
        });
        return wallet.signAndSendTransactions({ transactions });
      });
    },
    [authorization]
  );

  const value = useMemo<MobileWalletContextValue>(
    () => ({
      address: authorization?.publicKey.toBase58() ?? null,
      publicKey: authorization?.publicKey ?? null,
      connected: !!authorization,
      connect,
      disconnect,
      signMessage,
      signAndSendTransactions,
    }),
    [authorization, connect, disconnect, signMessage, signAndSendTransactions]
  );

  return (
    <MobileWalletContext.Provider value={value}>
      {children}
    </MobileWalletContext.Provider>
  );
}

export function useMobileWallet(): MobileWalletContextValue {
  const ctx = useContext(MobileWalletContext);
  if (!ctx) throw new Error('useMobileWallet must be used within MobileWalletProvider');
  return ctx;
}
