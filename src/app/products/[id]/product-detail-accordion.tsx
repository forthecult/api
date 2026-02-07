"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { getPaymentOptionsForDisplay } from "~/lib/checkout-payment-options";
import { cn } from "~/lib/cn";

const ITEMS = [
  { id: "description", label: "Description" },
  { id: "delivery", label: "Delivery" },
  { id: "returns", label: "Refunds and Returns" },
  { id: "payment", label: "Payment Options" },
] as const;

const DELIVERY_COPY = (
  <>
    <p className="mb-3">
      All orders are shipped within 72 hours from the United States, Europe, or
      Australia, depending on where you live and what product you purchase. As
      soon as your order ships, you will receive an email or notification with
      the tracking information.
    </p>
    <p className="mb-3">
      Most orders placed in the USA arrive in 5-7 days after ordering.
    </p>
    <p className="mb-3">Non-US orders arrive in 1 - 4 weeks after ordering.</p>
    <p className="mb-3">
      If you hold more than 250,000 CULT in your wallet at the time of checkout,
      you will receive free shipping anywhere in the world.
    </p>
    <p className="mb-3">
      We ship to most countries. Our shipping prices vary depending on your
      location and what products you&apos;re purchasing. The best way to
      calculate shipping is to add the products to your cart and use the
      Shipping Estimator on the cart page.
    </p>
    <p className="mb-3">
      In general, US orders range between $2-20 in shipping and Non-US orders
      range between $2 - $45.
    </p>
    <p className="mb-3 font-medium">Example shipping prices:</p>
    <ul className="mb-3 list-inside list-disc space-y-1">
      <li>Tees - $2.50 - US, $5.50 Non-US</li>
      <li>Poker Chips - $0.50 - US, $0.75 Non-US</li>
      <li>Hardware Wallets - $7 - US, $11 - Non-US</li>
      <li>Trinkets - $1.50 - US, $2.50 - Non-US</li>
      <li>Alpaca Socks - $5 - US, $10-18 Non-US</li>
    </ul>
  </>
);

const DELIVERY_APPAREL_EXTRA = (
  <p className="mt-3">
    We offer free delivery on all apparel orders over $100 to United States (US)
    and Europe. For customers in the rest of the world, enjoy free shipping on
    all apparel orders over $250. Shop now and take advantage of these great
    shipping deals!
  </p>
);

const RETURNS_COPY = (
  <>
    <p className="mb-3">
      If your order hasn&apos;t shipped yet, you can get an instant refund.
      Refunds are in stablecoin or the fiat currency you paid in. We stand by our
      products 100% and want our customers to love them as much as we do. In the
      event that you are unsatisfied with your purchase, please contact us
      within 14 days of receiving your order for an exchange or refund.
    </p>
    <p className="mb-3">We are happy when you are happy.</p>
    <p>
      You can contact us by emailing at{" "}
      <a
        href="mailto:support@forthecult.store"
        className="underline hover:no-underline"
      >
        support@forthecult.store
      </a>{" "}
      or visiting our{" "}
      <Link href="/contact" className="underline hover:no-underline">
        Contact Us Page
      </Link>
      .
    </p>
  </>
);

function isApparelCategory(category: string): boolean {
  const lower = category.toLowerCase();
  return (
    lower.includes("apparel") ||
    lower.includes("clothing") ||
    lower.includes("tee") ||
    lower.includes("shirt") ||
    lower.includes("sock") ||
    lower.includes("mens") ||
    lower.includes("womens")
  );
}

export interface ProductDetailAccordionProps {
  description: string;
  category: string;
  /** When true, description is sanitized HTML and will be rendered as HTML. */
  descriptionIsHtml?: boolean;
}

export function ProductDetailAccordion({
  description,
  category,
  descriptionIsHtml,
}: ProductDetailAccordionProps) {
  // Delivery and Returns open by default on page load
  const [openIds, setOpenIds] = React.useState<Set<string>>(
    () => new Set(["delivery", "returns"]),
  );
  const toggleOpen = (itemId: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };
  const isPanelOpen = (itemId: string) => openIds.has(itemId);
  const { visibility } = usePaymentMethodSettings();
  const paymentOptions = React.useMemo(
    () => getPaymentOptionsForDisplay(visibility),
    [visibility],
  );

  const renderContent = (itemId: string) => {
    switch (itemId) {
      case "description":
        if (descriptionIsHtml && description) {
          return (
            <div
              className="pb-4 text-sm text-muted-foreground prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: description }}
            />
          );
        }
        return (
          <div className="pb-4 text-sm text-muted-foreground whitespace-pre-wrap">
            {description || "No description available."}
          </div>
        );
      case "delivery":
        return (
          <div className="pb-4 text-sm text-muted-foreground">
            {DELIVERY_COPY}
            {isApparelCategory(category) && DELIVERY_APPAREL_EXTRA}
          </div>
        );
      case "returns":
        return (
          <div className="pb-4 text-sm text-muted-foreground">
            {RETURNS_COPY}
          </div>
        );
      case "payment": {
        const hasCrypto = paymentOptions.crypto.length > 0;
        const hasCard = paymentOptions.card.length > 0;
        const hasStablecoins = paymentOptions.stablecoins.length > 0;
        if (!hasCrypto && !hasCard && !hasStablecoins) {
          return (
            <div className="pb-4 text-sm text-muted-foreground">
              Payment options are configured at checkout.
            </div>
          );
        }
        return (
          <div className="space-y-4 pb-4 text-sm text-muted-foreground">
            {hasCrypto && (
              <div>
                <p className="mb-1 font-medium text-foreground">
                  Cryptocurrency Payments
                </p>
                <p>
                  We accept {paymentOptions.crypto.join(", ")} and other popular
                  cryptocurrencies. Check the full list of accepted currencies
                  at checkout.
                </p>
              </div>
            )}
            {hasStablecoins && (
              <div>
                <p className="mb-1 font-medium text-foreground">
                  Stablecoins
                </p>
                <p>{paymentOptions.stablecoins.join(". ")}</p>
              </div>
            )}
            {hasCard && (
              <div>
                <p className="mb-1 font-medium text-foreground">
                  Card Payments
                </p>
                <p>{paymentOptions.card.join(", ")}</p>
              </div>
            )}
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="mt-6 border-y border-border">
      {ITEMS.map((item) => {
        const isOpen = isPanelOpen(item.id);
        return (
          <div
            key={item.id}
            className="border-b border-border last:border-b-0"
          >
            <button
              type="button"
              onClick={() => toggleOpen(item.id)}
              className="flex w-full items-center justify-between py-4 text-left font-medium transition-colors hover:text-foreground"
              aria-expanded={isOpen}
              aria-controls={`accordion-content-${item.id}`}
              id={`accordion-trigger-${item.id}`}
            >
              {item.label}
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 transition-transform",
                  isOpen && "rotate-180",
                )}
                aria-hidden
              />
            </button>
            <div
              id={`accordion-content-${item.id}`}
              role="region"
              aria-labelledby={`accordion-trigger-${item.id}`}
              className={cn(
                "overflow-hidden transition-all",
                isOpen ? "visible" : "hidden",
              )}
            >
              {renderContent(item.id)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
