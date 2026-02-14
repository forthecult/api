"use client";

import { LogIn, Moon, Sun, UserIcon, UserPlus, Wallet } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import * as React from "react";

import { OPEN_AUTH_WALLET_MODAL } from "~/ui/components/auth/auth-wallet-modal";
import { Button } from "~/ui/primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/ui/primitives/dropdown-menu";

/**
 * Header dropdown for unauthenticated users: Log In, Sign Up, Connect Wallet, Theme.
 */
export function HeaderGuestDropdown() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="h-9 w-9 rounded-full bg-background text-[#1A1611] dark:text-[#F5F1EB] transition-colors hover:bg-muted"
          size="icon"
          variant="ghost"
        >
          <UserIcon className="h-5 w-5" />
          <span className="sr-only">Account</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <p className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
          Sign in to your account
        </p>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link className="cursor-pointer" href="/login">
            <LogIn className="mr-2 h-4 w-4" />
            Log In
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link className="cursor-pointer" href="/signup">
            <UserPlus className="mr-2 h-4 w-4" />
            Sign Up
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={(e) => {
            e.preventDefault();
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent(OPEN_AUTH_WALLET_MODAL));
            }
          }}
        >
          <Wallet className="mr-2 h-4 w-4" />
          Connect Wallet
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <span className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          Theme
        </span>
        {mounted && (
          <>
            <DropdownMenuItem
              className={`cursor-pointer ${theme === "light" ? "font-medium text-primary" : ""}`}
              onClick={() => setTheme("light")}
            >
              <Sun className="mr-2 h-4 w-4" />
              Light
            </DropdownMenuItem>
            <DropdownMenuItem
              className={`cursor-pointer ${theme === "dark" ? "font-medium text-primary" : ""}`}
              onClick={() => setTheme("dark")}
            >
              <Moon className="mr-2 h-4 w-4" />
              Dark
            </DropdownMenuItem>
            <DropdownMenuItem
              className={`cursor-pointer ${(theme === "system" || !theme) ? "font-medium text-primary" : ""}`}
              onClick={() => setTheme("system")}
            >
              <svg
                aria-hidden="true"
                className="mr-2 h-4 w-4"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  clipRule="evenodd"
                  d="M3.5 2A1.5 1.5 0 002 3.5V15a3 3 0 003 3h12a1.5 1.5 0 001.5-1.5V3.5A1.5 1.5 0 0017 2H3.5zM5 5.75c0-.41.334-.75.75-.75h8.5a.75.75 0 010 1.5h-8.5a.75.75 0 01-.75-.75zM5.75 8.25a.75.75 0 00-.75.75v3.25c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75V9a.75.75 0 00-.75-.75h-8.5z"
                  fillRule="evenodd"
                />
              </svg>
              System
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
