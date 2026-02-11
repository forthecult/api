"use client";

import { useSDK } from "~/lib/metamask-sdk";
import { ChevronRight, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  useConnect,
  useConnection,
  useConnectors,
  useDisconnect,
  useAccount,
  useChainId,
} from "wagmi";
import { ChevronDown } from "lucide-react";

import { SEO_CONFIG } from "~/app";
import { useCurrentUser } from "~/lib/auth-client";
import { useEthPay, type EthPayOrder } from "~/lib/hooks/use-eth-pay";
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
  ethereum: "Ethereum",
  arbitrum: "Arbitrum",
  base: "Base",
  polygon: "Polygon",
};

const TOKEN_LABELS: Record<string, string> = {
  eth: "ETH",
  usdc: "USDC",
  usdt: "USDT",
};

const MULTI_CHAIN_WALLET_NAMES = new Set([
  "Phantom",
  "Ctrl Wallet",
  "Trust Wallet",
  "Ronin Wallet",
]);

function ConnectorIcon({
  connector,
  className,
}: {
  connector: { icon?: string; type: string; name: string };
  className?: string;
}) {
  if (connector.name === "MetaMask") {
    return (
      <img
        src={METAMASK_LOGO}
        alt="MetaMask"
        className={className}
        width={32}
        height={32}
      />
    );
  }
  if (connector.icon) {
    return (
      <img
        src={connector.icon}
        alt=""
        className={className}
        width={32}
        height={32}
      />
    );
  }
  if (connector.type === "walletConnect") {
    return (
      <div
        className={`flex size-8 items-center justify-center rounded-md bg-[#3396FF] text-white ${className ?? ""}`}
        aria-hidden
      >
        <svg
          viewBox="0 0 32 32"
          className="size-5"
          fill="currentColor"
          aria-hidden
        >
          <path d="M9.5 12.5a4.5 4.5 0 1 1 4.5 4.5h-4.5v-4.5Zm13 0v4.5h4.5a4.5 4.5 0 1 0-4.5-4.5Zm-13 13a4.5 4.5 0 1 0 4.5-4.5h-4.5v4.5Zm13-4.5a4.5 4.5 0 1 1-4.5 4.5v-4.5h4.5Z" />
        </svg>
      </div>
    );
  }
  return (
    <Image
      alt={connector.name}
      className={className ?? "size-8 shrink-0 object-contain rounded-md"}
      height={32}
      src="/crypto/ethereum/ethereum-logo.svg"
      width={32}
    />
  );
}

interface OrderData {
  orderId: string;
  depositAddress: string;
  totalCents: number;
  email?: string;
  expiresAt: string;
  chain: string;
  token: string;
  chainId?: number;
  cryptoAmount?: string | null;
  tokenAddress?: string | null;
  paymentStatus?: string;
}

// Chain ID mapping
const CHAIN_ID_MAP: Record<string, number> = {
  ethereum: 1,
  arbitrum: 42161,
  base: 8453,
  polygon: 137,
  bnb: 56,
  optimism: 10,
};

export function EthPayClient() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = (params?.invoiceId as string) ?? "";

  // Fetch order data from API
  const [order, setOrder] = useState<OrderData | null>(null);
  const [orderLoading, setOrderLoading] = useState(true);
  const [orderError, setOrderError] = useState<string | null>(null);

  useEffect(() => {
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
      .then((data) => {
        if (cancelled) return;
        const chainName = (
          data.chain ??
          data.cryptoCurrencyNetwork ??
          "ethereum"
        ).toLowerCase();
        setOrder({
          orderId: data.orderId ?? data.id,
          depositAddress: data.depositAddress ?? data.solanaPayDepositAddress,
          totalCents: data.totalCents,
          email: data.email,
          expiresAt: data.expiresAt,
          chain: chainName,
          token: (data.token ?? data.cryptoCurrency ?? "eth").toLowerCase(),
          chainId: data.chainId ?? CHAIN_ID_MAP[chainName] ?? 1,
          cryptoAmount: data.cryptoAmount,
          tokenAddress: data.tokenAddress,
          paymentStatus: data.paymentStatus,
        });
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
  }, [orderId]);

  const amountUsd = order ? order.totalCents / 100 : 0;
  const chain = (order?.chain || "ethereum").toLowerCase();
  const token = (order?.token || "eth").toLowerCase();
  const depositAddress = order?.depositAddress || "";

  const [ethUsdRate, setEthUsdRate] = useState<number | null>(null);

  const chainLabel = CHAIN_LABELS[chain] ?? chain;
  const tokenLabel = TOKEN_LABELS[token] ?? token.toUpperCase();
  const isStablecoin = token === "usdc" || token === "usdt";
  const amountUsdStr = amountUsd.toFixed(2);
  const paymentTitle = `Pay with ${tokenLabel} (${chainLabel})`;

  const { address: wagmiAddress } = useConnection();
  const connectors = useConnectors();
  const { mutate: connect, isPending: wagmiConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const sdkState = useSDK();
  const sdk = sdkState?.sdk;
  const metaMaskConnected = sdkState?.connected ?? false;
  const metaMaskConnecting = sdkState?.connecting ?? false;
  const metaMaskAccounts =
    (sdkState as { accounts?: string[] })?.accounts ?? undefined;
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [connectStep, setConnectStep] = useState<"wallets" | "network">(
    "wallets",
  );
  const [multiChainConnectorForNetwork, setMultiChainConnectorForNetwork] =
    useState<ReturnType<typeof useConnectors>[number] | null>(null);
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
  const rateLabel = `1 ETH = ${rate.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;

  const ethPayOrderForHook: EthPayOrder | null = order
    ? {
        orderId: order.orderId,
        depositAddress: order.depositAddress as `0x${string}`,
        chainId: order.chainId ?? 1,
        token:
          order.token === "usdc"
            ? "USDC"
            : order.token === "usdt"
              ? "USDT"
              : "ETH",
        totalCents: order.totalCents,
        cryptoAmount: order.cryptoAmount ?? null,
        tokenAddress: order.tokenAddress ?? null,
        expiresAt: order.expiresAt,
      }
    : null;

  const {
    paymentStatus,
    isProcessing,
    sendPayment,
    needsChainSwitch,
    displayAmount,
    txHash: paymentTxHash,
  } = useEthPay({
    order: ethPayOrderForHook ?? {
      orderId: "",
      depositAddress: "0x0000000000000000000000000000000000000000" as `0x${string}`,
      chainId: 1,
      token: "ETH",
      totalCents: 0,
      expiresAt: new Date().toISOString(),
    },
    ethPriceUsd: rate,
    onSuccess: (txHash) => {
      router.push(`/checkout/${orderId}/confirmation?tx=${txHash}`);
    },
    onError: () => {},
  });

  const { user } = useCurrentUser();
  const email = user?.email ?? order?.email ?? "";

  // Use cached /api/crypto/prices for ETH rate (server caches 60s)
  useEffect(() => {
    fetch("/api/crypto/prices")
      .then((res) => res.json())
      .then((data: { ETH?: number }) => {
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
      // Navigate to Solana payment page with hash format
      setConnectModalOpen(false);
      router.push(`/checkout/${orderId}#solana`);
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
    // Navigate to Solana payment page with hash format
    router.push(`/checkout/${orderId}#solana`);
  }, [orderId, router]);

  const handleNetworkSui = useCallback(() => {
    setConnectModalOpen(false);
    setMultiChainConnectorForNetwork(null);
    setConnectStep("wallets");
    // Navigate to Sui payment page with hash format
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
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin size-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Loading order...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (orderError || !order) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md px-4">
          <div className="text-destructive text-4xl">⚠️</div>
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
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link
              href="/checkout"
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Back to checkout"
            >
              <svg
                className="size-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Link>
            <Link className="flex items-center gap-2" href="/">
              <span className="text-xl font-bold tracking-tight text-foreground">
                {SEO_CONFIG.name}
              </span>
            </Link>
            {address ? (
              <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    className="gap-2 font-mono shadow-none hover:shadow-none focus:shadow-none focus-visible:shadow-none active:shadow-none"
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
                  <DropdownMenuLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Connected
                  </DropdownMenuLabel>
                  <div className="flex items-center justify-between gap-2 px-2 py-2">
                    <span
                      className="min-w-0 truncate font-mono text-sm text-foreground"
                      title={address}
                    >
                      {truncateAddress(address)}
                    </span>
                    <Button
                      className="shrink-0"
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => disconnect()}
                    >
                      Disconnect
                    </Button>
                  </div>
                  <DropdownMenuSeparator />
                  <button
                    type="button"
                    onClick={handleAddNewWallet}
                    className="block w-full rounded-sm px-2 py-1.5 text-left text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                  >
                    Add a new wallet
                  </button>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                className="border border-border shadow-none hover:shadow-none focus:shadow-none focus-visible:shadow-none active:shadow-none"
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

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-5">
        <div className="flex min-w-0 flex-col gap-6 min-[560px]:flex-row min-[560px]:items-start">
          <div className="min-w-0 flex-1 rounded-xl border border-border bg-card p-6 min-[560px]:min-w-[560px]">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Image
                  alt={tokenLabel}
                  className="h-8 w-10 shrink-0 object-contain"
                  height={32}
                  src="/crypto/ethereum/ethereum-logo.svg"
                  width={40}
                />
                <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
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
                <div className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-green-700 dark:text-green-400">
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
                <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
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
                    size="lg"
                    type="button"
                    onClick={handleOpenConnectModal}
                    disabled={connecting}
                  >
                    {connecting ? "Connecting…" : "Connect wallet"}
                  </Button>
                ) : paymentStatus.status === "confirmed" ? (
                  <Button
                    className="min-w-[12rem]"
                    size="lg"
                    type="button"
                    disabled
                  >
                    <CheckCircle2 className="mr-2 size-4" />
                    Payment Complete
                  </Button>
                ) : (
                  <Button
                    className="min-w-[12rem]"
                    size="lg"
                    type="button"
                    disabled={isProcessing || !order}
                    onClick={sendPayment}
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
                      href={`https://${chain === "ethereum" ? "" : chain + "."}etherscan.io/tx/${paymentTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-primary hover:underline"
                    >
                      {paymentTxHash.slice(0, 10)}...{paymentTxHash.slice(-8)}
                    </a>
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0 shrink-0 min-[560px]:w-[510px] min-[560px]:sticky min-[560px]:top-8 min-[560px]:self-start">
            <div className="rounded-xl border border-border bg-card px-6 py-5">
              <h2 className="mb-4 text-xl font-semibold">Order details</h2>
              <dl className="space-y-3 text-base">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Email address</dt>
                  <dd className="flex items-center gap-2">
                    <span>{email || "—"}</span>
                    {!user?.email && (
                      <button
                        type="button"
                        onClick={() => router.push("/checkout")}
                        className="text-primary underline hover:underline"
                      >
                        Change
                      </button>
                    )}
                  </dd>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Payment method</dt>
                  <dd className="flex items-center gap-2">
                    <span>
                      {tokenLabel} ({chainLabel})
                    </span>
                    <button
                      type="button"
                      onClick={() => router.push("/checkout")}
                      className="text-primary underline hover:underline"
                    >
                      Change
                    </button>
                  </dd>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Invoice id</dt>
                  <dd>
                    <code className="break-all font-mono text-xs">
                      {orderId || "—"}
                    </code>
                  </dd>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                  <dt className="text-muted-foreground">Fiat value</dt>
                  <dd className="font-medium">
                    USD {amountUsd > 0 ? amountUsd.toFixed(2) : "0.00"}
                  </dd>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-lg">
                  <dt className="font-medium">Total</dt>
                  <dd className="font-semibold">
                    {isStablecoin
                      ? `${amountUsdStr} ${tokenLabel}`
                      : `${amountEthStr} ETH`}
                  </dd>
                </div>
              </dl>
              {!isStablecoin && (
                <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  We&apos;ve converted this price from USD to ETH at our rate of
                  approximately {rateLabel}.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={connectModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setConnectStep("wallets");
            setMultiChainConnectorForNetwork(null);
          }
          setConnectModalOpen(open);
        }}
      >
        <DialogContent
          className="max-w-[400px] gap-0 border-border bg-card p-0 sm:max-w-[400px]"
          aria-describedby={undefined}
        >
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            {connectStep === "network" && (
              <button
                type="button"
                onClick={() => setConnectStep("wallets")}
                className="-ml-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Back"
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
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Suggested
                  </p>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleMetaMaskClick}
                      disabled={connecting}
                      className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/50 disabled:opacity-50"
                    >
                      <ConnectorIcon
                        connector={
                          metaMaskConnector ?? {
                            name: "MetaMask",
                            type: "injected",
                          }
                        }
                        className="size-8 shrink-0 rounded-md object-contain"
                      />
                      <span className="flex-1 font-medium">MetaMask</span>
                      {isMetaMaskDetected && (
                        <span className="flex items-center gap-1.5 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                          <span className="size-1.5 shrink-0 rounded-full bg-green-500" />
                          Detected
                        </span>
                      )}
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </button>
                    <button
                      type="button"
                      onClick={handlePhantomClick}
                      disabled={connecting}
                      className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/50 disabled:opacity-50"
                    >
                      <img
                        src={phantomConnector?.icon ?? PHANTOM_LOGO}
                        alt=""
                        className="size-8 shrink-0 rounded-md object-contain"
                        width={32}
                        height={32}
                      />
                      <span className="flex-1 font-medium">Phantom</span>
                      {phantomConnector && (
                        <span className="flex items-center gap-1.5 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                          <span className="size-1.5 shrink-0 rounded-full bg-green-500" />
                          Detected
                        </span>
                      )}
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </button>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Others
                  </p>
                  <div className="flex flex-col gap-2">
                    {othersConnectors.map((connector) => (
                      <button
                        key={connector.uid}
                        type="button"
                        onClick={() => handleSelectConnector(connector)}
                        disabled={connecting}
                        className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/50 disabled:opacity-50"
                      >
                        <ConnectorIcon
                          connector={connector}
                          className="size-8 shrink-0 rounded-md object-contain"
                        />
                        <span className="flex-1 font-medium">
                          {connector.name}
                        </span>
                        {connector.type === "injected" && (
                          <span className="flex items-center gap-1.5 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                            <span className="size-1.5 shrink-0 rounded-full bg-green-500" />
                            Detected
                          </span>
                        )}
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
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
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Connect {multiChainConnectorForNetwork?.name ?? "wallet"} to
                </p>
                <button
                  type="button"
                  onClick={handleNetworkEvms}
                  disabled={connecting}
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/50 disabled:opacity-50"
                >
                  <Image
                    alt="EVMs"
                    className="size-8 shrink-0 rounded-md object-contain"
                    height={32}
                    src="/crypto/ethereum/ethereum-logo.svg"
                    width={32}
                  />
                  <span className="font-medium">Ethereum (this page)</span>
                  <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
                </button>
                <button
                  type="button"
                  onClick={handleNetworkSolana}
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/50"
                >
                  <Image
                    alt="Solana"
                    className="size-8 shrink-0 rounded-md object-contain"
                    height={32}
                    src="/crypto/solana/solanaLogoMark.svg"
                    width={32}
                  />
                  <span className="font-medium">Solana</span>
                  <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
                </button>
                <button
                  type="button"
                  onClick={handleNetworkSui}
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/50"
                >
                  <Image
                    alt="Sui"
                    className="size-8 shrink-0 rounded-md object-contain"
                    height={32}
                    src={SUI_LOGO}
                    width={32}
                  />
                  <span className="font-medium">Sui</span>
                  <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
