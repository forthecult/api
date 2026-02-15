/**
 * Printify API Client — Full V1 + V2 Coverage
 *
 * This client provides functions to interact with the Printify API (v1 & v2).
 * It handles authentication using PRINTIFY_API_TOKEN.
 *
 * Docs: https://developers.printify.com/#overview
 *
 * Endpoint coverage (per OpenAPI spec):
 * ✅ Shops:    list, disconnect
 * ✅ Catalog:  blueprints (list, get), print providers (list by bp, list all, get by id),
 *              variants (list, +out-of-stock), shipping (V1 profiles, V2 per-method)
 * ✅ Products: CRUD, publish/unpublish, publishing_succeeded/_failed, GPSR
 * ✅ Orders:   list, create, get, cancel, send_to_production, express, shipping calc
 * ✅ Uploads:  list, get, upload (URL + base64 in pod/upload.ts), archive
 * ✅ Webhooks: list, create, update, delete
 * ✅ V2:       catalog shipping (combined + per-method standard/priority/express/economy)
 *
 * Rate limits:
 * - 600 requests per minute (global)
 * - 100 requests per minute (catalog endpoints)
 * - 200 requests per 30 minutes (product publishing)
 */

const PRINTIFY_V1_BASE_URL = "https://api.printify.com/v1";
const PRINTIFY_V2_BASE_URL = "https://api.printify.com/v2";

export interface PrintifyBlueprint {
  brand: string;
  description: string;
  id: number;
  images: string[];
  model: string;
  title: string;
}

export interface PrintifyCreateOrderRequest {
  address_to: PrintifyOrderRecipient;
  external_id?: string; // Our Order ID
  is_economy_shipping?: boolean;
  is_printify_express?: boolean;
  label?: string;
  line_items: PrintifyOrderLineItem[];
  send_shipping_notification: boolean;
  shipping_method: PrintifyShippingMethod;
}

/** POST /v1/shops/{shop_id}/products.json - Create a new product */
export interface PrintifyCreateProductBody {
  blueprint_id: number;
  description: string;
  print_areas: {
    placeholders: {
      images: {
        angle: number;
        id: string;
        scale: number;
        x: number;
        y: number;
      }[];
      position: string;
    }[];
    variant_ids: number[];
  }[];
  print_provider_id: number;
  tags?: string[];
  title: string;
  variants: { id: number; is_enabled?: boolean; price: number }[];
}

export interface PrintifyGpsrData {
  [key: string]: unknown;
  manufacturer?: {
    address?: string;
    email?: string;
    name?: string;
    phone?: string;
  };
  responsible_person?: {
    address?: string;
    email?: string;
    name?: string;
    phone?: string;
  };
}

export interface PrintifyOrder {
  address_to: PrintifyOrderRecipient;
  created_at: string;
  fulfilled_at: null | string;
  id: string;
  is_economy_shipping: boolean;
  is_printify_express: boolean;
  line_items: {
    cost: number;
    fulfilled_at: null | string;
    metadata: {
      country: string;
      sku: string;
      title: string;
      variant_label: string;
    };
    print_provider_id: number;
    product_id: string;
    quantity: number;
    sent_to_production_at: null | string;
    shipping_cost: number;
    status: string;
    variant_id: number;
  }[];
  metadata: {
    order_type: string;
    shop_fulfilled_at: null | string;
    shop_order_id: number;
    shop_order_label: string;
  };
  sent_to_production_at: null | string;
  shipments: {
    carrier: string;
    delivered_at: null | string;
    number: string;
    url: string;
  }[];
  shipping_method: PrintifyShippingMethod;
  status: string; // "pending", "on-hold", "sending-to-production", "in-production", "shipping", "shipped", "delivered", "canceled"
  total_price: number;
  total_shipping: number;
  total_tax: number;
}

// --- Shops ---

export interface PrintifyOrderLineItem {
  product_id: string; // Printify Product ID
  quantity: number;
  variant_id: number; // Printify Product Variant ID
}

export interface PrintifyOrderRecipient {
  address1: string;
  address2?: string;
  city: string;
  country: string; // ISO country code
  email?: string;
  first_name: string;
  last_name: string;
  phone?: string;
  region?: string; // State code
  zip: string;
}

// --- Catalog (Blueprints & Print Providers) ---

export type PrintifyOrderResponse = PrintifyOrder;

/**
 * POST /v1/shops/{shop_id}/orders/shipping.json
 *
 * Calculate shipping cost for an order directly from Printify.
 * More accurate than catalog-based calculation as it uses actual order data.
 */
export interface PrintifyOrderShippingRequest {
  address_to: {
    city?: string;
    country: string;
    region?: string;
    zip?: string;
  };
  line_items: PrintifyOrderLineItem[];
}

export interface PrintifyOrderShippingResult {
  economy?: number;
  express: number;
  printify_express?: number;
  priority: number;
  standard: number;
}

export interface PrintifyPrintProvider {
  id: number;
  location?: {
    address1: string;
    address2: null | string;
    city: string;
    country: string;
    region: string;
    zip: string;
  };
  title: string;
}

export interface PrintifyPrintProviderFull {
  blueprints?: {
    brand: string;
    id: number;
    images: string[];
    model: string;
    title: string;
  }[];
  id: number;
  location?: {
    address1: string;
    address2: null | string;
    city: string;
    country: string;
    region: string;
    zip: string;
  };
  title: string;
}

export interface PrintifyProduct {
  blueprint_id: number;
  /** Country of origin (e.g. for shipping/customs); set in admin or from catalog when available. */
  country_of_origin?: null | string;
  created_at: string;
  description: string;
  /** HS / tariff code for international shipping; set in admin or from catalog when available. */
  hs_code?: null | string;
  id: string;
  images: {
    is_default: boolean;
    is_selected_for_publishing?: boolean;
    order?: number;
    position: string;
    src: string;
    variant_ids: number[];
  }[];
  is_economy_shipping_eligible?: boolean;
  is_economy_shipping_enabled?: boolean;
  is_locked: boolean;
  // Shipping eligibility flags
  is_printify_express_eligible?: boolean;
  is_printify_express_enabled?: boolean;
  options: {
    name: string;
    type: string;
    values: { id: number; title: string }[];
  }[];
  print_areas: {
    placeholders: {
      images: {
        angle: number;
        height: number;
        id: string;
        name: string;
        scale: number;
        src: string;
        type: string;
        width: number;
        x: number;
        y: number;
      }[];
      position: string;
    }[];
    variant_ids: number[];
  }[];
  print_provider_id: number;
  // Sales channel properties (external store sync data)
  sales_channel_properties?: Record<string, unknown>[];
  shop_id: number;
  tags: string[];
  title: string;
  updated_at: string;
  user_id: number;
  variants: {
    cost: number;
    grams: number;
    id: number;
    is_available: boolean;
    is_default: boolean;
    is_enabled: boolean;
    is_printify_express_eligible?: boolean;
    options: number[];
    price: number;
    sku: string;
    title: string;
  }[];
  visible: boolean;
}

export interface PrintifyProductsResponse {
  current_page: number;
  data: PrintifyProduct[];
  first_page_url: string;
  last_page: number;
  last_page_url: string;
  next_page_url: null | string;
  prev_page_url: null | string;
  total: number;
}

export interface PrintifyShippingInfo {
  handling_time: { unit: string; value: number };
  profiles: PrintifyShippingProfile[];
}

/**
 * Printify doesn't have a direct shipping rate API like Printful.
 * Shipping is calculated based on:
 * 1. Blueprint + Print Provider shipping profiles (from catalog)
 * 2. Country-based flat rates per item
 *
 * This function calculates shipping based on cached/fetched shipping profiles.
 */
export interface PrintifyShippingLineItem {
  blueprintId: number;
  printProviderId: number;
  quantity: number;
  variantId: number;
}

// Shipping methods: 1=Standard, 2=Priority (Express), 3=Printify Express, 4=Economy
export type PrintifyShippingMethod = 1 | 2 | 3 | 4;

// --- Products (in Shop) ---

export interface PrintifyShippingProfile {
  additional_items: { cost: number; currency: string };
  countries: string[]; // ISO country codes or "REST_OF_THE_WORLD"
  first_item: { cost: number; currency: string };
  variant_ids: number[];
}

export interface PrintifyShippingRateResult {
  canShipToCountry: boolean;
  countries: string[];
  method: "economy" | "express" | "standard";
  shippingCents: number;
}

export interface PrintifyShop {
  id: number;
  sales_channel: string;
  title: string;
}

export interface PrintifyUploadResult {
  file_name: string;
  height: number;
  id: string;
  mime_type: string;
  preview_url?: string;
  size: number;
  width: number;
}

/**
 * V2 shipping data uses JSON:API format with granular shipping methods.
 */
export interface PrintifyV2ShippingMethod {
  attributes: {
    handling_time: { unit: string; value: number };
    method: string; // "standard" | "priority" | "express" | "economy"
    profiles: {
      additional_items: { cost: number; currency: string };
      countries: string[];
      first_item: { cost: number; currency: string };
      variant_ids: number[];
    }[];
  };
  id: string;
  type: string;
}

export interface PrintifyV2ShippingResponse {
  data: PrintifyV2ShippingMethod[];
}

export interface PrintifyVariant {
  /** Available decoration methods for this variant (e.g. ["dtg", "embroidery"]). */
  decoration_methods?: string[];
  id: number;
  options: Record<string, string>; // e.g. { color: "Black", size: "M" }
  placeholders: {
    height: number;
    position: string;
    width: number;
  }[];
  title: string;
}

export interface PrintifyWebhookEvent {
  created_at: string;
  id: string;
  resource: {
    data: Record<string, unknown>;
    id: string;
    type: "order" | "product" | "shop";
  };
  type: PrintifyWebhookEventType;
}

/**
 * Valid Printify webhook subscription topics (per OpenAPI spec).
 * Note: "product:published" does NOT exist as a subscribable topic.
 * Only "product:publish:started" is valid. Printify may send different
 * event type strings in the webhook payload, but subscriptions must
 * use these exact topics.
 */
export type PrintifyWebhookEventType =
  | "order:created"
  | "order:sent-to-production"
  | "order:shipment:created"
  | "order:shipment:delivered"
  | "order:updated"
  | "product:deleted"
  | "product:publish:started"
  | "shop:disconnected";

export interface PrintifyWebhookSubscription {
  id: string;
  shop_id: string;
  topic: PrintifyWebhookEventType;
  url: string;
}

type PrintifyFetchOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  shopId?: string;
};

/** POST /v1/uploads/{image_id}/archive.json - Archive an uploaded image */
export async function archivePrintifyUpload(
  imageId: string,
): Promise<{ error?: string; success: boolean }> {
  try {
    await printifyFetch(`/uploads/${imageId}/archive.json`, {
      method: "POST",
    });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { error: message, success: false };
  }
}

// --- Orders: Shipping Calculation ---

export function calculatePrintifyOrderShipping(
  shopId: string,
  body: PrintifyOrderShippingRequest,
): Promise<PrintifyOrderShippingResult> {
  return printifyFetch(`/shops/${shopId}/orders/shipping.json`, {
    body: JSON.stringify(body),
    method: "POST",
  });
}

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
      canShipToCountry: true,
      countries: [],
      method: "standard",
      shippingCents: 0,
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
      items: PrintifyShippingLineItem[];
      printProviderId: number;
    }
  >();

  for (const item of items) {
    const key = `${item.blueprintId}-${item.printProviderId}`;
    if (!groupedItems.has(key)) {
      groupedItems.set(key, {
        blueprintId: item.blueprintId,
        items: [],
        printProviderId: item.printProviderId,
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
    canShipToCountry,
    countries: Array.from(allCountries),
    method: "standard",
    shippingCents: totalShippingCents,
  };
}

/** POST /v1/shops/{shop_id}/orders/{order_id}/cancel.json - Cancel an order */
export async function cancelPrintifyOrder(
  shopId: string,
  orderId: string,
): Promise<{ error?: string; success: boolean }> {
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
        error: "Order cannot be cancelled - already in production",
        success: false,
      };
    }
    return { error: message, success: false };
  }
}

// --- Orders ---

/**
 * POST /v1/shops/{shop_id}/products/{product_id}/publishing_succeeded.json
 *
 * Tell Printify that the product was successfully published on our store.
 * This is the critical step 3 of the publish handshake:
 *   1. POST .../publish.json (initiate)
 *   2. Printify fires product:publish:started webhook → we return 200
 *   3. We call publishing_succeeded.json → Printify clears "Publishing" status
 *
 * Without this call, Printify keeps the product stuck in "Publishing" indefinitely.
 */
export async function confirmPrintifyPublishingSucceeded(
  shopId: string,
  productId: string,
  external: { handle: string; id: string },
): Promise<{ error?: string; success: boolean }> {
  try {
    await printifyFetch(
      `/shops/${shopId}/products/${productId}/publishing_succeeded.json`,
      {
        body: JSON.stringify({ external }),
        method: "POST",
      },
    );
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(
      `Printify publishing_succeeded failed for ${productId}:`,
      message,
    );
    return { error: message, success: false };
  }
}

/**
 * POST /v1/shops/{shop_id}/orders/express.json - Create a Printify Express order
 *
 * Printify Express offers expedited fulfillment. Products must have
 * is_printify_express_eligible = true and is_printify_express_enabled = true.
 */
export function createPrintifyExpressOrder(
  shopId: string,
  body: PrintifyCreateOrderRequest,
): Promise<PrintifyOrderResponse> {
  return printifyFetch(`/shops/${shopId}/orders/express.json`, {
    body: JSON.stringify({
      ...body,
      is_printify_express: true,
      shipping_method: 3, // 3 = Printify Express
    }),
    method: "POST",
  });
}

/** POST /v1/shops/{shop_id}/orders.json - Create an order */
export function createPrintifyOrder(
  shopId: string,
  body: PrintifyCreateOrderRequest,
): Promise<PrintifyOrderResponse> {
  return printifyFetch(`/shops/${shopId}/orders.json`, {
    body: JSON.stringify(body),
    method: "POST",
  });
}

export function createPrintifyProduct(
  shopId: string,
  body: PrintifyCreateProductBody,
): Promise<PrintifyProduct> {
  return printifyFetch(`/shops/${shopId}/products.json`, {
    body,
    method: "POST",
  } as unknown as Parameters<typeof printifyFetch>[1]);
}

/** POST /v1/shops/{shop_id}/webhooks.json - Create a webhook */
export function createPrintifyWebhook(
  shopId: string,
  topic: PrintifyWebhookEventType,
  url: string,
): Promise<PrintifyWebhookSubscription> {
  return printifyFetch(`/shops/${shopId}/webhooks.json`, {
    body: JSON.stringify({ topic, url }),
    method: "POST",
  });
}

/** DELETE /v1/shops/{shop_id}/products/{product_id}.json - Delete a product */
export async function deletePrintifyProduct(
  shopId: string,
  productId: string,
): Promise<{ error?: string; success: boolean }> {
  try {
    await printifyFetch(`/shops/${shopId}/products/${productId}.json`, {
      method: "DELETE",
    });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { error: message, success: false };
  }
}

/**
 * DELETE /v1/shops/{shop_id}/webhooks/{webhook_id}.json - Delete a webhook
 *
 * Requires `host` query parameter as a safeguard: deletion only proceeds if
 * the host matches the webhook's registered host (e.g. "forthecult.store").
 * Pass "*" or the webhook's registered host domain.
 */
export async function deletePrintifyWebhook(
  shopId: string,
  webhookId: string,
  host?: string,
): Promise<{ success: boolean }> {
  try {
    // Printify requires the host query parameter on DELETE
    const hostParam = host || extractWebhookHost();
    const qs = hostParam ? `?host=${encodeURIComponent(hostParam)}` : "";
    await printifyFetch(`/shops/${shopId}/webhooks/${webhookId}.json${qs}`, {
      method: "DELETE",
    });
    return { success: true };
  } catch {
    return { success: false };
  }
}

/** GET /v1/catalog/print_providers.json - List all print providers */
export function fetchAllPrintifyPrintProviders(): Promise<
  PrintifyPrintProviderFull[]
> {
  return printifyFetch("/catalog/print_providers.json");
}

/**
 * Fetch all available shipping methods with costs for a blueprint/provider combo.
 * Uses V2 API for granular per-method data; falls back to V1 if V2 fails.
 */
export async function fetchPrintifyAllShippingMethods(
  blueprintId: number,
  printProviderId: number,
  countryCode: string,
): Promise<
  {
    additionalItemCost: number;
    currency: string;
    firstItemCost: number;
    handlingDays: number;
    method: string; // "standard" | "priority" | "express" | "economy"
  }[]
> {
  try {
    const v2Data = await fetchPrintifyV2Shipping(blueprintId, printProviderId);
    const methods: {
      additionalItemCost: number;
      currency: string;
      firstItemCost: number;
      handlingDays: number;
      method: string;
    }[] = [];

    for (const entry of v2Data.data) {
      const attrs = entry.attributes;
      // Find profile that covers this country
      const profile = attrs.profiles.find(
        (p) =>
          p.countries.includes(countryCode) ||
          p.countries.includes("REST_OF_THE_WORLD"),
      );
      if (!profile) continue;

      methods.push({
        additionalItemCost: profile.additional_items.cost,
        currency: profile.first_item.currency,
        firstItemCost: profile.first_item.cost,
        handlingDays: attrs.handling_time?.value ?? 0,
        method: attrs.method,
      });
    }

    return methods;
  } catch (err) {
    // V2 not available for this blueprint/provider; fall back to V1 (standard only)
    console.warn(
      `Printify V2 shipping unavailable for blueprint ${blueprintId}, falling back to V1:`,
      err instanceof Error ? err.message : err,
    );
    try {
      const v1Data = await fetchPrintifyShippingInfo(
        blueprintId,
        printProviderId,
      );
      const profile = v1Data.profiles.find(
        (p) =>
          p.countries.includes(countryCode) ||
          p.countries.includes("REST_OF_THE_WORLD"),
      );
      if (!profile) return [];
      return [
        {
          additionalItemCost: profile.additional_items.cost,
          currency: profile.first_item.currency,
          firstItemCost: profile.first_item.cost,
          handlingDays: v1Data.handling_time?.value ?? 0,
          method: "standard",
        },
      ];
    } catch {
      return [];
    }
  }
}

/** GET /v1/catalog/blueprints/{blueprint_id}.json */
export function fetchPrintifyBlueprint(
  blueprintId: number,
): Promise<PrintifyBlueprint> {
  return printifyFetch(`/catalog/blueprints/${blueprintId}.json`);
}

/** GET /v1/catalog/blueprints.json */
export function fetchPrintifyBlueprints(): Promise<PrintifyBlueprint[]> {
  return printifyFetch("/catalog/blueprints.json");
}

// --- Printify Express Orders ---

/**
 * GET /v1/shops/{shop_id}/products/{product_id}/gpsr.json
 *
 * Fetch EU General Product Safety Regulation compliance data for a product.
 * Required for selling in the EU. Includes manufacturer and responsible person info.
 */
export async function fetchPrintifyGpsr(
  shopId: string,
  productId: string,
): Promise<null | PrintifyGpsrData> {
  try {
    return await printifyFetch<PrintifyGpsrData>(
      `/shops/${shopId}/products/${productId}/gpsr.json`,
    );
  } catch (error) {
    // GPSR may not be available for all products; don't fail
    const message = error instanceof Error ? error.message : "";
    if (message.includes("404")) {
      return null;
    }
    console.warn(`Printify GPSR fetch failed for ${productId}:`, message);
    return null;
  }
}

// --- GPSR Compliance ---

/** GET /v1/catalog/print_providers/{print_provider_id}.json - Get a specific print provider with blueprint offerings */
export function fetchPrintifyPrintProviderById(
  printProviderId: number,
): Promise<PrintifyPrintProviderFull> {
  return printifyFetch(`/catalog/print_providers/${printProviderId}.json`);
}

/** GET /v1/catalog/blueprints/{blueprint_id}/print_providers.json */
export function fetchPrintifyPrintProviders(
  blueprintId: number,
): Promise<PrintifyPrintProvider[]> {
  return printifyFetch(
    `/catalog/blueprints/${blueprintId}/print_providers.json`,
  );
}

// --- V2 Catalog Shipping (Granular Methods) ---

/** GET /v1/shops/{shop_id}/products/{product_id}.json */
export function fetchPrintifyProduct(
  shopId: string,
  productId: string,
): Promise<PrintifyProduct> {
  return printifyFetch(`/shops/${shopId}/products/${productId}.json`);
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

/**
 * GET /v1/catalog/blueprints/{bp_id}/print_providers/shipping/{method}.json
 *
 * Retrieve shipping info for a specific method (standard, priority, express, economy)
 * across ALL print providers for a blueprint. Useful for finding which providers
 * support a given shipping method.
 */
export function fetchPrintifyShippingByMethod(
  blueprintId: number,
  method: "economy" | "express" | "priority" | "standard",
): Promise<PrintifyV2ShippingResponse> {
  return printifyFetch(
    `/catalog/blueprints/${blueprintId}/print_providers/shipping/${method}.json`,
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

// --- Image Uploads ---

/** GET /v1/shops.json - Retrieve a list of existing shops in a Printify account */
export function fetchPrintifyShops(): Promise<PrintifyShop[]> {
  return printifyFetch("/shops.json");
}

// --- V2 Per-Method Shipping (across all print providers) ---

/**
 * GET /v2/catalog/blueprints/{bp_id}/print_providers/{pp_id}/shipping.json
 *
 * Fetch V2 shipping data with per-method breakdowns (standard, priority, express, economy).
 * Returns JSON:API format with each shipping method as a separate entry.
 */
export function fetchPrintifyV2Shipping(
  blueprintId: number,
  printProviderId: number,
): Promise<PrintifyV2ShippingResponse> {
  const token = getPrintifyToken();
  const url = `${PRINTIFY_V2_BASE_URL}/catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/shipping.json`;
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "CultureStore/1.0",
    },
  }).then(async (res) => {
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Printify V2 Shipping API Error: ${res.status} - ${body}`,
      );
    }
    return res.json() as Promise<PrintifyV2ShippingResponse>;
  });
}

// --- Catalog: Print Providers (standalone) ---

/** GET /v1/catalog/blueprints/{blueprint_id}/print_providers/{print_provider_id}/variants.json */
export function fetchPrintifyVariants(
  blueprintId: number,
  printProviderId: number,
  options?: { showOutOfStock?: boolean },
): Promise<{ id: number; title: string; variants: PrintifyVariant[] }> {
  const qs = options?.showOutOfStock ? "?show-out-of-stock=1" : "";
  return printifyFetch(
    `/catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/variants.json${qs}`,
  );
}

export function getPrintifyIfConfigured(): null | {
  shopId: string;
  token: string;
} {
  try {
    const token = getPrintifyToken();
    const shopId = getPrintifyShopId();
    return { shopId, token };
  } catch {
    return null;
  }
}

/** GET /v1/shops/{shop_id}/orders/{order_id}.json - Get order details */
export function getPrintifyOrder(
  shopId: string,
  orderId: string,
): Promise<PrintifyOrderResponse> {
  return printifyFetch(`/shops/${shopId}/orders/${orderId}.json`);
}

// --- Image Uploads ---

export function getPrintifyShopId(): string {
  const shopId = process.env.PRINTIFY_SHOP_ID?.trim();
  if (!shopId) {
    throw new Error("PRINTIFY_SHOP_ID is not set in environment variables");
  }
  return shopId;
}

export function getPrintifyToken(): string {
  const token = process.env.PRINTIFY_API_TOKEN?.trim();
  if (!token) {
    throw new Error("PRINTIFY_API_TOKEN is not set in environment variables");
  }
  return token;
}

/** GET /v1/uploads/{image_id}.json - Get an uploaded image by ID */
export function getPrintifyUpload(
  imageId: string,
): Promise<PrintifyUploadResult> {
  return printifyFetch(`/uploads/${imageId}.json`);
}

/** GET /v1/shops/{shop_id}/orders.json - Retrieve a list of orders */
export function listPrintifyOrders(
  shopId: string,
  params?: { limit?: number; page?: number; sku?: string; status?: string },
): Promise<{
  current_page: number;
  data: PrintifyOrder[];
  last_page: number;
  total: number;
}> {
  const sp = new URLSearchParams();
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.page) sp.set("page", String(params.page));
  if (params?.status) sp.set("status", params.status);
  if (params?.sku) sp.set("sku", params.sku);
  const qs = sp.toString();
  return printifyFetch(`/shops/${shopId}/orders.json${qs ? `?${qs}` : ""}`);
}

// --- Shipping Calculation (Legacy V1 catalog-based) ---

/** GET /v1/uploads.json - List uploaded images */
export function listPrintifyUploads(params?: {
  limit?: number;
  page?: number;
}): Promise<{
  current_page: number;
  data: PrintifyUploadResult[];
  last_page: number;
}> {
  const sp = new URLSearchParams();
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.page) sp.set("page", String(params.page));
  const qs = sp.toString();
  return printifyFetch(`/uploads.json${qs ? `?${qs}` : ""}`);
}

/** GET /v1/shops/{shop_id}/webhooks.json - List webhooks */
export function listPrintifyWebhooks(
  shopId: string,
): Promise<PrintifyWebhookSubscription[]> {
  return printifyFetch(`/shops/${shopId}/webhooks.json`);
}

/** POST /v1/shops/{shop_id}/products/{product_id}/publish.json - Publish product */
export async function publishPrintifyProduct(
  shopId: string,
  productId: string,
  options: {
    description?: boolean;
    images?: boolean;
    tags?: boolean;
    title?: boolean;
    variants?: boolean;
  } = {},
): Promise<{ error?: string; success: boolean }> {
  try {
    await printifyFetch(`/shops/${shopId}/products/${productId}/publish.json`, {
      body: JSON.stringify({
        description: options.description ?? true,
        images: options.images ?? true,
        tags: options.tags ?? true,
        title: options.title ?? true,
        variants: options.variants ?? true,
      }),
      method: "POST",
    });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { error: message, success: false };
  }
}

// --- Webhooks ---

/**
 * POST /v1/shops/{shop_id}/products/{product_id}/publishing_failed.json
 *
 * Tell Printify that publishing the product on our store failed.
 * Printify will clear the "Publishing" status and mark it as failed.
 */
export async function reportPrintifyPublishingFailed(
  shopId: string,
  productId: string,
  reason: string,
): Promise<{ error?: string; success: boolean }> {
  try {
    await printifyFetch(
      `/shops/${shopId}/products/${productId}/publishing_failed.json`,
      {
        body: JSON.stringify({ reason }),
        method: "POST",
      },
    );
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(
      `Printify publishing_failed failed for ${productId}:`,
      message,
    );
    return { error: message, success: false };
  }
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

/**
 * POST /v1/shops/{shop_id}/products/{product_id}/unpublish.json
 *
 * Notify Printify that the product has been removed from our store.
 */
export async function unpublishPrintifyProduct(
  shopId: string,
  productId: string,
): Promise<{ error?: string; success: boolean }> {
  try {
    await printifyFetch(
      `/shops/${shopId}/products/${productId}/unpublish.json`,
      {
        method: "POST",
      },
    );
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { error: message, success: false };
  }
}

/** PUT /v1/shops/{shop_id}/products/{product_id}.json - Update a product */
export function updatePrintifyProduct(
  shopId: string,
  productId: string,
  body: {
    description?: string;
    images?: {
      is_default: boolean;
      is_selected_for_publishing?: boolean;
      position: string;
      src: string;
      variant_ids: number[];
    }[];
    print_areas?: {
      placeholders: {
        images: {
          angle: number;
          id: string;
          scale: number;
          x: number;
          y: number;
        }[];
        position: string;
      }[];
      variant_ids: number[];
    }[];
    tags?: string[];
    title?: string;
    variants?: {
      id: number;
      is_enabled?: boolean;
      price: number;
    }[];
  },
): Promise<PrintifyProduct> {
  return printifyFetch(`/shops/${shopId}/products/${productId}.json`, {
    body: JSON.stringify(body),
    method: "PUT",
  });
}

/** PUT /v1/shops/{shop_id}/webhooks/{webhook_id}.json - Modify a webhook */
export function updatePrintifyWebhook(
  shopId: string,
  webhookId: string,
  body: { topic?: PrintifyWebhookEventType; url?: string },
): Promise<PrintifyWebhookSubscription> {
  return printifyFetch(`/shops/${shopId}/webhooks/${webhookId}.json`, {
    body: JSON.stringify(body),
    method: "PUT",
  });
}

/** POST /v1/uploads/images.json - Upload image via URL */
export function uploadPrintifyImageByUrl(
  imageUrl: string,
  fileName: string,
): Promise<PrintifyUploadResult> {
  return printifyFetch("/uploads/images.json", {
    body: JSON.stringify({ file_name: fileName, url: imageUrl }),
    method: "POST",
  });
}

/**
 * Extract the host (domain) from NEXT_PUBLIC_APP_URL for Printify webhook operations.
 * e.g. "https://forthecult.store" → "forthecult.store"
 */
function extractWebhookHost(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) return "";
  try {
    return new URL(appUrl).host;
  } catch {
    // Fallback: strip protocol
    return appUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
}

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
    body: bodyInit,
    headers,
  });

  if (!res.ok) {
    const errorBody = await res.text();
    const isDisabledForEditing =
      res.status === 400 &&
      (errorBody.includes("8252") || /disabled for editing/i.test(errorBody));
    if (isDisabledForEditing) {
      console.info(
        "Printify API: product is in Publishing (disabled for editing, code 8252).",
      );
    } else {
      console.error(
        `Printify API Error (${res.status} ${res.statusText}): ${errorBody}`,
      );
    }
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
