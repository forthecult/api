"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useSendTransaction,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import {
  parseEther,
  parseUnits,
  formatEther,
  formatUnits,
  type Address,
} from "viem";

import { ERC20ABI } from "~/lib/contracts/abis";

// Token addresses per chain
const TOKEN_ADDRESSES: Record<number, Record<string, Address>> = {
  1: {
    // Ethereum
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  },
  42161: {
    // Arbitrum
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  },
  8453: {
    // Base
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
  137: {
    // Polygon
    USDC: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  },
  56: {
    // BNB
    USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    USDT: "0x55d398326f99059fF775485246999027B3197955",
  },
  10: {
    // Optimism
    USDC: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    USDT: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
  },
  // Testnets
  11155111: {
    // Sepolia
    USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  },
  84532: {
    // Base Sepolia
    USDC: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  },
};

export interface EthPayOrder {
  orderId: string;
  depositAddress: Address;
  chainId: number;
  token: "ETH" | "USDC" | "USDT";
  totalCents: number;
  cryptoAmount?: string | null;
  tokenAddress?: string | null;
  expiresAt: string;
}

export interface PaymentStatus {
  status:
    | "idle"
    | "switching_chain"
    | "sending"
    | "confirming"
    | "polling"
    | "confirmed"
    | "error";
  txHash?: string;
  error?: string;
  message?: string;
}

export interface UseEthPayOptions {
  order: EthPayOrder;
  ethPriceUsd?: number; // Required for ETH payments
  onSuccess?: (txHash: string) => void;
  onError?: (error: string) => void;
}

export function useEthPay({
  order,
  ethPriceUsd,
  onSuccess,
  onError,
}: UseEthPayOptions) {
  const { address, isConnected } = useAccount();
  const currentChainId = useChainId();
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();

  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>({
    status: "idle",
  });
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ETH transfer
  const {
    sendTransactionAsync,
    isPending: isSendingEth,
    error: sendEthError,
  } = useSendTransaction();

  // ERC20 transfer
  const {
    writeContractAsync,
    isPending: isSendingToken,
    error: sendTokenError,
  } = useWriteContract();

  // Wait for transaction receipt
  const {
    isLoading: isWaitingForReceipt,
    isSuccess: isReceiptSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
  });

  // Calculate amounts
  const calculateEthAmount = useCallback((): bigint => {
    if (!ethPriceUsd || ethPriceUsd <= 0) {
      throw new Error("ETH price not available");
    }
    const usd = order.totalCents / 100;
    const ethAmount = usd / ethPriceUsd;
    // Add 1% buffer for price volatility
    const ethWithBuffer = ethAmount * 1.01;
    return parseEther(ethWithBuffer.toFixed(18));
  }, [order.totalCents, ethPriceUsd]);

  const calculateTokenAmount = useCallback((): bigint => {
    if (order.cryptoAmount) {
      return BigInt(order.cryptoAmount);
    }
    // 6 decimals for USDC/USDT
    return BigInt(order.totalCents) * BigInt(10000);
  }, [order.cryptoAmount, order.totalCents]);

  // Get token address for current chain
  const getTokenAddress = useCallback((): Address | null => {
    if (order.token === "ETH") return null;
    if (order.tokenAddress) return order.tokenAddress as Address;
    return TOKEN_ADDRESSES[order.chainId]?.[order.token] ?? null;
  }, [order.token, order.tokenAddress, order.chainId]);

  // Poll for payment confirmation
  const startPolling = useCallback(
    async (hash: string) => {
      setPaymentStatus({
        status: "polling",
        txHash: hash,
        message: "Confirming payment...",
      });

      const poll = async () => {
        try {
          const res = await fetch(
            `/api/checkout/eth-pay/status?orderId=${order.orderId}`,
          );
          const data = await res.json();

          if (data.status === "confirmed" || data.paymentStatus === "paid") {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            setPaymentStatus({
              status: "confirmed",
              txHash: hash,
              message: "Payment confirmed!",
            });
            onSuccess?.(hash);
          } else if (data.status === "expired" || data.status === "cancelled") {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            setPaymentStatus({
              status: "error",
              error: data.message || "Order expired or cancelled",
            });
            onError?.(data.message || "Order expired or cancelled");
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      };

      // Poll immediately, then every 3 seconds
      poll();
      pollIntervalRef.current = setInterval(poll, 3000);
    },
    [order.orderId, onSuccess, onError],
  );

  // Confirm payment with backend
  const confirmPayment = useCallback(
    async (hash: string) => {
      try {
        const res = await fetch("/api/checkout/eth-pay/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: order.orderId,
            txHash: hash,
            payerAddress: address,
          }),
        });

        const data = await res.json();

        if (data.status === "confirmed" || res.ok) {
          setPaymentStatus({
            status: "confirmed",
            txHash: hash,
            message: "Payment confirmed!",
          });
          onSuccess?.(hash);
          return true;
        } else {
          // If confirm fails, start polling
          startPolling(hash);
          return false;
        }
      } catch (err) {
        // If confirm fails, start polling
        startPolling(hash);
        return false;
      }
    },
    [order.orderId, address, onSuccess, startPolling],
  );

  // Send payment
  const sendPayment = useCallback(async () => {
    if (!isConnected || !address) {
      setPaymentStatus({ status: "error", error: "Wallet not connected" });
      onError?.("Wallet not connected");
      return;
    }

    try {
      // Check if we need to switch chains
      if (currentChainId !== order.chainId) {
        setPaymentStatus({
          status: "switching_chain",
          message: "Switching network...",
        });
        try {
          await switchChainAsync({ chainId: order.chainId });
        } catch (err) {
          setPaymentStatus({
            status: "error",
            error: "Failed to switch network",
          });
          onError?.("Failed to switch network. Please switch manually.");
          return;
        }
      }

      setPaymentStatus({
        status: "sending",
        message: "Confirm transaction in your wallet...",
      });

      let hash: `0x${string}`;

      if (order.token === "ETH") {
        // Send ETH
        const amount = calculateEthAmount();
        hash = await sendTransactionAsync({
          to: order.depositAddress,
          value: amount,
        });
      } else {
        // Send ERC20 token
        const tokenAddress = getTokenAddress();
        if (!tokenAddress) {
          throw new Error(`Token ${order.token} not supported on this chain`);
        }

        const amount = calculateTokenAmount();
        hash = await writeContractAsync({
          address: tokenAddress,
          abi: ERC20ABI,
          functionName: "transfer",
          args: [order.depositAddress, amount],
        });
      }

      setTxHash(hash);
      setPaymentStatus({
        status: "confirming",
        txHash: hash,
        message: "Waiting for confirmation...",
      });

      // Try to confirm with backend immediately, or start polling
      // The useWaitForTransactionReceipt hook will also track it
      setTimeout(() => confirmPayment(hash), 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payment failed";
      setPaymentStatus({ status: "error", error: message });
      onError?.(message);
    }
  }, [
    isConnected,
    address,
    currentChainId,
    order,
    switchChainAsync,
    calculateEthAmount,
    calculateTokenAmount,
    getTokenAddress,
    sendTransactionAsync,
    writeContractAsync,
    confirmPayment,
    onError,
  ]);

  // Handle receipt success
  useEffect(() => {
    if (isReceiptSuccess && txHash && paymentStatus.status === "confirming") {
      confirmPayment(txHash);
    }
  }, [isReceiptSuccess, txHash, paymentStatus.status, confirmPayment]);

  // Handle errors
  useEffect(() => {
    const error = sendEthError || sendTokenError || receiptError;
    if (error && paymentStatus.status !== "error") {
      const message = error.message || "Transaction failed";
      setPaymentStatus({ status: "error", error: message });
      onError?.(message);
    }
  }, [
    sendEthError,
    sendTokenError,
    receiptError,
    paymentStatus.status,
    onError,
  ]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Format display amounts
  const displayAmount = useCallback(() => {
    if (order.token === "ETH") {
      try {
        const wei = calculateEthAmount();
        return `${formatEther(wei)} ETH`;
      } catch {
        return "-- ETH";
      }
    }
    const amount = calculateTokenAmount();
    return `${formatUnits(amount, 6)} ${order.token}`;
  }, [order.token, calculateEthAmount, calculateTokenAmount]);

  const needsChainSwitch = currentChainId !== order.chainId;
  const isProcessing =
    isSwitchingChain ||
    isSendingEth ||
    isSendingToken ||
    isWaitingForReceipt ||
    paymentStatus.status === "switching_chain" ||
    paymentStatus.status === "sending" ||
    paymentStatus.status === "confirming" ||
    paymentStatus.status === "polling";

  return {
    sendPayment,
    paymentStatus,
    isProcessing,
    isConnected,
    address,
    needsChainSwitch,
    displayAmount: displayAmount(),
    txHash,
  };
}
