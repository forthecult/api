import { getCurrentUserOrRedirect } from "~/lib/auth";

import { DashboardWalletLinkProvider } from "./components/wallet-link-provider";
import { SidebarLoader } from "./components/sidebar-loader";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await getCurrentUserOrRedirect();

  return (
    <DashboardWalletLinkProvider>
      <div className="flex min-h-screen flex-col">
        <div className="container flex gap-6 px-4 py-6 md:px-6">
          <SidebarLoader />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </DashboardWalletLinkProvider>
  );
}
