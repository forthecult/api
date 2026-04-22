/**
 * Privacy-first storefront analytics (PostHog via reverse proxy by default; opt-in via `NEXT_PUBLIC_POSTHOG_KEY`).
 * Event names mirror common eCommerce funnels for dashboards — not Google Analytics.
 */

import posthog from "posthog-js";

export function trackAddToCart(payload: {
  currency?: string;
  price: number;
  productId: string;
  productName: string;
  quantity: number;
  variantId?: string;
}): void {
  capture("add_to_cart", {
    currency: (payload.currency ?? "USD").toUpperCase(),
    items: [
      {
        item_id: payload.productId,
        item_name: payload.productName,
        item_variant: payload.variantId,
        price: payload.price,
        quantity: payload.quantity,
      },
    ],
    value: payload.price * payload.quantity,
  });
}

export function trackBeginCheckout(payload: {
  currency?: string;
  items: {
    price: number;
    productId?: string;
    productName: string;
    quantity: number;
    variantId?: string;
  }[];
  value: number;
}): void {
  capture("begin_checkout", {
    currency: (payload.currency ?? "USD").toUpperCase(),
    items: payload.items.map((i) => ({
      item_id: i.productId,
      item_name: i.productName,
      item_variant: i.variantId,
      price: i.price,
      quantity: i.quantity,
    })),
    value: payload.value,
  });
}

export function trackPurchase(payload: {
  currency?: string;
  items: {
    priceUsd?: number;
    productId?: null | string;
    quantity: number;
    title: string;
  }[];
  orderId: string;
  valueUsd: number;
}): void {
  capture("purchase", {
    currency: (payload.currency ?? "USD").toUpperCase(),
    items: payload.items.map((i) => ({
      item_id: i.productId ?? undefined,
      item_name: i.title,
      price: i.priceUsd,
      quantity: i.quantity,
    })),
    order_id: payload.orderId,
    transaction_id: payload.orderId,
    value: payload.valueUsd,
  });
}

export function trackViewItem(payload: {
  currency?: string;
  price: number;
  productId: string;
  productName: string;
  variantId?: string;
}): void {
  capture("view_item", {
    currency: (payload.currency ?? "USD").toUpperCase(),
    items: [
      {
        item_id: payload.productId,
        item_name: payload.productName,
        item_variant: payload.variantId,
        price: payload.price,
        quantity: 1,
      },
    ],
    value: payload.price,
  });
}

export function trackViewItemList(payload: {
  itemCount: number;
  listId?: string;
  listName: string;
}): void {
  capture("view_item_list", {
    item_list_id: payload.listId ?? payload.listName,
    item_list_name: payload.listName,
    items_count: payload.itemCount,
  });
}

function capture(event: string, properties?: Record<string, unknown>): void {
  if (typeof window === "undefined" || !enabled()) return;
  try {
    posthog.capture(event, properties);
  } catch {
    // ignore
  }
}

function enabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim());
}
