"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type Address,
  formatEther,
  formatUnits,
  parseEther,
  parseUnits,
} from "viem";
import {
  useAccount,
  useChainId,
  useSendTransaction,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

import { ERC20ABI } from "~/lib/contracts/abis";

// Token addresses per chain
const TOKEN_ADDRESSES: Record<number, Record<string, Address>> = {
  1: {
    // Ethereum
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  },
  10: {
    // Optimism
    USDC: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    USDT: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
  },
  56: {
    // BNB
    USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    USDT: "0x55d398326f99059fF775485246999027B3197955",
  },
  137: {
    // Polygon
    USDC: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  },
  8453: {
    // Base
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
  42161: {
    // Arbitrum
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  },
  84532: {
    // Base Sepolia
    USDC: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  },
  // Testnets
  11155111: {
    // Sepolia
    USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  },
};

export interface EthPayOrder {
  chainId: number;
  cryptoAmount?: null | string;
  depositAddress: Address;
  expiresAt: string;
  orderId: string;
  token: "ETH" | "USDC" | "USDT";
  tokenAddress?: null | string;
  totalCents: number;
}

export interface PaymentStatus {
  error?: string;
  message?: string;
  status:
    | "confirmed"
    | "confirming"
    | "error"
    | "idle"
    | "polling"
    | "sending"
    | "switching_chain";
  txHash?: string;
}

export interface UseEthPayOptions {
  ethPriceUsd?: number; // Required for ETH payments
  onError?: (error: string) => void;
  onSuccess?: (txHash: string) => void;
  order: EthPayOrder;
}

export function useEthPay({
  ethPriceUsd,
  onError,
  onSuccess,
  order,
}: UseEthPayOptions) {
  const { address, isConnected } = useAccount();
  const currentChainId = useChainId();
  const { isPending: isSwitchingChain, switchChainAsync } = useSwitchChain();

  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>({
    status: "idle",
  });
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const pollIntervalRef = useRef<null | ReturnType<typeof setInterval>>(null);

  // ETH transfer
  const {
    error: sendEthError,
    isPending: isSendingEth,
    sendTransactionAsync,
  } = useSendTransaction();

  // ERC20 transfer
  const {
    error: sendTokenError,
    isPending: isSendingToken,
    writeContractAsync,
  } = useWriteContract();

  // Wait for transaction receipt
  const {
    error: receiptError,
    isLoading: isWaitingForReceipt,
    isSuccess: isReceiptSuccess,
  } = useWaitForTransactionReceipt({
    confirmations: 1,
    hash: txHash,
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
        message: "Confirming payment...",
        status: "polling",
        txHash: hash,
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
              message: "Payment confirmed!",
              status: "confirmed",
              txHash: hash,
            });
            onSuccess?.(hash);
          } else if (data.status === "expired" || data.status === "cancelled") {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            setPaymentStatus({
              error: data.message || "Order expired or cancelled",
              status: "error",
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
          body: JSON.stringify({
            orderId: order.orderId,
            payerAddress: address,
            txHash: hash,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });

        const data = await res.json();

        if (data.status === "confirmed" || res.ok) {
          setPaymentStatus({
            message: "Payment confirmed!",
            status: "confirmed",
            txHash: hash,
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
      setPaymentStatus({ error: "Wallet not connected", status: "error" });
      onError?.("Wallet not connected");
      return;
    }

    try {
      // Check if we need to switch chains
      if (currentChainId !== order.chainId) {
        setPaymentStatus({
          message: "Switching network...",
          status: "switching_chain",
        });
        try {
          await switchChainAsync({ chainId: order.chainId });
        } catch (err) {
          setPaymentStatus({
            error: "Failed to switch network",
            status: "error",
          });
          onError?.("Failed to switch network. Please switch manually.");
          return;
        }
      }

      setPaymentStatus({
        message: "Confirm transaction in your wallet...",
        status: "sending",
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
          abi: ERC20ABI,
          address: tokenAddress,
          args: [order.depositAddress, amount],
          functionName: "transfer",
        });
      }

      setTxHash(hash);
      setPaymentStatus({
        message: "Waiting for confirmation...",
        status: "confirming",
        txHash: hash,
      });

      // Try to confirm with backend immediately, or start polling
      // The useWaitForTransactionReceipt hook will also track it
      setTimeout(() => confirmPayment(hash), 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payment failed";
      setPaymentStatus({ error: message, status: "error" });
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
      setPaymentStatus({ error: message, status: "error" });
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
    address,
    displayAmount: displayAmount(),
    isConnected,
    isProcessing,
    needsChainSwitch,
    paymentStatus,
    sendPayment,
    txHash,
  };
}
