import Link from "next/link";

import { SEO_CONFIG } from "~/app";
import { FooterBottom } from "~/ui/components/footer/FooterBottom";
import { FooterDogePeek } from "~/ui/components/footer/FooterDogePeek";
import { FooterPaymentsBar } from "~/ui/components/footer/FooterPaymentsBar";
import { cn } from "~/lib/cn";
import { Button } from "~/ui/primitives/button";

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

export function Footer({ className }: { className?: string }) {
  return (
    <footer className={cn("relative border-t bg-background", className)}>
      <div
        className={`
          container mx-auto max-w-7xl px-4 py-12
          sm:px-6
          lg:px-8
        `}
      >
        <div
          className={`
            grid grid-cols-1 gap-8
            md:grid-cols-4
          `}
        >
          <div className="space-y-4">
            <Link className="flex items-center gap-2" href="/">
              <span
                className={`
                  bg-gradient-to-r from-primary to-primary/70 bg-clip-text
                  text-xl font-bold tracking-tight text-transparent
                `}
              >
                {SEO_CONFIG.name}
              </span>
            </Link>
            <p className="text-sm text-muted-foreground">
            Health. Autonomy. Culture.
            </p>
            <div className="flex space-x-4">
              <Button
                asChild
                className="h-8 w-8 rounded-full"
                size="icon"
                variant="ghost"
              >
                <Link
                  href="https://x.com/bythecult"
                  rel="noopener noreferrer"
                  target="_blank"
                  aria-label="X @bytheculture"
                >
                  <XIcon className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                className="h-8 w-8 rounded-full"
                size="icon"
                variant="ghost"
              >
                <Link
                  href="https://t.me/bytheculture"
                  rel="noopener noreferrer"
                  target="_blank"
                  aria-label="Telegram @bytheculture"
                >
                  <TelegramIcon className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
          <div>
            <h3 className="mb-4 text-sm font-semibold">Shop</h3>
            <ul className="space-y-2 text-sm" aria-label="Shop">
              <li>
                <Link
                  className="text-muted-foreground hover:text-foreground"
                  href="/health-wellness"
                >
                  Health &amp; Wellness
                </Link>
              </li>
              <li>
                <Link
                  className="text-muted-foreground hover:text-foreground"
                  href="/travel-lifestyle"
                >
                  Travel &amp; Lifestyle
                </Link>
              </li>
              <li>
                <Link
                  className="text-muted-foreground hover:text-foreground"
                  href="/best-sellers"
                >
                  Best Sellers
                </Link>
              </li>
              <li>
                <Link
                  className="text-muted-foreground hover:text-foreground"
                  href="/products"
                >
                  All Products
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="mb-4 text-sm font-semibold">Store Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  className={`
                    text-muted-foreground
                    hover:text-foreground
                  `}
                  href="/about"
                >
                  About Us
                </Link>
              </li>
              <li>
                <Link
                  className={`
                    text-muted-foreground
                    hover:text-foreground
                  `}
                  href="/token"
                >
                  $CULT Token
                </Link>
              </li>
              <li>
                <Link
                  className={`
                    text-muted-foreground
                    hover:text-foreground
                  `}
                  href="/token/stake"
                >
                  Stake &amp; Vote
                </Link>
              </li>
              <li>
                <Link
                  className={`
                    text-muted-foreground
                    hover:text-foreground
                  `}
                  href="/lookbook"
                >
                  Lookbook
                </Link>
              </li>
              <li>
                <Link
                  className={`
                    text-muted-foreground
                    hover:text-foreground
                  `}
                  href="/affiliate-program"
                >
                  Affiliate Program
                </Link>
              </li>
              <li>
                <Link
                  className={`
                    text-muted-foreground
                    hover:text-foreground
                  `}
                  href="/stats"
                >
                  Store statistics
                </Link>
              </li>
              <li>
                <Link
                  className={`
                    text-muted-foreground
                    hover:text-foreground
                  `}
                  href="/api/docs"
                >
                  API
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="mb-4 text-sm font-semibold">Support</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  className={`
                    text-muted-foreground
                    hover:text-foreground
                  `}
                  href="/track-order"
                >
                  Track order
                </Link>
              </li>
              <li>
                <Link
                  className={`
                    text-muted-foreground
                    hover:text-foreground
                  `}
                  href="/contact"
                >
                  Contact Us
                </Link>
              </li>
              <li>
                <Link
                  className={`
                    text-muted-foreground
                    hover:text-foreground
                  `}
                  href="/policies/shipping"
                >
                  Shipping policy
                </Link>
              </li>
              <li>
                <Link
                  className={`
                    text-muted-foreground
                    hover:text-foreground
                  `}
                  href="/policies/refund"
                >
                  Refund policy
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="relative mt-12 border-t pt-8">
          <FooterDogePeek />
          <div className="mb-6">
            <FooterPaymentsBar />
          </div>
          <FooterBottom />
        </div>
      </div>
    </footer>
  );
}
