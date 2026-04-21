"use client";

import { LogOut } from "lucide-react";

import { signOut } from "~/lib/auth-client";
import { getMainAppUrl } from "~/lib/env";
import { BrowseWebsiteLink } from "~/ui/admin-sidebar";

export function AdminHeader() {
  const mainAppUrl = getMainAppUrl();

  const handleLogout = async () => {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = mainAppUrl;
        },
      },
    });
  };

  return (
    <header
      className={`
        sticky top-0 z-10 flex h-14 items-center justify-between border-b
        border-border bg-background px-4
      `}
    >
      <div className="flex items-center gap-4">
        <BrowseWebsiteLink />
      </div>
      <div className="flex items-center gap-2">
        <button
          className={`
            inline-flex items-center gap-2 rounded-md border border-input
            bg-background px-3 py-2 text-sm font-medium transition-colors
            hover:bg-muted hover:text-foreground
          `}
          onClick={handleLogout}
          type="button"
        >
          <LogOut aria-hidden className="h-4 w-4" />
          Log out
        </button>
      </div>
    </header>
  );
}
