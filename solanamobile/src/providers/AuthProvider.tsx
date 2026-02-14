import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import {
  signInSolanaChallenge,
  signInSolanaVerify,
  getSession,
  signOut as apiSignOut,
} from '../api/auth';
import { useMobileWallet } from './MobileWalletProvider';

type AuthState = {
  isAuthenticated: boolean;
  user: unknown | null;
  isLoading: boolean;
};

type AuthContextValue = AuthState & {
  signInWithSolana: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { address, connected, connect, signMessage, disconnect } = useMobileWallet();
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    isLoading: true,
  });

  const refreshSession = useCallback(async () => {
    try {
      const data = await getSession();
      const session = data && typeof data === 'object' && 'session' in data ? (data as { session?: { user?: unknown } }).session : null;
      const user = data && typeof data === 'object' && 'user' in data ? (data as { user?: unknown }).user : session?.user ?? null;
      setState((s) => ({
        ...s,
        isAuthenticated: !!(session ?? user),
        user: user ?? null,
        isLoading: false,
      }));
    } catch {
      setState((s) => ({ ...s, isAuthenticated: false, user: null, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const signInWithSolana = useCallback(async () => {
    let addr = address;
    if (!addr) {
      addr = await connect();
      if (!addr) return;
    }
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const { message } = await signInSolanaChallenge(addr);
      const messageBytes = new TextEncoder().encode(message);
      const signature = await signMessage(messageBytes);
      const signatureBase58 = await import('bs58').then((m) => m.default.encode(signature));
      await signInSolanaVerify({
        address: addr,
        message,
        signatureBase58,
      });
      await refreshSession();
    } catch (e) {
      console.error('Sign-in failed:', e);
      setState((s) => ({ ...s, isLoading: false }));
      throw e;
    } finally {
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, [address, connect, signMessage, refreshSession]);

  const signOut = useCallback(async () => {
    try {
      await apiSignOut();
    } catch {
      // ignore
    }
    await disconnect();
    setState({ isAuthenticated: false, user: null, isLoading: false });
  }, [disconnect]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signInWithSolana,
      signOut,
      refreshSession,
    }),
    [state, signInWithSolana, signOut, refreshSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
