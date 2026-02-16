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

  // Derive payment type from prefetched order or URL hash so we only load the
  // wallet providers actually needed. This keeps ~100-200KB of unused SDK code
  // out of the client for payment types that don't need them.
  const paymentType = prefetch?.order?.paymentType?.toLowerCase() ?? "";
  const needsEvm = isEvm || paymentType === "eth";
  const needsSolana =
    !paymentType || paymentType === "solana" || paymentType === "crypto";
  const needsSui = !paymentType || paymentType === "sui";

  // Wrap children with only the wallet providers required for this payment type.
  // WagmiProvider is needed for EVM payments AND for Solana WalletConnect (on
  // mobile, MWA also needs the Solana adapter which is independent of wagmi).
  let content = (
    <>
      {needsEvm ? (
        children
      ) : (
        <OpenConnectWalletModalProvider openModal={openModal}>
          <CheckoutCryptoHeader />
          {children}
          <ConnectWalletModal onOpenChange={setOpen} open={open} />
        </OpenConnectWalletModalProvider>
      )}
    </>
  );

  // Solana provider: needed for Solana/default payments (WalletConnect + MWA)
  if (needsSolana) {
    content = <SolanaWalletProvider>{content}</SolanaWalletProvider>;
  }

  // Sui provider: only for Sui payments
  if (needsSui) {
    content = <SuiWalletProvider>{content}</SuiWalletProvider>;
  }

  // EVM providers: WagmiProvider + MetaMask for ETH, but also always present
  // as fallback until payment type is known (paymentType === "")
  if (needsEvm || !paymentType) {
    content = (
      <WagmiProvider>
        <MetaMaskProvider>{content}</MetaMaskProvider>
      </WagmiProvider>
    );
  }

  return <WalletErrorBoundary>{content}</WalletErrorBoundary>;
}

function isEvmFromHash(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hash.slice(1).toLowerCase() === "eth";
}
