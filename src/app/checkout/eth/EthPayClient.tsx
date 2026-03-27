"use client";

import { AlertCircle, CheckCircle2, ChevronRight, Loader2 } from "lucide-react";
import { ChevronDown } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  useAccount,
  useChainId,
  useConnect,
  useConnection,
  useConnectors,
  useDisconnect,
} from "wagmi";

import { SEO_CONFIG } from "~/app";
import { useCurrentUser } from "~/lib/auth-client";
import { type EthPayOrder, useEthPay } from "~/lib/hooks/use-eth-pay";
import { useSDK } from "~/lib/metamask-sdk";
import { Button } from "~/ui/primitives/button";
import { Dialog, DialogContent, DialogTitle } from "~/ui/primitives/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/ui/primitives/dropdown-menu";

const METAMASK_LOGO =
  "https://images.ctfassets.net/clixtyxoaeas/4rnpEzy1ATWRKVBOLxZ1Fm/a74dc1eed36d23d7ea6030383a4d5163/MetaMask-icon-fox.svg";
const PHANTOM_LOGO = "https://phantom.app/img/logo.png";
const SUI_LOGO = "/crypto/sui/sui-logo.svg";

const ETH_USD_FALLBACK = 3500;

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}.....${address.slice(-4)}`;
}

const CHAIN_LABELS: Record<string, string> = {
  arbitrum: "Arbitrum",
  base: "Base",
  ethereum: "Ethereum",
  polygon: "Polygon",
};

const TOKEN_LABELS: Record<string, string> = {
  eth: "ETH",
  usdc: "USDC",
  usdt: "USDT",
};

const MULTI_CHAIN_WALLET_NAMES = new Set([
  "Ctrl Wallet",
  "Phantom",
  "Ronin Wallet",
  "Trust Wallet",
]);

interface OrderData {
  chain: string;
  chainId?: number;
  cryptoAmount?: null | string;
  depositAddress: string;
  email?: string;
  expiresAt: string;
  orderId: string;
  paymentStatus?: string;
  token: string;
  tokenAddress?: null | string;
  totalCents: number;
}

function ConnectorIcon({
  className,
  connector,
}: {
  className?: string;
  connector: { icon?: string; name: string; type: string };
}) {
  if (connector.name === "MetaMask") {
    return (
      <img
        alt="MetaMask"
        className={className}
        height={32}
        src={METAMASK_LOGO}
        width={32}
      />
    );
  }
  if (connector.icon) {
    return (
      <img
        alt=""
        className={className}
        height={32}
        src={connector.icon}
        width={32}
      />
    );
  }
  if (connector.type === "walletConnect") {
    return (
      <div
        aria-hidden
        className={`
          flex size-8 items-center justify-center rounded-md bg-[#3396FF]
          text-white
          ${className ?? ""}
        `}
      >
        <svg
          aria-hidden
          className="size-5"
          fill="currentColor"
          viewBox="0 0 32 32"
        >
          <path d="M9.5 12.5a4.5 4.5 0 1 1 4.5 4.5h-4.5v-4.5Zm13 0v4.5h4.5a4.5 4.5 0 1 0-4.5-4.5Zm-13 13a4.5 4.5 0 1 0 4.5-4.5h-4.5v4.5Zm13-4.5a4.5 4.5 0 1 1-4.5 4.5v-4.5h4.5Z" />
        </svg>
      </div>
    );
  }
  return (
    <Image
      alt={connector.name}
      className={className ?? "size-8 shrink-0 rounded-md object-contain"}
      height={32}
      src="/crypto/ethereum/ethereum-logo.svg"
      width={32}
    />
  );
}

// Chain ID mapping
const CHAIN_ID_MAP: Record<string, number> = {
  arbitrum: 42161,
  base: 8453,
  bnb: 56,
  ethereum: 1,
  optimism: 10,
  polygon: 137,
};

function normalizeEthOrder(
  data: Record<string, unknown> & Partial<OrderData>,
): OrderData {
  const chainRaw = data.chain ?? data.cryptoCurrencyNetwork ?? "ethereum";
  const chainName = String(chainRaw).toLowerCase();
  const tokenRaw = data.token ?? data.cryptoCurrency ?? "eth";
  return {
    chain: chainName,
    chainId: (data.chainId as number) ?? CHAIN_ID_MAP[chainName] ?? 1,
    cryptoAmount: data.cryptoAmount,
    depositAddress:
      (data.depositAddress as string) ??
      (data.solanaPayDepositAddress as string) ??
      "",
    email: data.email,
    expiresAt: String(data.expiresAt ?? ""),
    orderId: String(data.orderId ?? data.id ?? ""),
    paymentStatus: data.paymentStatus,
    token: String(tokenRaw).toLowerCase(),
    tokenAddress: data.tokenAddress,
    totalCents: Number(data.totalCents) || 0,
  };
}

export function EthPayClient({
  initialOrder,
}: { initialOrder?: Record<string, unknown> } = {}) {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = (params?.invoiceId as string) ?? "";

  const [order, setOrder] = useState<null | OrderData>(() =>
    initialOrder ? normalizeEthOrder(initialOrder) : null,
  );
  const [orderLoading, setOrderLoading] = useState(!initialOrder);
  const [orderError, setOrderError] = useState<null | string>(null);

  useEffect(() => {
    if (initialOrder) return;
    if (!orderId) {
      setOrderLoading(false);
      setOrderError("No order ID");
      return;
    }

    let cancelled = false;
    setOrderLoading(true);
    setOrderError(null);

    fetch(`/api/checkout/orders/${encodeURIComponent(orderId)}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) throw new Error("Order not found");
          throw new Error("Failed to load order");
        }
        return res.json();
      })
      .then((raw: unknown) => {
        if (cancelled) return;
        setOrder(
          normalizeEthOrder(
            raw as Record<string, unknown> & Partial<OrderData>,
          ),
        );
        setOrderLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setOrderError(
          err instanceof Error ? err.message : "Failed to load order",
        );
        setOrderLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [orderId, initialOrder]);

  const amountUsd = order ? order.totalCents / 100 : 0;
  const chain = (order?.chain || "ethereum").toLowerCase();
  const token = (order?.token || "eth").toLowerCase();
  const depositAddress = order?.depositAddress || "";

  const [ethUsdRate, setEthUsdRate] = useState<null | number>(null);

  const chainLabel = CHAIN_LABELS[chain] ?? chain;
  const tokenLabel = TOKEN_LABELS[token] ?? token.toUpperCase();
  const isStablecoin = token === "usdc" || token === "usdt";
  const amountUsdStr = amountUsd.toFixed(2);
  const paymentTitle = `Pay with ${tokenLabel} (${chainLabel})`;

  const { address: wagmiAddress } = useConnection();
  const connectors = useConnectors();
  const { isPending: wagmiConnecting, mutate: connect } = useConnect();
  const { disconnect } = useDisconnect();
  const sdkState = useSDK();
  const sdk = sdkState?.sdk;
  const metaMaskConnected = sdkState?.connected ?? false;
  const metaMaskConnecting = sdkState?.connecting ?? false;
  const metaMaskAccounts =
    (sdkState as { accounts?: string[] })?.accounts ?? undefined;
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [connectStep, setConnectStep] = useState<"network" | "wallets">(
    "wallets",
  );
  const [multiChainConnectorForNetwork, setMultiChainConnectorForNetwork] =
    useState<null | ReturnType<typeof useConnectors>[number]>(null);
  // Track if wallet was connected when modal opened (to avoid auto-closing when adding new wallet)
  const [wasConnectedOnModalOpen, setWasConnectedOnModalOpen] = useState(false);

  const metaMaskAddress = metaMaskAccounts?.[0] ?? null;
  const address = metaMaskAddress ?? wagmiAddress ?? undefined;
  const connecting = metaMaskConnecting || wagmiConnecting;
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Detect if MetaMask extension is installed
  const [isMetaMaskDetected, setIsMetaMaskDetected] = useState(false);
  useEffect(() => {
    setIsMetaMaskDetected(
      Boolean(typeof window !== "undefined" && window.ethereum?.isMetaMask),
    );
  }, []);

  const rate = ethUsdRate ?? ETH_USD_FALLBACK;
  const amountEth = amountUsd > 0 && rate > 0 ? amountUsd / rate : 0;
  const amountEthStr = amountEth.toFixed(6);
  const rateLabel = `1 ETH = ${rate.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} USD`;

  const ethPayOrderForHook: EthPayOrder | null = order
    ? {
        chainId: order.chainId ?? 1,
        cryptoAmount: order.cryptoAmount ?? null,
        depositAddress: order.depositAddress as `0x${string}`,
        expiresAt: order.expiresAt,
        orderId: order.orderId,
        token:
          order.token === "usdc"
            ? "USDC"
            : order.token === "usdt"
              ? "USDT"
              : "ETH",
        tokenAddress: order.tokenAddress ?? null,
        totalCents: order.totalCents,
      }
    : null;

  const {
    displayAmount,
    isProcessing,
    needsChainSwitch,
    paymentStatus,
    sendPayment,
    txHash: paymentTxHash,
  } = useEthPay({
    ethPriceUsd: rate,
    onError: () => {},
    onSuccess: (txHash) => {
      router.push(`/checkout/${orderId}/confirmation?tx=${txHash}`);
    },
    order: ethPayOrderForHook ?? {
      chainId: 1,
      depositAddress:
        "0x0000000000000000000000000000000000000000" as `0x${string}`,
      expiresAt: new Date().toISOString(),
      orderId: "",
      token: "ETH",
      totalCents: 0,
    },
  });

  const { user } = useCurrentUser();
  const email = user?.email ?? order?.email ?? "";

  // Use cached /api/crypto/prices for ETH rate (server caches 60s)
  useEffect(() => {
    fetch("/api/crypto/prices")
      .then((res) => res.json())
      .then((raw: unknown) => { const data = raw as { ETH?: number };
        if (typeof data?.ETH === "number" && data.ETH > 0)
          setEthUsdRate(data.ETH);
      })
      .catch(() => setEthUsdRate(ETH_USD_FALLBACK));
  }, []);

  // Track connection state when modal opens
  useEffect(() => {
    if (connectModalOpen) {
      setWasConnectedOnModalOpen(!!address);
    }
  }, [connectModalOpen, address]);

  // Auto-close modal only if a NEW connection was made (not if already connected)
  useEffect(() => {
    if (connectModalOpen && address && !wasConnectedOnModalOpen) {
      setConnectModalOpen(false);
    }
  }, [address, connectModalOpen, wasConnectedOnModalOpen]);

  // Open connect modal if hash contains openConnect or query param (legacy)
  useEffect(() => {
    const hashHasOpenConnect =
      typeof window !== "undefined" &&
      window.location.hash.includes("openConnect");
    if (searchParams.get("openConnect") === "1" || hashHasOpenConnect) {
      setConnectModalOpen(true);
    }
  }, [searchParams]);

  const handleAddNewWallet = useCallback(() => {
    setDropdownOpen(false);
    // Small delay to let dropdown close animation complete
    setTimeout(() => {
      setConnectModalOpen(true);
    }, 100);
  }, []);

  const handleOpenConnectModal = useCallback(() => {
    setConnectStep("wallets");
    setMultiChainConnectorForNetwork(null);
    setConnectModalOpen(true);
  }, []);

  const handleSelectConnector = useCallback(
    async (connector: (typeof connectors)[number]) => {
      if (connector.name === "MetaMask" && sdk) {
        try {
          await sdk.connect();
        } catch {
          // user may have rejected
        }
        return;
      }
      if (connector.name === "Phantom") {
        setMultiChainConnectorForNetwork(connector);
        setConnectStep("network");
        return;
      }
      connect({ connector });
    },
    [connect, sdk],
  );

  const handleMetaMaskClick = useCallback(async () => {
    if (sdk) {
      try {
        await sdk.connect();
      } catch {
        // user may have rejected
      }
    }
  }, [sdk]);

  const handlePhantomClick = useCallback(() => {
    const phantom = connectors.find((c) => c.name === "Phantom");
    if (phantom) {
      setMultiChainConnectorForNetwork(phantom);
      setConnectStep("network");
    } else {
      setConnectModalOpen(false);
      router.push(`/checkout/${orderId}`);
    }
  }, [connectors, orderId, router]);

  const handleNetworkEvms = useCallback(() => {
    if (multiChainConnectorForNetwork) {
      connect({ connector: multiChainConnectorForNetwork });
      setMultiChainConnectorForNetwork(null);
      setConnectStep("wallets");
    }
  }, [connect, multiChainConnectorForNetwork]);

  const handleNetworkSolana = useCallback(() => {
    setConnectModalOpen(false);
    setMultiChainConnectorForNetwork(null);
    setConnectStep("wallets");
    router.push(`/checkout/${orderId}`);
  }, [orderId, router]);

  const handleNetworkSui = useCallback(() => {
    setConnectModalOpen(false);
    setMultiChainConnectorForNetwork(null);
    setConnectStep("wallets");
    const amount = amountUsd.toFixed(2);
    const expires = Date.now() + 60 * 60 * 1000;
    router.push(`/checkout/${orderId}#sui-${amount}-${expires}`);
  }, [orderId, router, amountUsd]);

  const metaMaskConnector = connectors.find((c) => c.name === "MetaMask");
  const phantomConnector = connectors.find((c) => c.name === "Phantom");
  const othersConnectors = connectors.filter(
    (c) =>
      c.name !== "MetaMask" &&
      c.name !== "Phantom" &&
      c.name !== "Injected" &&
      (c.type === "walletConnect" || c.type === "injected"),
  );

  // Loading state
  if (orderLoading) {
    return (
      <div
        className={`
        flex min-h-screen w-full items-center justify-center bg-background
      `}
      >
        <div className="space-y-4 text-center">
          <div
            className={`
            mx-auto size-8 animate-spin rounded-full border-4 border-primary
            border-t-transparent
          `}
          />
          <p className="text-muted-foreground">Loading order...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (orderError || !order) {
    return (
      <div
        className={`
        flex min-h-screen w-full items-center justify-center bg-background
      `}
      >
        <div className="max-w-md space-y-4 px-4 text-center">
          <div className="text-4xl text-destructive">⚠️</div>
          <h1 className="text-xl font-semibold">Order Not Found</h1>
          <p className="text-muted-foreground">
            {orderError || "This order could not be found or has expired."}
          </p>
          <Button onClick={() => router.push("/checkout")} variant="outline">
            Return to Checkout
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background">
      <header
        className={`
        sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur
        supports-[backdrop-filter]:bg-background/60
      `}
      >
        <div
          className={`
          container mx-auto max-w-7xl px-4
          sm:px-6
          lg:px-8
        `}
        >
          <div className="flex h-16 items-center justify-between">
            <Link
              aria-label="Back to checkout"
              className={`
                rounded p-1 text-muted-foreground
                hover:bg-muted hover:text-foreground
              `}
              href="/checkout"
            >
              <svg
                aria-hidden
                className="size-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M15 19l-7-7 7-7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
            </Link>
            <Link className="flex items-center gap-2" href="/">
              {SEO_CONFIG.brandLogoUrl ? (
                <Image
                  alt={SEO_CONFIG.name}
                  className="h-8 w-auto object-contain"
                  height={32}
                  src={SEO_CONFIG.brandLogoUrl}
                  width={140}
                />
              ) : (
                <span
                  className={`
                  font-heading text-lg font-bold tracking-[0.2em] text-[#1A1611]
                  uppercase
                  dark:text-[#F5F1EB]
                `}
                >
                  {SEO_CONFIG.name}
                </span>
              )}
            </Link>
            {address ? (
              <DropdownMenu onOpenChange={setDropdownOpen} open={dropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    className={`
                      gap-2 font-mono shadow-none
                      hover:shadow-none
                      focus:shadow-none
                      focus-visible:shadow-none
                      active:shadow-none
                    `}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <span className="text-muted-foreground">
                      {truncateAddress(address)}
                    </span>
                    <ChevronDown className="size-4 shrink-0 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel
                    className={`
                    text-xs font-medium tracking-wider text-muted-foreground
                    uppercase
                  `}
                  >
                    Connected
                  </DropdownMenuLabel>
                  <div
                    className={`
                    flex items-center justify-between gap-2 px-2 py-2
                  `}
                  >
                    <span
                      className={`
                        min-w-0 truncate font-mono text-sm text-foreground
                      `}
                      title={address}
                    >
                      {truncateAddress(address)}
                    </span>
                    <Button
                      className="shrink-0"
                      onClick={() => disconnect()}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Disconnect
                    </Button>
                  </div>
                  <DropdownMenuSeparator />
                  <button
                    className={`
                      block w-full rounded-sm px-2 py-1.5 text-left text-sm
                      font-medium
                      hover:bg-accent hover:text-accent-foreground
                    `}
                    onClick={handleAddNewWallet}
                    type="button"
                  >
                    Add a new wallet
                  </button>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                className={`
                  border border-border shadow-none
                  hover:shadow-none
                  focus:shadow-none
                  focus-visible:shadow-none
                  active:shadow-none
                `}
                disabled={connecting}
                onClick={handleOpenConnectModal}
                type="button"
                variant="ghost"
              >
                {connecting ? "Connecting…" : "Connect wallet"}
              </Button>
            )}
          </div>
        </div>
      </header>

      <div
        className={`
        mx-auto w-full max-w-6xl px-4 py-8
        sm:px-5
      `}
      >
        <div
          className={`
          flex min-w-0 flex-col gap-6
          min-[560px]:flex-row min-[560px]:items-start
        `}
        >
          <div
            className={`
            min-w-0 flex-1 rounded-xl border border-border bg-card p-6
            min-[560px]:min-w-[560px]
          `}
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Image
                  alt={tokenLabel}
                  className="h-8 w-10 shrink-0 object-contain"
                  height={32}
                  src="/crypto/ethereum/ethereum-logo.svg"
                  width={40}
                />
                <h1
                  className={`
                  text-2xl font-semibold tracking-tight
                  md:text-3xl
                `}
                >
                  {paymentTitle}
                </h1>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <h2 className="mb-4 text-base font-semibold">
                  Payment details
                </h2>
                <div className="space-y-4 text-base">
                  <div>
                    <p className="mb-1 text-muted-foreground">Amount to pay</p>
                    <p className="font-mono font-medium">
                      {isStablecoin
                        ? `${amountUsdStr} ${tokenLabel}`
                        : `${amountEthStr} ETH`}
                    </p>
                    {!isStablecoin && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        ≈ USD {amountUsdStr}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment Status Messages */}
              {paymentStatus.status === "confirmed" && (
                <div
                  className={`
                  flex items-center gap-3 rounded-lg border border-green-500/30
                  bg-green-500/10 p-4 text-green-700
                  dark:text-green-400
                `}
                >
                  <CheckCircle2 className="size-5 shrink-0" />
                  <div>
                    <p className="font-medium">Payment confirmed!</p>
                    <p className="text-sm opacity-80">
                      Redirecting to order confirmation...
                    </p>
                  </div>
                </div>
              )}

              {paymentStatus.status === "error" && (
                <div
                  className={`
                  flex items-center gap-3 rounded-lg border
                  border-destructive/30 bg-destructive/10 p-4 text-destructive
                `}
                >
                  <AlertCircle className="size-5 shrink-0" />
                  <div>
                    <p className="font-medium">Payment failed</p>
                    <p className="text-sm opacity-80">{paymentStatus.error}</p>
                  </div>
                </div>
              )}

              <div className="flex justify-center">
                {!address ? (
                  <Button
                    className="min-w-[12rem]"
                    disabled={connecting}
                    onClick={handleOpenConnectModal}
                    size="lg"
                    type="button"
                  >
                    {connecting ? "Connecting…" : "Connect wallet"}
                  </Button>
                ) : paymentStatus.status === "confirmed" ? (
                  <Button
                    className="min-w-[12rem]"
                    disabled
                    size="lg"
                    type="button"
                  >
                    <CheckCircle2 className="mr-2 size-4" />
                    Payment Complete
                  </Button>
                ) : (
                  <Button
                    className="min-w-[12rem]"
                    disabled={isProcessing || !order}
                    onClick={sendPayment}
                    size="lg"
                    type="button"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        {paymentStatus.status === "switching_chain" &&
                          "Switching network..."}
                        {paymentStatus.status === "sending" &&
                          "Confirm in wallet..."}
                        {paymentStatus.status === "confirming" &&
                          "Confirming..."}
                        {paymentStatus.status === "polling" &&
                          "Verifying payment..."}
                        {paymentStatus.status === "idle" && "Processing..."}
                      </>
                    ) : needsChainSwitch ? (
                      `Switch to ${chainLabel} & Pay`
                    ) : (
                      `Pay ${displayAmount || `${isStablecoin ? amountUsdStr : amountEthStr} ${tokenLabel}`}`
                    )}
                  </Button>
                )}
              </div>

              {/* Transaction hash display */}
              {paymentTxHash && (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Transaction:{" "}
                    <a
                      className={`
                        font-mono text-primary
                        hover:underline
                      `}
                      href={`https://${chain === "ethereum" ? "" : chain + "."}etherscan.io/tx/${paymentTxHash}`}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {paymentTxHash.slice(0, 10)}...{paymentTxHash.slice(-8)}
                    </a>
                  </p>
                </div>
              )}
            </div>
          </div>

          <div
            className={`
            min-w-0 shrink-0
            min-[560px]:sticky min-[560px]:top-8 min-[560px]:w-[510px]
            min-[560px]:self-start
          `}
          >
            <div className="rounded-xl border border-border bg-card px-6 py-5">
              <h2 className="mb-4 text-xl font-semibold">Order details</h2>
              <dl className="space-y-3 text-base">
                <div
                  className={`
                  flex flex-wrap items-center justify-between gap-2
                `}
                >
                  <dt className="text-muted-foreground">Email address</dt>
                  <dd className="flex items-center gap-2">
                    <span>{email || "—"}</span>
                    {!user?.email && (
                      <button
                        className={`
                          text-primary underline
                          hover:underline
                        `}
                        onClick={() => router.push("/checkout")}
                        type="button"
                      >
                        Change
                      </button>
                    )}
                  </dd>
                </div>
                <div
                  className={`
                  flex flex-wrap items-center justify-between gap-2
                `}
                >
                  <dt className="text-muted-foreground">Payment method</dt>
                  <dd className="flex items-center gap-2">
                    <span>
                      {tokenLabel} ({chainLabel})
                    </span>
                    <button
                      className={`
                        text-primary underline
                        hover:underline
                      `}
                      onClick={() => router.push("/checkout")}
                      type="button"
                    >
                      Change
                    </button>
                  </dd>
                </div>
                <div
                  className={`
                  flex flex-wrap items-center justify-between gap-2
                `}
                >
                  <dt className="text-muted-foreground">Invoice id</dt>
                  <dd>
                    <code className="font-mono text-xs break-all">
                      {orderId || "—"}
                    </code>
                  </dd>
                </div>
                <div
                  className={`
                  flex flex-wrap items-center justify-between gap-2 border-t
                  border-border pt-3
                `}
                >
                  <dt className="text-muted-foreground">Fiat value</dt>
                  <dd className="font-medium">
                    USD {amountUsd > 0 ? amountUsd.toFixed(2) : "0.00"}
                  </dd>
                </div>
                <div
                  className={`
                  flex flex-wrap items-center justify-between gap-2 text-lg
                `}
                >
                  <dt className="font-medium">Total</dt>
                  <dd className="font-semibold">
                    {isStablecoin
                      ? `${amountUsdStr} ${tokenLabel}`
                      : `${amountEthStr} ETH`}
                  </dd>
                </div>
              </dl>
              {!isStablecoin && (
                <p
                  className={`
                  mt-4 flex items-center gap-2 text-sm text-muted-foreground
                `}
                >
                  We&apos;ve converted this price from USD to ETH at our rate of
                  approximately {rateLabel}.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setConnectStep("wallets");
            setMultiChainConnectorForNetwork(null);
          }
          setConnectModalOpen(open);
        }}
        open={connectModalOpen}
      >
        <DialogContent
          aria-describedby={undefined}
          className={`
            max-w-[400px] gap-0 border-border bg-card p-0
            sm:max-w-[400px]
          `}
        >
          <div
            className={`
            flex items-center gap-2 border-b border-border px-5 py-4
          `}
          >
            {connectStep === "network" && (
              <button
                aria-label="Back"
                className={`
                  -ml-1 rounded p-1 text-muted-foreground
                  hover:bg-muted hover:text-foreground
                `}
                onClick={() => setConnectStep("wallets")}
                type="button"
              >
                <ChevronRight className="size-5 rotate-180" />
              </button>
            )}
            <DialogTitle className="text-lg font-semibold">
              {connectStep === "network" ? "Select network" : "Connect wallet"}
            </DialogTitle>
          </div>
          <div className="flex flex-col gap-4 px-5 py-4">
            {connectStep === "wallets" ? (
              <>
                <div>
                  <p
                    className={`
                    mb-2 text-xs font-medium tracking-wider
                    text-muted-foreground uppercase
                  `}
                  >
                    Suggested
                  </p>
                  <div className="flex flex-col gap-2">
                    <button
                      className={`
                        flex w-full items-center gap-3 rounded-lg border
                        border-border bg-card px-4 py-3 text-left
                        transition-colors
                        hover:bg-muted/50
                        disabled:opacity-50
                      `}
                      disabled={connecting}
                      onClick={handleMetaMaskClick}
                      type="button"
                    >
                      <ConnectorIcon
                        className="size-8 shrink-0 rounded-md object-contain"
                        connector={
                          metaMaskConnector ?? {
                            name: "MetaMask",
                            type: "injected",
                          }
                        }
                      />
                      <span className="flex-1 font-medium">MetaMask</span>
                      {isMetaMaskDetected && (
                        <span
                          className={`
                          flex items-center gap-1.5 rounded-full bg-green-500/15
                          px-2 py-0.5 text-xs font-medium text-green-700
                          dark:text-green-400
                        `}
                        >
                          <span
                            className={`
                            size-1.5 shrink-0 rounded-full bg-green-500
                          `}
                          />
                          Detected
                        </span>
                      )}
                      <ChevronRight
                        className={`
                        size-4 shrink-0 text-muted-foreground
                      `}
                      />
                    </button>
                    <button
                      className={`
                        flex w-full items-center gap-3 rounded-lg border
                        border-border bg-card px-4 py-3 text-left
                        transition-colors
                        hover:bg-muted/50
                        disabled:opacity-50
                      `}
                      disabled={connecting}
                      onClick={handlePhantomClick}
                      type="button"
                    >
                      <img
                        alt=""
                        className="size-8 shrink-0 rounded-md object-contain"
                        height={32}
                        src={phantomConnector?.icon ?? PHANTOM_LOGO}
                        width={32}
                      />
                      <span className="flex-1 font-medium">Phantom</span>
                      {phantomConnector && (
                        <span
                          className={`
                          flex items-center gap-1.5 rounded-full bg-green-500/15
                          px-2 py-0.5 text-xs font-medium text-green-700
                          dark:text-green-400
                        `}
                        >
                          <span
                            className={`
                            size-1.5 shrink-0 rounded-full bg-green-500
                          `}
                          />
                          Detected
                        </span>
                      )}
                      <ChevronRight
                        className={`
                        size-4 shrink-0 text-muted-foreground
                      `}
                      />
                    </button>
                  </div>
                </div>
                <div>
                  <p
                    className={`
                    mb-2 text-xs font-medium tracking-wider
                    text-muted-foreground uppercase
                  `}
                  >
                    Others
                  </p>
                  <div className="flex flex-col gap-2">
                    {othersConnectors.map((connector) => (
                      <button
                        className={`
                          flex w-full items-center gap-3 rounded-lg border
                          border-border bg-card px-4 py-3 text-left
                          transition-colors
                          hover:bg-muted/50
                          disabled:opacity-50
                        `}
                        disabled={connecting}
                        key={connector.uid}
                        onClick={() => handleSelectConnector(connector)}
                        type="button"
                      >
                        <ConnectorIcon
                          className="size-8 shrink-0 rounded-md object-contain"
                          connector={connector}
                        />
                        <span className="flex-1 font-medium">
                          {connector.name}
                        </span>
                        {connector.type === "injected" && (
                          <span
                            className={`
                            flex items-center gap-1.5 rounded-full
                            bg-green-500/15 px-2 py-0.5 text-xs font-medium
                            text-green-700
                            dark:text-green-400
                          `}
                          >
                            <span
                              className={`
                              size-1.5 shrink-0 rounded-full bg-green-500
                            `}
                            />
                            Detected
                          </span>
                        )}
                        <ChevronRight
                          className={`
                          size-4 shrink-0 text-muted-foreground
                        `}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                {othersConnectors.length === 0 && (
                  <p className="py-2 text-sm text-muted-foreground">
                    No other wallets detected. Install a browser extension or
                    use WalletConnect (set project id in .env).
                  </p>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <p
                  className={`
                  mb-3 text-xs font-medium tracking-wider text-muted-foreground
                  uppercase
                `}
                >
                  Connect {multiChainConnectorForNetwork?.name ?? "wallet"} to
                </p>
                <button
                  className={`
                    flex w-full items-center gap-3 rounded-lg border
                    border-border bg-card px-4 py-3 text-left transition-colors
                    hover:bg-muted/50
                    disabled:opacity-50
                  `}
                  disabled={connecting}
                  onClick={handleNetworkEvms}
                  type="button"
                >
                  <Image
                    alt="EVMs"
                    className="size-8 shrink-0 rounded-md object-contain"
                    height={32}
                    src="/crypto/ethereum/ethereum-logo.svg"
                    width={32}
                  />
                  <span className="font-medium">Ethereum (this page)</span>
                  <ChevronRight
                    className={`
                    ml-auto size-4 shrink-0 text-muted-foreground
                  `}
                  />
                </button>
                <button
                  className={`
                    flex w-full items-center gap-3 rounded-lg border
                    border-border bg-card px-4 py-3 text-left transition-colors
                    hover:bg-muted/50
                  `}
                  onClick={handleNetworkSolana}
                  type="button"
                >
                  <Image
                    alt="Solana"
                    className="size-8 shrink-0 rounded-md object-contain"
                    height={32}
                    src="/crypto/solana/solanaLogoMark.svg"
                    width={32}
                  />
                  <span className="font-medium">Solana</span>
                  <ChevronRight
                    className={`
                    ml-auto size-4 shrink-0 text-muted-foreground
                  `}
                  />
                </button>
                <button
                  className={`
                    flex w-full items-center gap-3 rounded-lg border
                    border-border bg-card px-4 py-3 text-left transition-colors
                    hover:bg-muted/50
                  `}
                  onClick={handleNetworkSui}
                  type="button"
                >
                  <Image
                    alt="Sui"
                    className="size-8 shrink-0 rounded-md object-contain"
                    height={32}
                    src={SUI_LOGO}
                    width={32}
                  />
                  <span className="font-medium">Sui</span>
                  <ChevronRight
                    className={`
                    ml-auto size-4 shrink-0 text-muted-foreground
                  `}
                  />
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
