"use client";

import { useCallback, useEffect, useState } from "react";

import { useParams, useSearchParams } from "next/navigation";

import { MetaMaskProvider } from "~/lib/metamask-sdk";
import { WagmiProvider } from "~/lib/wagmi-provider";

import { CheckoutCryptoHeader } from "../crypto/CheckoutCryptoHeader";
import { ConnectWalletModal } from "../crypto/ConnectWalletModal";
import {
  OPEN_CONNECT_WALLET_MODAL,
  openModalRef,
  OpenConnectWalletModalProvider,
} from "../crypto/open-wallet-modal";
import { SolanaWalletProvider } from "../crypto/SolanaWalletProvider";
import { SuiWalletProvider } from "../crypto/SuiWalletProvider";

// Detect if this is an ETH/EVM payment (from hash or from order API when URL has no hash)
function isEvmPaymentFromHash(): boolean {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash.slice(1).toLowerCase();
  return hash === "eth";
}

export default function CheckoutInvoiceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const orderId = (params?.invoiceId as string) ?? "";
  const [open, setOpen] = useState(false);
  const [isEvm, setIsEvm] = useState(false);
  const searchParams = useSearchParams();
  const openModal = useCallback(() => setOpen(true), []);

  useEffect(() => {
    if (isEvmPaymentFromHash()) {
      setIsEvm(true);
      return;
    }
    if (!orderId?.trim()) {
      setIsEvm(false);
      return;
    }
    let cancelled = false;
    fetch(`/api/checkout/orders/${encodeURIComponent(orderId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { paymentType?: string } | null) => {
        if (cancelled) return;
        setIsEvm(data?.paymentType === "eth");
      })
      .catch(() => {
        if (!cancelled) setIsEvm(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  useEffect(() => {
    const handleHashChange = () => {
      if (isEvmPaymentFromHash()) setIsEvm(true);
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    openModalRef.current = () => setOpen(true);
    return () => {
      openModalRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener(OPEN_CONNECT_WALLET_MODAL, handleOpen);
    return () =>
      window.removeEventListener(OPEN_CONNECT_WALLET_MODAL, handleOpen);
  }, []);

  useEffect(() => {
    if (searchParams.get("openConnect") === "1") setOpen(true);
  }, [searchParams]);

  // All crypto payments get all wallet providers (users may be authenticated with any wallet type)
  // For EVM payments, EthPayClient has its own header; for Solana/Sui, use shared header
  return (
    <WagmiProvider>
      <MetaMaskProvider>
        <SuiWalletProvider>
          <SolanaWalletProvider>
            {isEvm ? (
              // ETH payments: EthPayClient has its own header
              children
            ) : (
              // Solana/Sui payments: use shared header and connect modal
              <OpenConnectWalletModalProvider openModal={openModal}>
                <CheckoutCryptoHeader />
                {children}
                <ConnectWalletModal open={open} onOpenChange={setOpen} />
              </OpenConnectWalletModalProvider>
            )}
          </SolanaWalletProvider>
        </SuiWalletProvider>
      </MetaMaskProvider>
    </WagmiProvider>
  );
}
