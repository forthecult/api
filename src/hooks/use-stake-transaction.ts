"use client";

import { Transaction } from "@solana/web3.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  useSolanaConnection,
  useSolanaWallet,
} from "~/app/checkout/crypto/solana-wallet-stub";
import { base64ToUint8Array } from "~/lib/solana-tx";
import { OPEN_SOLANA_WALLET_MODAL } from "~/ui/components/auth/auth-wallet-modal-events";

const SEND_OPTS = {
  preflightCommitment: "confirmed" as const,
  skipPreflight: false,
};

export interface UseStakeTransactionOptions {
  onRestakeSuccess?: () => void;
  onStakeSuccess?: () => void;
  onUnstakeSuccess?: () => void;
}

/**
 * Shared hook for preparing and sending stake/unstake transactions.
 * Used by membership page and token stake page to avoid duplicated fetch/decode/send logic.
 *
 * Native program notes:
 * - Stake creates a new entry per tier (user can have both 30-day and 12-month stakes)
 * - Unstake withdraws the full amount for a given tier
 * - Restake = unstake old tier + stake to new tier in one tx
 */
export function useStakeTransaction(options: UseStakeTransactionOptions = {}) {
  const { connection } = useSolanaConnection();
  const { publicKey, sendTransaction } = useSolanaWallet();
  const wallet = publicKey?.toBase58() ?? null;

  const [restakePending, setRestakePending] = useState(false);
  const [stakePending, setStakePending] = useState(false);
  const [unstakePending, setUnstakePending] = useState(false);

  // track pending stake params so we can auto-stake after wallet connects
  const pendingStakeRef = useRef<null | {
    amount: string;
    lockDuration: number;
  }>(null);

  const openConnectModal = useCallback(() => {
    window.dispatchEvent(new CustomEvent(OPEN_SOLANA_WALLET_MODAL));
  }, []);

  const executeStake = useCallback(
    async (amount: string, lockDuration: number): Promise<boolean> => {
      if (!wallet || !connection || !sendTransaction) {
        return false;
      }
      const trimmed = amount.trim();
      if (!trimmed || Number.parseFloat(trimmed) <= 0) {
        toast.error("Enter a positive amount");
        return false;
      }
      setStakePending(true);
      try {
        const res = await fetch("/api/governance/stake/prepare", {
          body: JSON.stringify({ amount: trimmed, lockDuration, wallet }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          transaction?: string;
        };
        if (!res.ok) {
          if (res.status === 503) {
            toast.error(
              "Staking is not available yet. Deploy the program and set CULT_STAKING_PROGRAM_ID.",
            );
          } else {
            toast.error(data.error ?? "Failed to prepare stake");
          }
          return false;
        }
        const txBuf = base64ToUint8Array(data.transaction ?? "");
        const tx = Transaction.from(txBuf);
        const sig = await sendTransaction(tx, connection, SEND_OPTS);
        toast.success(`Stake submitted: ${sig.slice(0, 8)}…`);

        // link the staking wallet to the current account. requires a session —
        // if none, we nudge the user into SIWS instead of auto-signing them in
        // (that path used to be an auth-bypass; see route docblock).
        fetch("/api/auth/link-solana-wallet", {
          body: JSON.stringify({ wallet }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        })
          .then((res) => res.json().then((raw) => ({ raw, status: res.status })))
          .then(({ raw, status }) => {
            const data = raw as {
              alreadyLinked?: boolean;
              linked?: boolean;
              needsSignIn?: boolean;
            };
            if (data.linked) {
              if (!data.alreadyLinked) {
                window.dispatchEvent(new CustomEvent("auth-state-changed"));
              }
              return;
            }
            if (data.needsSignIn || status === 401 || status === 409) {
              toast.message("Sign in to link this wallet to your account.", {
                action: {
                  label: "Sign in",
                  onClick: () => openConnectModal(),
                },
              });
            }
          })
          .catch(() => {
            // best-effort — staking itself already succeeded on chain.
          });

        options.onStakeSuccess?.();
        return true;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Stake failed");
        return false;
      } finally {
        setStakePending(false);
      }
    },
    [wallet, sendTransaction, connection, options.onStakeSuccess],
  );

  // auto-execute pending stake when wallet connects
  useEffect(() => {
    if (!wallet || !sendTransaction || !pendingStakeRef.current) return;
    const { amount, lockDuration } = pendingStakeRef.current;
    pendingStakeRef.current = null;
    executeStake(amount, lockDuration);
  }, [wallet, sendTransaction, executeStake]);

  const stake = useCallback(
    async (amount: string, lockDuration: number): Promise<boolean> => {
      if (!wallet || !sendTransaction) {
        // store pending stake params and open connect modal
        pendingStakeRef.current = { amount, lockDuration };
        openConnectModal();
        return false;
      }
      return executeStake(amount, lockDuration);
    },
    [wallet, sendTransaction, openConnectModal, executeStake],
  );

  /**
   * Unstake tokens for a given tier.
   * Native program withdraws full amount for the tier — no partial unstake.
   * @param lockTier 0 = 30 days, 1 = 12 months
   */
  const unstake = useCallback(
    async (lockTier: number): Promise<boolean> => {
      if (!wallet || !connection || !sendTransaction) {
        openConnectModal();
        return false;
      }
      setUnstakePending(true);
      try {
        const res = await fetch("/api/governance/unstake/prepare", {
          body: JSON.stringify({ lockTier, wallet }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          transaction?: string;
        };
        if (!res.ok) {
          if (res.status === 503) {
            toast.error("Staking is not available yet.");
          } else {
            toast.error(data.error ?? "Failed to prepare unstake");
          }
          return false;
        }
        const txBuf = base64ToUint8Array(data.transaction ?? "");
        const tx = Transaction.from(txBuf);
        const sig = await sendTransaction(tx, connection, SEND_OPTS);
        toast.success(`Unstake submitted: ${sig.slice(0, 8)}…`);
        options.onUnstakeSuccess?.();
        return true;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Unstake failed");
        return false;
      } finally {
        setUnstakePending(false);
      }
    },
    [
      wallet,
      sendTransaction,
      connection,
      openConnectModal,
      options.onUnstakeSuccess,
    ],
  );

  /**
   * Restake: unstake from old tier and stake to new tier in one transaction.
   * Only works when the lock has expired.
   * @param lockTier Current tier to unstake from (0 = 30 days, 1 = 12 months)
   * @param newLockDuration New lock duration in seconds
   */
  const restake = useCallback(
    async (lockTier: number, newLockDuration: number): Promise<boolean> => {
      if (!wallet || !connection || !sendTransaction) {
        openConnectModal();
        return false;
      }
      setRestakePending(true);
      try {
        const res = await fetch("/api/governance/restake/prepare", {
          body: JSON.stringify({
            lockTier,
            newLockDuration,
            wallet,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          transaction?: string;
        };
        if (!res.ok) {
          if (res.status === 503) {
            toast.error("Staking is not available yet.");
          } else {
            toast.error(data.error ?? "Failed to prepare restake");
          }
          return false;
        }
        const txBuf = base64ToUint8Array(data.transaction ?? "");
        const tx = Transaction.from(txBuf);
        const sig = await sendTransaction(tx, connection, SEND_OPTS);
        toast.success(`Restake submitted: ${sig.slice(0, 8)}…`);
        options.onRestakeSuccess?.();
        return true;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Restake failed");
        return false;
      } finally {
        setRestakePending(false);
      }
    },
    [
      wallet,
      sendTransaction,
      connection,
      openConnectModal,
      options.onRestakeSuccess,
    ],
  );

  return useMemo(
    () => ({
      openConnectModal,
      restake,
      restakePending,
      stake,
      stakePending,
      unstake,
      unstakePending,
      wallet,
    }),
    [
      wallet,
      openConnectModal,
      stake,
      unstake,
      restake,
      stakePending,
      unstakePending,
      restakePending,
    ],
  );
}
