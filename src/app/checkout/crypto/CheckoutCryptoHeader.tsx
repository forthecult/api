"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { ChevronDown, Wallet } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { SEO_CONFIG } from "~/app";
import {
  openConnectWalletModal,
  openModalRef,
  useOpenConnectWalletModal,
} from "~/app/checkout/crypto/open-wallet-modal";
import { Button } from "~/ui/primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/ui/primitives/dropdown-menu";

interface ConnectedWallet {
  icon?: string;
  name: string;
  publicKey: string;
}

export function CheckoutCryptoHeader() {
  const { connected, disconnect, publicKey, wallet } = useWallet();
  const openModalFromContext = useOpenConnectWalletModal();
  const [connectedWallets, setConnectedWallets] = useState<ConnectedWallet[]>(
    [],
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // add current adapter wallet to list whenever connected (never clear on adapter switch)
  useEffect(() => {
    if (!connected || !publicKey || !wallet) return;
    const key = publicKey.toBase58();
    setConnectedWallets((prev) => {
      if (prev.some((w) => w.publicKey === key)) return prev;
      return [
        ...prev,
        {
          icon: wallet.adapter.icon,
          name: wallet.adapter.name,
          publicKey: key,
        },
      ];
    });
  }, [connected, publicKey, wallet]);

  const handleDisconnect = useCallback(
    (walletPublicKey: string) => {
      setConnectedWallets((prev) =>
        prev.filter((w) => w.publicKey !== walletPublicKey),
      );
      if (publicKey?.toBase58() === walletPublicKey) disconnect();
    },
    [disconnect, publicKey],
  );

  const handleAddWallet = useCallback(() => {
    // Close dropdown first, then open wallet modal
    setDropdownOpen(false);
    // Use setTimeout to allow dropdown animation to complete before opening modal
    setTimeout(() => {
      openModalRef.current?.();
      openModalFromContext?.();
      openConnectWalletModal();
    }, 100);
  }, [openModalFromContext]);

  const hasWallets = connectedWallets.length > 0;
  const currentKey = publicKey?.toBase58();
  const showDropdown = connected || hasWallets;

  return (
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
          <div className="flex items-center gap-3">
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
          </div>

          {showDropdown ? (
            <DropdownMenu onOpenChange={setDropdownOpen} open={dropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  className="gap-2 font-mono"
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {connected && wallet?.adapter.icon ? (
                    <img
                      alt=""
                      className="size-5 shrink-0 rounded object-contain"
                      height={20}
                      src={wallet.adapter.icon}
                      width={20}
                    />
                  ) : (
                    <Wallet className="size-5 shrink-0" />
                  )}
                  <span>
                    {connected && currentKey
                      ? truncateAddress(currentKey)
                      : hasWallets
                        ? `${connectedWallets.length} wallet${connectedWallets.length === 1 ? "" : "s"}`
                        : "Connect"}
                  </span>
                  <ChevronDown className="size-4 shrink-0 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[20rem]">
                <DropdownMenuLabel
                  className={`
                  text-xs font-medium tracking-wider text-muted-foreground
                  uppercase
                `}
                >
                  Connected
                </DropdownMenuLabel>
                {connectedWallets.map((w) => (
                  <div
                    className={`
                      flex items-center justify-between gap-2 px-2 py-2
                    `}
                    key={w.publicKey}
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      {w.icon ? (
                        <img
                          alt=""
                          className="size-5 shrink-0 rounded object-contain"
                          height={20}
                          src={w.icon}
                          title={w.name}
                          width={20}
                        />
                      ) : (
                        <Wallet
                          aria-hidden
                          className="size-5 shrink-0 text-muted-foreground"
                        />
                      )}
                      <span
                        className={`
                          min-w-0 truncate font-mono text-sm text-foreground
                        `}
                        title={w.publicKey}
                      >
                        {truncateAddress(w.publicKey)}
                      </span>
                      {currentKey === w.publicKey && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          (active)
                        </span>
                      )}
                    </span>
                    <Button
                      className="shrink-0"
                      onClick={() => handleDisconnect(w.publicKey)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Disconnect
                    </Button>
                  </div>
                ))}
                <DropdownMenuSeparator />
                <button
                  className={`
                    block w-full rounded-sm px-2 py-1.5 text-left text-sm
                    font-medium
                    hover:bg-accent hover:text-accent-foreground
                  `}
                  onClick={handleAddWallet}
                  type="button"
                >
                  Add a new wallet
                </button>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              className={`
                shadow-none
                hover:shadow-none
                focus:shadow-none
                focus-visible:shadow-none
                active:shadow-none
              `}
              onClick={handleAddWallet}
              type="button"
              variant="outline"
            >
              Connect
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}....${address.slice(-4)}`;
}
