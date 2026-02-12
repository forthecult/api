"use client";

import { Wallet } from "lucide-react";
import { usePathname } from "next/navigation";

import { openConnectWalletModal } from "~/app/checkout/crypto/open-wallet-modal";
import { OPEN_AUTH_WALLET_MODAL } from "~/ui/components/auth/auth-wallet-modal";
import { signIn } from "~/lib/auth-client";
import { DiscordIcon } from "~/ui/components/icons/discord";
import { GitHubIcon } from "~/ui/components/icons/github";
import { GoogleIcon } from "~/ui/components/icons/google";
import {
  getTelegramBotUsername,
  TelegramLoginWidget,
} from "~/ui/components/auth/telegram-login-widget";
import { Button } from "~/ui/primitives/button";

interface SocialLoginButtonsProps {
  disabled?: boolean;
  onError?: (message: string) => void;
  showWalletConnect?: boolean;
}

export function SocialLoginButtons({
  disabled = false,
  onError,
  showWalletConnect = true,
}: SocialLoginButtonsProps) {
  const pathname = usePathname();
  const isAuthPage =
    typeof pathname === "string" &&
    (pathname === "/login" ||
      pathname === "/signup" ||
      pathname.startsWith("/auth/sign-in") ||
      pathname.startsWith("/auth/sign-up"));

  const handleWalletConnect = () => {
    if (isAuthPage) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(OPEN_AUTH_WALLET_MODAL));
      }
    } else {
      openConnectWalletModal();
    }
  };

  const handleGitHubLogin = () => {
    try {
      void signIn.social({ provider: "github" });
    } catch (err) {
      onError?.("Failed to sign in with GitHub");
      console.error(err);
    }
  };

  const handleGoogleLogin = () => {
    try {
      void signIn.social({ provider: "google" });
    } catch (err) {
      onError?.("Failed to sign in with Google");
      console.error(err);
    }
  };

  const handleDiscordLogin = () => {
    try {
      void signIn.social({ provider: "discord" });
    } catch (err) {
      onError?.("Failed to sign in with Discord");
      console.error(err);
    }
  };

  const telegramBotUsername = getTelegramBotUsername();
  const showTelegram = Boolean(telegramBotUsername);

  return (
    <div className="space-y-4">
      {showWalletConnect && (
        <Button
          className="flex w-full items-center gap-2"
          disabled={disabled}
          onClick={handleWalletConnect}
          variant="outline"
        >
          <Wallet className="h-5 w-5" />
          Continue with your wallet
        </Button>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Button
          className="flex items-center gap-2"
          disabled={disabled}
          onClick={handleGoogleLogin}
          variant="outline"
        >
          <GoogleIcon className="h-5 w-5" />
          Google
        </Button>
        <Button
          className="flex items-center gap-2"
          disabled={disabled}
          onClick={handleGitHubLogin}
          variant="outline"
        >
          <GitHubIcon className="h-5 w-5" />
          GitHub
        </Button>
        <Button
          className="flex items-center gap-2"
          disabled={disabled}
          onClick={handleDiscordLogin}
          variant="outline"
        >
          <DiscordIcon className="h-5 w-5" />
          Discord
        </Button>
        {showTelegram && (
          <div className="flex min-h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 [&_iframe]:!max-h-9">
            <TelegramLoginWidget
              botUsername={telegramBotUsername}
              disabled={disabled}
              onError={onError}
              size="medium"
            />
          </div>
        )}
      </div>
    </div>
  );
}
