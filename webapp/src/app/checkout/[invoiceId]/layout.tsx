"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { MetaMaskProvider } from "~/lib/metamask-sdk";
import { WagmiProvider } from "~/lib/wagmi-provider";
import { WalletErrorBoundary } from "~/ui/components/wallet-error-boundary";

import { CheckoutCryptoHeader } from "../crypto/CheckoutCryptoHeader";
import { ConnectWalletModal } from "../crypto/ConnectWalletModal";
import {
  OPEN_CONNECT_WALLET_MODAL,
  OpenConnectWalletModalProvider,
  openModalRef,
} from "../crypto/open-wallet-modal";
import { SolanaWalletProvider } from "../crypto/SolanaWalletProvider";
import { SuiWalletProvider } from "../crypto/SuiWalletProvider";
import {
  OrderPrefetchProvider,
  useOrderPrefetch,
} from "./order-prefetch-context";

export default function CheckoutInvoiceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const orderId = (params?.invoiceId as string) ?? "";
  return (
    <OrderPrefetchProvider orderId={orderId}>
      <CheckoutInvoiceLayoutInner>{children}</CheckoutInvoiceLayoutInner>
    </OrderPrefetchProvider>
  );
}

function CheckoutInvoiceLayoutInner({
  children,
}: {
  children: React.ReactNode;
}) {
  const prefetch = useOrderPrefetch();
  const [open, setOpen] = useState(false);
  const [isEvm, setIsEvm] = useState(false);
  const openModal = useCallback(() => setOpen(true), []);

  // Derive isEvm from hash (immediate) or from prefetched order (one fetch for layout + pay clients)
  useEffect(() => {
    if (isEvmFromHash()) {
      setIsEvm(true);
      return;
    }
    if (prefetch?.order?.paymentType?.toLowerCase() === "eth") setIsEvm(true);
  }, [prefetch?.order?.paymentType]);

  useEffect(() => {
    const handleHashChange = () => {
      if (isEvmFromHash()) setIsEvm(true);
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

  // Check for ?openConnect=1 on mount (manual URL parse avoids useSearchParams
  // which requires a Suspense boundary and can cause a full-page flash).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("openConnect") === "1") setOpen(true);
  }, []);

  // All crypto payments get all wallet providers so the React tree stays stable
  // and wallet contexts are always available. Conditional rendering of providers
  // would cause tree restructuring when paymentType changes, briefly unmounting
  // children and breaking wallet context access.
  // For EVM payments, EthPayClient has its own header; for Solana/Sui, use shared header
  return (
    <WagmiProvider>
      <MetaMaskProvider>
        <WalletErrorBoundary>
          <SuiWalletProvider>
            <SolanaWalletProvider>
              {isEvm ? (
                // ETH payments: EthPayClient has its own header
                children
              ) : (
                // Solana/Sui payments: use shared header and connect modal.
                // Header and modal render immediately to avoid a layout shift
                // (the old walletUiReady defer caused a visible flash when the
                // 64px header appeared after setTimeout(0)).
                <OpenConnectWalletModalProvider openModal={openModal}>
                  <CheckoutCryptoHeader />
                  {children}
                  <ConnectWalletModal onOpenChange={setOpen} open={open} />
                </OpenConnectWalletModalProvider>
              )}
            </SolanaWalletProvider>
          </SuiWalletProvider>
        </WalletErrorBoundary>
      </MetaMaskProvider>
    </WagmiProvider>
  );
}

function isEvmFromHash(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hash.slice(1).toLowerCase() === "eth";
}
