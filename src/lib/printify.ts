/**
 * Printify API Client
 *
 * This client provides functions to interact with the Printify API (v1).
 * It handles authentication using PRINTIFY_API_TOKEN.
 *
 * Docs: https://developers.printify.com/#overview
 *
 * Rate limits:
 * - 600 requests per minute (global)
 * - 100 requests per minute (catalog endpoints)
 */

const PRINTIFY_V1_BASE_URL = "https://api.printify.com/v1";

export function getPrintifyToken(): string {
  const token = process.env.PRINTIFY_API_TOKEN?.trim();
  if (!token) {
    throw new Error("PRINTIFY_API_TOKEN is not set in environment variables");
  }
  return token;
}

export function getPrintifyShopId(): string {
  const shopId = process.env.PRINTIFY_SHOP_ID?.trim();
  if (!shopId) {
    throw new Error("PRINTIFY_SHOP_ID is not set in environment variables");
  }
  return shopId;
}

export function getPrintifyIfConfigured(): {
  token: string;
  shopId: string;
} | null {
  try {
    const token = getPrintifyToken();
    const shopId = getPrintifyShopId();
    return { token, shopId };
  } catch {
    return null;
  }
}

type PrintifyFetchOptions = Omit<RequestInit, "body"> & { shopId?: string; body?: unknown };

async function printifyFetch<T>(
  endpoint: string,
  options?: PrintifyFetchOptions,
): Promise<T> {
  const token = getPrintifyToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "CultureStore/1.0", // Required by Printify
    ...options?.headers,
  };

  const url = endpoint.startsWith("http")
    ? endpoint
    : `${PRINTIFY_V1_BASE_URL}${endpoint}`;

  const { body: bodyOption, ...restOptions } = options ?? {};
  const bodyInit: BodyInit | null | undefined =
    bodyOption != null && typeof bodyOption === "object"
      ? JSON.stringify(bodyOption)
      : (bodyOption as BodyInit | null | undefined);

  const res = await fetch(url, {
    ...restOptions,
    headers,
    body: bodyInit,
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(
      `Printify API Error (${res.status} ${res.statusText}): ${errorBody}`,
    );
    throw new Error(
      `Printify API Error: ${res.status} ${res.statusText} - ${errorBody}`,
    );
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return {} as T;
  }

  return res.json() as Promise<T>;
}

// --- Shops ---

export type PrintifyShop = {
  id: number;
  title: string;
  sales_channel: string;
};

/** GET /v1/shops.json - Retrieve a list of existing shops in a Printify account */
export function fetchPrintifyShops(): Promise<PrintifyShop[]> {
  return printifyFetch("/shops.json");
}

// --- Catalog (Blueprints & Print Providers) ---

export type PrintifyBlueprint = {
  id: number;
  title: string;
  description: string;
  brand: string;
  model: string;
  images: string[];
};

export type PrintifyPrintProvider = {
  id: number;
  title: string;
  location?: {
    address1: string;
    address2: string | null;
    city: string;
    country: string;
    region: string;
    zip: string;
  };
};

export type PrintifyVariant = {
  id: number;
  title: string;
  options: Record<string, string>; // e.g. { color: "Black", size: "M" }
  placeholders: Array<{
    position: string;
    height: number;
    width: number;
  }>;
};

export type PrintifyShippingProfile = {
  variant_ids: number[];
  first_item: { currency: string; cost: number };
  additional_items: { currency: string; cost: number };
  countries: string[]; // ISO country codes or "REST_OF_THE_WORLD"
};

export type PrintifyShippingInfo = {
  handling_time: { value: number; unit: string };
  profiles: PrintifyShippingProfile[];
};

/** GET /v1/catalog/blueprints.json */
export function fetchPrintifyBlueprints(): Promise<PrintifyBlueprint[]> {
  return printifyFetch("/catalog/blueprints.json");
}

/** GET /v1/catalog/blueprints/{blueprint_id}.json */
export function fetchPrintifyBlueprint(
  blueprintId: number,
): Promise<PrintifyBlueprint> {
  return printifyFetch(`/catalog/blueprints/${blueprintId}.json`);
}

/** GET /v1/catalog/blueprints/{blueprint_id}/print_providers.json */
export function fetchPrintifyPrintProviders(
  blueprintId: number,
): Promise<PrintifyPrintProvider[]> {
  return printifyFetch(
    `/catalog/blueprints/${blueprintId}/print_providers.json`,
  );
}

/** GET /v1/catalog/blueprints/{blueprint_id}/print_providers/{print_provider_id}/variants.json */
export function fetchPrintifyVariants(
  blueprintId: number,
  printProviderId: number,
): Promise<{ id: number; title: string; variants: PrintifyVariant[] }> {
  return printifyFetch(
    `/catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/variants.json`,
  );
}

/** GET /v1/catalog/blueprints/{blueprint_id}/print_providers/{print_provider_id}/shipping.json */
export function fetchPrintifyShippingInfo(
  blueprintId: number,
  printProviderId: number,
): Promise<PrintifyShippingInfo> {
  return printifyFetch(
    `/catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/shipping.json`,
  );
}

// --- Products (in Shop) ---

export type PrintifyProduct = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  /** Country of origin (e.g. for shipping/customs); set in admin or from catalog when available. */
  country_of_origin?: string | null;
  /** HS / tariff code for international shipping; set in admin or from catalog when available. */
  hs_code?: string | null;
  options: Array<{
    name: string;
    type: string;
    values: Array<{ id: number; title: string }>;
  }>;
  variants: Array<{
    id: number;
    sku: string;
    cost: number;
    price: number;
    title: string;
    grams: number;
    is_enabled: boolean;
    is_default: boolean;
    is_available: boolean;
    options: number[];
  }>;
  images: Array<{
    src: string;
    variant_ids: number[];
    position: string;
    is_default: boolean;
  }>;
  created_at: string;
  updated_at: string;
  visible: boolean;
  is_locked: boolean;
  blueprint_id: number;
  user_id: number;
  shop_id: number;
  print_provider_id: number;
  print_areas: Array<{
    variant_ids: number[];
    placeholders: Array<{
      position: string;
      images: Array<{
        id: string;
        src: string;
        name: string;
        type: string;
        height: number;
        width: number;
        x: number;
        y: number;
        scale: number;
        angle: number;
      }>;
    }>;
  }>;
};

export type PrintifyProductsResponse = {
  current_page: number;
  data: PrintifyProduct[];
  first_page_url: string;
  last_page: number;
  last_page_url: string;
  next_page_url: string | null;
  prev_page_url: string | null;
  total: number;
};

/** POST /v1/shops/{shop_id}/products.json - Create a new product */
export type PrintifyCreateProductBody = {
  title: string;
  description: string;
  blueprint_id: number;
  print_provider_id: number;
  variants: Array<{ id: number; price: number; is_enabled?: boolean }>;
  print_areas: Array<{
    variant_ids: number[];
    placeholders: Array<{
      position: string;
      images: Array<{
        id: string;
        x: number;
        y: number;
        scale: number;
        angle: number;
      }>;
    }>;
  }>;
  tags?: string[];
};

export function createPrintifyProduct(
  shopId: string,
  body: PrintifyCreateProductBody,
): Promise<PrintifyProduct> {
  return printifyFetch(`/shops/${shopId}/products.json`, {
    method: "POST",
    body,
  } as unknown as Parameters<typeof printifyFetch>[1]);
}

/** GET /v1/shops/{shop_id}/products.json */
export function fetchPrintifyProducts(
  shopId: string,
  params?: { limit?: number; page?: number },
): Promise<PrintifyProductsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.page) searchParams.set("page", String(params.page));
  const qs = searchParams.toString();
  return printifyFetch(`/shops/${shopId}/products.json${qs ? `?${qs}` : ""}`);
}

/** GET /v1/shops/{shop_id}/products/{product_id}.json */
export function fetchPrintifyProduct(
  shopId: string,
  productId: string,
): Promise<PrintifyProduct> {
  return printifyFetch(`/shops/${shopId}/products/${productId}.json`);
}

/** PUT /v1/shops/{shop_id}/products/{product_id}.json - Update a product */
export function updatePrintifyProduct(
  shopId: string,
  productId: string,
  body: {
    title?: string;
    description?: string;
    tags?: string[];
    variants?: Array<{
      id: number;
      price: number;
      is_enabled?: boolean;
    }>;
  },
): Promise<PrintifyProduct> {
  return printifyFetch(`/shops/${shopId}/products/${productId}.json`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

/** DELETE /v1/shops/{shop_id}/products/{product_id}.json - Delete a product */
export async function deletePrintifyProduct(
  shopId: string,
  productId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await printifyFetch(`/shops/${shopId}/products/${productId}.json`, {
      method: "DELETE",
    });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

/** POST /v1/shops/{shop_id}/products/{product_id}/publish.json - Publish product */
export async function publishPrintifyProduct(
  shopId: string,
  productId: string,
  options: {
    title?: boolean;
    description?: boolean;
    images?: boolean;
    variants?: boolean;
    tags?: boolean;
  } = {},
): Promise<{ success: boolean; error?: string }> {
  try {
    await printifyFetch(`/shops/${shopId}/products/${productId}/publish.json`, {
      method: "POST",
      body: JSON.stringify({
        title: options.title ?? true,
        description: options.description ?? true,
        images: options.images ?? true,
        variants: options.variants ?? true,
        tags: options.tags ?? true,
      }),
    });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

// --- Orders ---

export type PrintifyOrderRecipient = {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  country: string; // ISO country code
  region?: string; // State code
  address1: string;
  address2?: string;
  city: string;
  zip: string;
};

export type PrintifyOrderLineItem = {
  product_id: string; // Printify Product ID
  variant_id: number; // Printify Product Variant ID
  quantity: number;
};

// Shipping methods: 1=Standard, 2=Priority (Express), 3=Printify Express, 4=Economy
export type PrintifyShippingMethod = 1 | 2 | 3 | 4;

export type PrintifyCreateOrderRequest = {
  external_id?: string; // Our Order ID
  label?: string;
  line_items: PrintifyOrderLineItem[];
  shipping_method: PrintifyShippingMethod;
  is_printify_express?: boolean;
  is_economy_shipping?: boolean;
  send_shipping_notification: boolean;
  address_to: PrintifyOrderRecipient;
};

export type PrintifyOrder = {
  id: string;
  address_to: PrintifyOrderRecipient;
  line_items: Array<{
    product_id: string;
    quantity: number;
    variant_id: number;
    print_provider_id: number;
    cost: number;
    shipping_cost: number;
    status: string;
    metadata: {
      title: string;
      variant_label: string;
      sku: string;
      country: string;
    };
    sent_to_production_at: string | null;
    fulfilled_at: string | null;
  }>;
  metadata: {
    order_type: string;
    shop_order_id: number;
    shop_order_label: string;
    shop_fulfilled_at: string | null;
  };
  total_price: number;
  total_shipping: number;
  total_tax: number;
  status: string; // "pending", "on-hold", "sending-to-production", "in-production", "shipping", "shipped", "delivered", "canceled"
  shipping_method: PrintifyShippingMethod;
  is_printify_express: boolean;
  is_economy_shipping: boolean;
  shipments: Array<{
    carrier: string;
    number: string;
    url: string;
    delivered_at: string | null;
  }>;
  created_at: string;
  sent_to_production_at: string | null;
  fulfilled_at: string | null;
};

export type PrintifyOrderResponse = PrintifyOrder;

/** POST /v1/shops/{shop_id}/orders.json - Create an order */
export function createPrintifyOrder(
  shopId: string,
  body: PrintifyCreateOrderRequest,
): Promise<PrintifyOrderResponse> {
  return printifyFetch(`/shops/${shopId}/orders.json`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** POST /v1/shops/{shop_id}/orders/{order_id}/send_to_production.json - Send to production */
export function sendPrintifyOrderToProduction(
  shopId: string,
  orderId: string,
): Promise<PrintifyOrderResponse> {
  return printifyFetch(
    `/shops/${shopId}/orders/${orderId}/send_to_production.json`,
    {
      method: "POST",
    },
  );
}

/** POST /v1/shops/{shop_id}/orders/{order_id}/cancel.json - Cancel an order */
export async function cancelPrintifyOrder(
  shopId: string,
  orderId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await printifyFetch(`/shops/${shopId}/orders/${orderId}/cancel.json`, {
      method: "POST",
    });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    // Check if order cannot be cancelled (already in production)
    if (message.includes("409") || message.includes("cannot be cancelled")) {
      return {
        success: false,
        error: "Order cannot be cancelled - already in production",
      };
    }
    return { success: false, error: message };
  }
}

/** GET /v1/shops/{shop_id}/orders/{order_id}.json - Get order details */
export function getPrintifyOrder(
  shopId: string,
  orderId: string,
): Promise<PrintifyOrderResponse> {
  return printifyFetch(`/shops/${shopId}/orders/${orderId}.json`);
}

// --- Shipping Calculation ---

/**
 * Printify doesn't have a direct shipping rate API like Printful.
 * Shipping is calculated based on:
 * 1. Blueprint + Print Provider shipping profiles (from catalog)
 * 2. Country-based flat rates per item
 *
 * This function calculates shipping based on cached/fetched shipping profiles.
 */
export type PrintifyShippingLineItem = {
  blueprintId: number;
  printProviderId: number;
  variantId: number;
  quantity: number;
};

export type PrintifyShippingRateResult = {
  shippingCents: number;
  method: "standard" | "economy" | "express";
  countries: string[];
  canShipToCountry: boolean;
};

/**
 * Calculate shipping for Printify items based on blueprint/provider shipping profiles.
 * Note: This requires knowing the blueprint_id and print_provider_id for each product.
 */
export async function calculatePrintifyShipping(
  items: PrintifyShippingLineItem[],
  countryCode: string,
): Promise<PrintifyShippingRateResult> {
  if (items.length === 0) {
    return {
      shippingCents: 0,
      method: "standard",
      countries: [],
      canShipToCountry: true,
    };
  }

  let totalShippingCents = 0;
  let canShipToCountry = true;
  const allCountries = new Set<string>();
  let isFirstItem = true;

  // Group items by blueprint+provider to minimize API calls
  const groupedItems = new Map<
    string,
    {
      blueprintId: number;
      printProviderId: number;
      items: PrintifyShippingLineItem[];
    }
  >();

  for (const item of items) {
    const key = `${item.blueprintId}-${item.printProviderId}`;
    if (!groupedItems.has(key)) {
      groupedItems.set(key, {
        blueprintId: item.blueprintId,
        printProviderId: item.printProviderId,
        items: [],
      });
    }
    groupedItems.get(key)!.items.push(item);
  }

  // Fetch shipping info for each blueprint+provider combination
  for (const [, group] of groupedItems) {
    try {
      const shippingInfo = await fetchPrintifyShippingInfo(
        group.blueprintId,
        group.printProviderId,
      );

      for (const item of group.items) {
        // Find the shipping profile for this variant and country
        const profile = shippingInfo.profiles.find(
          (p) =>
            p.variant_ids.includes(item.variantId) &&
            (p.countries.includes(countryCode) ||
              p.countries.includes("REST_OF_THE_WORLD")),
        );

        if (!profile) {
          // No shipping profile found for this country
          canShipToCountry = false;
          console.warn(
            `No Printify shipping profile for variant ${item.variantId} to ${countryCode}`,
          );
          continue;
        }

        // Add countries to set
        profile.countries.forEach((c) => allCountries.add(c));

        // Calculate shipping cost
        for (let i = 0; i < item.quantity; i++) {
          if (isFirstItem) {
            totalShippingCents += profile.first_item.cost;
            isFirstItem = false;
          } else {
            totalShippingCents += profile.additional_items.cost;
          }
        }
      }
    } catch (error) {
      console.error(
        `Failed to fetch Printify shipping info for blueprint ${group.blueprintId}:`,
        error,
      );
      // Continue with other items, don't fail entirely
    }
  }

  return {
    shippingCents: totalShippingCents,
    method: "standard",
    countries: Array.from(allCountries),
    canShipToCountry,
  };
}

// --- Webhooks ---

export type PrintifyWebhookEventType =
  | "shop:disconnected"
  | "product:deleted"
  | "product:publish:started"
  | "product:published"
  | "order:created"
  | "order:updated"
  | "order:sent-to-production"
  | "order:shipment:created"
  | "order:shipment:delivered";

export type PrintifyWebhookEvent = {
  id: string;
  type: PrintifyWebhookEventType;
  created_at: string;
  resource: {
    id: string;
    type: "shop" | "product" | "order";
    data: Record<string, unknown>;
  };
};

export type PrintifyWebhookSubscription = {
  id: string;
  topic: PrintifyWebhookEventType;
  url: string;
  shop_id: string;
};

/** POST /v1/shops/{shop_id}/webhooks.json - Create a webhook */
export function createPrintifyWebhook(
  shopId: string,
  topic: PrintifyWebhookEventType,
  url: string,
): Promise<PrintifyWebhookSubscription> {
  return printifyFetch(`/shops/${shopId}/webhooks.json`, {
    method: "POST",
    body: JSON.stringify({ topic, url }),
  });
}

/** GET /v1/shops/{shop_id}/webhooks.json - List webhooks */
export function listPrintifyWebhooks(
  shopId: string,
): Promise<PrintifyWebhookSubscription[]> {
  return printifyFetch(`/shops/${shopId}/webhooks.json`);
}

/** DELETE /v1/shops/{shop_id}/webhooks/{webhook_id}.json - Delete a webhook */
export async function deletePrintifyWebhook(
  shopId: string,
  webhookId: string,
): Promise<{ success: boolean }> {
  try {
    await printifyFetch(`/shops/${shopId}/webhooks/${webhookId}.json`, {
      method: "DELETE",
    });
    return { success: true };
  } catch {
    return { success: false };
  }
}
