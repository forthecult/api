import type { Metadata } from "next";

import { getCurrentUserOrRedirect } from "~/lib/auth";

import { DashboardLayoutClient } from "./components/dashboard-layout-client";
import { DashboardWalletLinkProvider } from "./components/wallet-link-provider";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
};

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await getCurrentUserOrRedirect();

  return (
    <DashboardWalletLinkProvider>
      <DashboardLayoutClient>
        {children}
      </DashboardLayoutClient>
    </DashboardWalletLinkProvider>
  );
}
