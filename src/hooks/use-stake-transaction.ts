"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { base64ToUint8Array } from "~/lib/solana-tx";
import { OPEN_SOLANA_WALLET_MODAL } from "~/ui/components/auth/auth-wallet-modal";

const SEND_OPTS = {
  preflightCommitment: "confirmed" as const,
  skipPreflight: false,
};

export interface UseStakeTransactionOptions {
  onStakeSuccess?: () => void;
  onUnstakeSuccess?: () => void;
}

/**
 * Shared hook for preparing and sending stake/unstake transactions.
 * Used by membership page and token stake page to avoid duplicated fetch/decode/send logic.
 */
export function useStakeTransaction(options: UseStakeTransactionOptions = {}) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const wallet = publicKey?.toBase58() ?? null;

  const [stakePending, setStakePending] = useState(false);
  const [unstakePending, setUnstakePending] = useState(false);

  const openConnectModal = useCallback(() => {
    window.dispatchEvent(new CustomEvent(OPEN_SOLANA_WALLET_MODAL));
  }, []);

  const stake = useCallback(
    async (amount: string, lockDuration: number): Promise<boolean> => {
      if (!wallet || !sendTransaction) {
        openConnectModal();
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
        const data = await res.json().catch(() => ({}));
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
        const txBuf = base64ToUint8Array(data.transaction);
        const tx = Transaction.from(txBuf);
        const sig = await sendTransaction(tx, connection, SEND_OPTS);
        toast.success("Stake submitted: " + sig.slice(0, 8) + "…");
        options.onStakeSuccess?.();
        return true;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Stake failed");
        return false;
      } finally {
        setStakePending(false);
      }
    },
    [
      wallet,
      sendTransaction,
      connection,
      openConnectModal,
      options.onStakeSuccess,
      options.onUnstakeSuccess,
    ],
  );

  const unstake = useCallback(
    async (amount: string): Promise<boolean> => {
      if (!wallet || !sendTransaction) {
        openConnectModal();
        return false;
      }
      const trimmed = amount.trim();
      if (!trimmed || Number.parseFloat(trimmed) <= 0) {
        toast.error("Enter a positive amount");
        return false;
      }
      setUnstakePending(true);
      try {
        const res = await fetch("/api/governance/unstake/prepare", {
          body: JSON.stringify({ amount: trimmed, wallet }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 503) {
            toast.error("Staking is not available yet.");
          } else {
            toast.error(data.error ?? "Failed to prepare unstake");
          }
          return false;
        }
        const txBuf = base64ToUint8Array(data.transaction);
        const tx = Transaction.from(txBuf);
        const sig = await sendTransaction(tx, connection, SEND_OPTS);
        toast.success("Unstake submitted: " + sig.slice(0, 8) + "…");
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
      options.onStakeSuccess,
      options.onUnstakeSuccess,
    ],
  );

  return useMemo(
    () => ({
      openConnectModal,
      stake,
      stakePending,
      unstake,
      unstakePending,
      wallet,
    }),
    [wallet, openConnectModal, stake, unstake, stakePending, unstakePending],
  );
}
