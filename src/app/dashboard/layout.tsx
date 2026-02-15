import type { Metadata } from "next";

import { getCurrentUserOrRedirect } from "~/lib/auth";

import { SidebarLoader } from "./components/sidebar-loader";
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
      <div className="flex min-h-screen flex-col">
        <div
          className={`
            container mx-auto flex max-w-7xl gap-6 px-4 py-6
            sm:px-6
            lg:px-8
          `}
        >
          <SidebarLoader />
          <main className="min-w-0 flex-1">
            <div
              className={`
              w-full max-w-6xl space-y-6 p-4
              sm:p-6
              md:p-8
              [&_[data-slot=card]]:shadow-none
            `}
            >
              {children}
            </div>
          </main>
        </div>
      </div>
    </DashboardWalletLinkProvider>
  );
}
