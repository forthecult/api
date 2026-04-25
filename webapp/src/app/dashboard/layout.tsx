import type { Metadata } from "next";

import { NextSSRPlugin } from "@uploadthing/react/next-ssr-plugin";
import { extractRouterConfig } from "uploadthing/server";

import { ourFileRouter } from "~/app/api/uploadthing/core";
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
      {/* UploadThing SSR plugin scoped to dashboard — file uploads only happen here */}
      <NextSSRPlugin routerConfig={extractRouterConfig(ourFileRouter)} />
      <DashboardLayoutClient>{children}</DashboardLayoutClient>
    </DashboardWalletLinkProvider>
  );
}
