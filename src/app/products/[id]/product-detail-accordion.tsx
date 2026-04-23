"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { getPaymentOptionsForDisplay } from "~/lib/checkout-payment-options";
import { cn } from "~/lib/cn";
import { usePaymentMethodSettings } from "~/lib/hooks/use-payment-method-settings";
import { sanitizeProductDescription } from "~/lib/sanitize-product-description";

import { ProductShippingEstimateForm } from "./product-shipping-estimate-form";

const BASE_ITEMS = [
  { id: "description", label: "Description" },
  { id: "delivery", label: "Delivery" },
  { id: "returns", label: "Refunds and Returns" },
  { id: "payment", label: "Payment Options" },
] as const;

interface SizeChartData {
  availableSizes?: string[];
  sizeTables?: {
    description?: string;
    image_url?: string;
    measurements?: {
      type_label: string;
      values: (
        | { max_value: string; min_value: string; size: string }
        | { size: string; value: string }
      )[];
    }[];
    type: string;
    unit: string;
  }[];
}

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
      location and what products you are purchasing. Use the estimate tool
      below, or review totals in your cart at checkout.
    </p>
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
      Refunds are in stablecoin or the fiat currency you paid in. We stand by
      our products 100% and want our customers to love them as much as we do. In
      the event that you are unsatisfied with your purchase, please contact us
      within 14 days of receiving your order for an exchange or refund.
    </p>
    <p className="mb-3">We are happy when you are happy.</p>
    <p>
      You can contact us by emailing at{" "}
      <a
        className={`
          underline
          hover:no-underline
        `}
        href="mailto:support@forthecult.store"
      >
        support@forthecult.store
      </a>{" "}
      or visiting our{" "}
      <Link
        className={`
          underline
          hover:no-underline
        `}
        href="/contact"
      >
        Contact Us Page
      </Link>
      .
    </p>
  </>
);

export interface ProductDetailAccordionProps {
  /** When non-empty, country list in the shipping estimate is limited to these ISO codes. */
  availableCountryCodes?: string[];
  category: string;
  description: string;
  /** When true, description is sanitized HTML and will be rendered as HTML. */
  descriptionIsHtml?: boolean;
  productId: string;
  /** When set, adds a "Size Guide: {displayName}" accordion section with imperial + metric charts. */
  sizeChart?: {
    dataImperial: unknown;
    dataMetric: unknown;
    displayName: string;
  };
}

export function ProductDetailAccordion({
  availableCountryCodes,
  category,
  description,
  descriptionIsHtml,
  productId,
  sizeChart,
}: ProductDetailAccordionProps) {
  const items = React.useMemo(() => {
    const list: { id: string; label: string }[] = [...BASE_ITEMS];
    if (sizeChart) {
      list.splice(1, 0, {
        id: "size-guide",
        label: `Size Guide: ${sizeChart.displayName}`,
      });
    }
    return list;
  }, [sizeChart]);

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
      case "delivery":
        return (
          <div className="pb-4 text-sm text-muted-foreground">
            {DELIVERY_COPY}
            {isApparelCategory(category) && DELIVERY_APPAREL_EXTRA}
            <div
              className={`
                mt-6 flex flex-col gap-2 border-t border-border/60 pt-4 text-sm
                text-muted-foreground
              `}
            >
              <ProductShippingEstimateForm
                availableCountryCodes={availableCountryCodes}
                productId={productId}
              />
            </div>
          </div>
        );
      case "description":
        if (descriptionIsHtml && description) {
          return (
            <div
              className={`
                prose prose-sm max-w-none pb-4 text-sm text-muted-foreground
                dark:prose-invert
              `}
              dangerouslySetInnerHTML={{
                __html: sanitizeProductDescription(description),
              }}
            />
          );
        }
        return (
          <div
            className={`pb-4 text-sm whitespace-pre-wrap text-muted-foreground`}
          >
            {description || "No description available."}
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
                <p className="mb-1 font-medium text-foreground">Stablecoins</p>
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
      case "returns":
        return (
          <div className="pb-4 text-sm text-muted-foreground">
            {RETURNS_COPY}
          </div>
        );
      case "size-guide": {
        if (!sizeChart) return null;
        const imperial = sizeChart.dataImperial as SizeChartData | undefined;
        const metric = sizeChart.dataMetric as SizeChartData | undefined;
        const hasImperial = imperial?.sizeTables?.length;
        const hasMetric = metric?.sizeTables?.length;
        if (!hasImperial && !hasMetric) {
          return (
            <div className="pb-4 text-sm text-muted-foreground">
              No size chart data available.
            </div>
          );
        }
        return (
          <div className="pb-4 text-sm text-muted-foreground">
            {hasImperial && renderSizeChartData(imperial, "Imperial (in)")}
            {hasMetric && renderSizeChartData(metric, "Metric (cm)")}
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="mt-6 border-y border-border">
      {items.map((item) => {
        const isOpen = isPanelOpen(item.id);
        return (
          <div
            className={`
              border-b border-border
              last:border-b-0
            `}
            key={item.id}
          >
            <button
              aria-controls={`accordion-content-${item.id}`}
              aria-expanded={isOpen}
              className={`
                flex w-full items-center justify-between py-4 text-left
                font-medium transition-colors
                hover:text-foreground
              `}
              id={`accordion-trigger-${item.id}`}
              onClick={() => toggleOpen(item.id)}
              type="button"
            >
              {item.label}
              <ChevronDown
                aria-hidden
                className={cn(
                  "h-4 w-4 shrink-0 transition-transform",
                  isOpen && "rotate-180",
                )}
              />
            </button>
            <div
              aria-labelledby={`accordion-trigger-${item.id}`}
              className={cn(
                "overflow-hidden transition-all",
                isOpen ? "visible" : "hidden",
              )}
              id={`accordion-content-${item.id}`}
              role="region"
            >
              {renderContent(item.id)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

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

function renderSizeChartData(
  data: null | SizeChartData | undefined,
  unitLabel: string,
) {
  if (!data?.sizeTables?.length) return null;
  return (
    <div className="mb-6">
      <h4 className="mb-2 text-sm font-semibold text-foreground">
        {unitLabel}
      </h4>
      {data.sizeTables.map((table, idx) => {
        const measurements = table.measurements ?? [];
        const canCombine =
          measurements.length > 1 &&
          measurements.every(
            (m) => m.values.length === measurements[0]?.values.length,
          ) &&
          measurements.every((m, _i) =>
            m.values.every(
              (v, j) => v.size === measurements[0]?.values[j]?.size,
            ),
          );

        if (canCombine && measurements.length > 0) {
          const sizeColumn = measurements[0]!.values.map((v) => v.size);
          const columns = ["Size", ...measurements.map((m) => m.type_label)];
          return (
            <div className="mb-6" key={idx}>
              {table.description != null &&
                renderSizeChartDescription(table.description)}
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full min-w-[320px] border-collapse text-sm">
                  <thead>
                    <tr className="bg-muted/60">
                      {columns.map((col, cidx) => (
                        <th
                          className={`
                            px-3 py-2.5 text-left font-semibold text-foreground
                            first:rounded-tl-md
                            last:rounded-tr-md
                          `}
                          key={cidx}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sizeColumn.map((size, rowIdx) => (
                      <tr
                        className={cn(
                          "border-t border-border/60",
                          rowIdx % 2 === 1 && "bg-muted/30",
                        )}
                        key={rowIdx}
                      >
                        <td className="px-3 py-2 font-medium text-foreground">
                          {size}
                        </td>
                        {measurements.map((m, midx) => {
                          const v = m.values[rowIdx];
                          const cell =
                            v && "value" in v
                              ? v.value
                              : v && "min_value" in v
                                ? `${v.min_value} – ${v.max_value}`
                                : "—";
                          return (
                            <td
                              className="px-3 py-2 text-muted-foreground"
                              key={midx}
                            >
                              {cell}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        }

        return (
          <div className="mb-4" key={idx}>
            {table.description != null &&
              renderSizeChartDescription(table.description)}
            {measurements.map((m, midx) => (
              <div
                className="mb-3 overflow-x-auto rounded-md border border-border"
                key={midx}
              >
                <table className="w-full min-w-[200px] border-collapse text-sm">
                  <thead>
                    <tr className="bg-muted/60">
                      <th
                        className={`
                          px-3 py-2 text-left font-semibold text-foreground
                        `}
                      >
                        Size
                      </th>
                      <th
                        className={`
                          px-3 py-2 text-left font-semibold text-foreground
                        `}
                      >
                        {m.type_label}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.values.map((v, vidx) => (
                      <tr
                        className={cn(
                          "border-t border-border/60",
                          vidx % 2 === 1 && "bg-muted/30",
                        )}
                        key={vidx}
                      >
                        <td className="px-3 py-2 font-medium">{v.size}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {"value" in v
                            ? v.value
                            : `${v.min_value} – ${v.max_value}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** Render size chart description as HTML when it contains tags, otherwise as plain text. */
function renderSizeChartDescription(description: null | string | undefined) {
  if (!description?.trim()) return null;
  const trimmed = description.trim();
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(trimmed);
  if (looksLikeHtml) {
    const sanitized = sanitizeProductDescription(trimmed);
    if (!sanitized) return null;
    return (
      <div
        className={`
          prose prose-sm mb-3 max-w-none text-sm text-muted-foreground
          dark:prose-invert
          [&_p]:mb-1
          [&_p:last-child]:mb-0
        `}
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    );
  }
  return <p className="mb-3 text-sm text-muted-foreground">{trimmed}</p>;
}
