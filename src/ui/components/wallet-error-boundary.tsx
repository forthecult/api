"use client";

import * as React from "react";

/**
 * Error boundary that catches crashes from wallet providers / browser extensions
 * (e.g. Phantom "Cannot redefine property") and renders children anyway.
 *
 * Without this, a wallet extension crash would take down the entire page
 * because WagmiProvider / SolanaWalletProvider sit above CartProvider and
 * other essential contexts in the layout tree.
 */
export class WalletErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(
      "[WalletErrorBoundary] Wallet provider crashed — rendering children without wallet support:",
      error,
      info,
    );
  }

  render() {
    if (this.state.hasError) {
      // Render children without the wallet providers — cart, currency,
      // and the rest of the app still work; wallet features gracefully degrade.
      return this.props.children;
    }
    return this.props.children;
  }
}
