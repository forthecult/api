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

type PrintifyFetchOptions = Omit<RequestInit, "body"> & {
  shopId?: string;
  body?: unknown;
};

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
  /** Available decoration methods for this variant (e.g. ["dtg", "embroidery"]). */
  decoration_methods?: string[];
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
  options?: { showOutOfStock?: boolean },
): Promise<{ id: number; title: string; variants: PrintifyVariant[] }> {
  const qs = options?.showOutOfStock ? "?show-out-of-stock=1" : "";
  return printifyFetch(
    `/catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/variants.json${qs}`,
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
    is_printify_express_eligible?: boolean;
    options: number[];
  }>;
  images: Array<{
    src: string;
    variant_ids: number[];
    position: string;
    is_default: boolean;
    is_selected_for_publishing?: boolean;
    order?: number;
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
  // Shipping eligibility flags
  is_printify_express_eligible?: boolean;
  is_printify_express_enabled?: boolean;
  is_economy_shipping_eligible?: boolean;
  is_economy_shipping_enabled?: boolean;
  // Sales channel properties (external store sync data)
  sales_channel_properties?: Array<Record<string, unknown>>;
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
    print_areas?: Array<{
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
    images?: Array<{
      src: string;
      variant_ids: number[];
      position: string;
      is_default: boolean;
      is_selected_for_publishing?: boolean;
    }>;
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
  external: { id: string; handle: string },
): Promise<{ success: boolean; error?: string }> {
  try {
    await printifyFetch(
      `/shops/${shopId}/products/${productId}/publishing_succeeded.json`,
      {
        method: "POST",
        body: JSON.stringify({ external }),
      },
    );
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(
      `Printify publishing_succeeded failed for ${productId}:`,
      message,
    );
    return { success: false, error: message };
  }
}

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
): Promise<{ success: boolean; error?: string }> {
  try {
    await printifyFetch(
      `/shops/${shopId}/products/${productId}/publishing_failed.json`,
      {
        method: "POST",
        body: JSON.stringify({ reason }),
      },
    );
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(
      `Printify publishing_failed failed for ${productId}:`,
      message,
    );
    return { success: false, error: message };
  }
}

/**
 * POST /v1/shops/{shop_id}/products/{product_id}/unpublish.json
 *
 * Notify Printify that the product has been removed from our store.
 */
export async function unpublishPrintifyProduct(
  shopId: string,
  productId: string,
): Promise<{ success: boolean; error?: string }> {
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
    return { success: false, error: message };
  }
}

// --- Orders: Shipping Calculation ---

/**
 * POST /v1/shops/{shop_id}/orders/shipping.json
 *
 * Calculate shipping cost for an order directly from Printify.
 * More accurate than catalog-based calculation as it uses actual order data.
 */
export type PrintifyOrderShippingRequest = {
  line_items: PrintifyOrderLineItem[];
  address_to: {
    country: string;
    region?: string;
    zip?: string;
    city?: string;
  };
};

export type PrintifyOrderShippingResult = {
  standard: number;
  express: number;
  priority: number;
  printify_express?: number;
  economy?: number;
};

export function calculatePrintifyOrderShipping(
  shopId: string,
  body: PrintifyOrderShippingRequest,
): Promise<PrintifyOrderShippingResult> {
  return printifyFetch(`/shops/${shopId}/orders/shipping.json`, {
    method: "POST",
    body: JSON.stringify(body),
  });
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

/** GET /v1/shops/{shop_id}/orders.json - Retrieve a list of orders */
export function listPrintifyOrders(
  shopId: string,
  params?: { limit?: number; page?: number; status?: string; sku?: string },
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

// --- Printify Express Orders ---

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
    method: "POST",
    body: JSON.stringify({
      ...body,
      is_printify_express: true,
      shipping_method: 3, // 3 = Printify Express
    }),
  });
}

// --- GPSR Compliance ---

export type PrintifyGpsrData = {
  manufacturer?: {
    name?: string;
    address?: string;
    email?: string;
    phone?: string;
  };
  responsible_person?: {
    name?: string;
    address?: string;
    email?: string;
    phone?: string;
  };
  [key: string]: unknown;
};

/**
 * GET /v1/shops/{shop_id}/products/{product_id}/gpsr.json
 *
 * Fetch EU General Product Safety Regulation compliance data for a product.
 * Required for selling in the EU. Includes manufacturer and responsible person info.
 */
export async function fetchPrintifyGpsr(
  shopId: string,
  productId: string,
): Promise<PrintifyGpsrData | null> {
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

// --- V2 Catalog Shipping (Granular Methods) ---

/**
 * V2 shipping data uses JSON:API format with granular shipping methods.
 */
export type PrintifyV2ShippingMethod = {
  id: string;
  type: string;
  attributes: {
    method: string; // "standard" | "priority" | "express" | "economy"
    handling_time: { value: number; unit: string };
    profiles: Array<{
      variant_ids: number[];
      first_item: { currency: string; cost: number };
      additional_items: { currency: string; cost: number };
      countries: string[];
    }>;
  };
};

export type PrintifyV2ShippingResponse = {
  data: PrintifyV2ShippingMethod[];
};

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

/**
 * Fetch all available shipping methods with costs for a blueprint/provider combo.
 * Uses V2 API for granular per-method data; falls back to V1 if V2 fails.
 */
export async function fetchPrintifyAllShippingMethods(
  blueprintId: number,
  printProviderId: number,
  countryCode: string,
): Promise<
  Array<{
    method: string; // "standard" | "priority" | "express" | "economy"
    firstItemCost: number;
    additionalItemCost: number;
    handlingDays: number;
    currency: string;
  }>
> {
  try {
    const v2Data = await fetchPrintifyV2Shipping(blueprintId, printProviderId);
    const methods: Array<{
      method: string;
      firstItemCost: number;
      additionalItemCost: number;
      handlingDays: number;
      currency: string;
    }> = [];

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
        method: attrs.method,
        firstItemCost: profile.first_item.cost,
        additionalItemCost: profile.additional_items.cost,
        handlingDays: attrs.handling_time?.value ?? 0,
        currency: profile.first_item.currency,
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
          method: "standard",
          firstItemCost: profile.first_item.cost,
          additionalItemCost: profile.additional_items.cost,
          handlingDays: v1Data.handling_time?.value ?? 0,
          currency: profile.first_item.currency,
        },
      ];
    } catch {
      return [];
    }
  }
}

// --- Image Uploads ---

export type PrintifyUploadResult = {
  id: string;
  file_name: string;
  height: number;
  width: number;
  size: number;
  mime_type: string;
  preview_url?: string;
};

// --- V2 Per-Method Shipping (across all print providers) ---

/**
 * GET /v1/catalog/blueprints/{bp_id}/print_providers/shipping/{method}.json
 *
 * Retrieve shipping info for a specific method (standard, priority, express, economy)
 * across ALL print providers for a blueprint. Useful for finding which providers
 * support a given shipping method.
 */
export function fetchPrintifyShippingByMethod(
  blueprintId: number,
  method: "standard" | "priority" | "express" | "economy",
): Promise<PrintifyV2ShippingResponse> {
  return printifyFetch(
    `/catalog/blueprints/${blueprintId}/print_providers/shipping/${method}.json`,
  );
}

// --- Catalog: Print Providers (standalone) ---

export type PrintifyPrintProviderFull = {
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
  blueprints?: Array<{
    id: number;
    title: string;
    brand: string;
    model: string;
    images: string[];
  }>;
};

/** GET /v1/catalog/print_providers.json - List all print providers */
export function fetchAllPrintifyPrintProviders(): Promise<
  PrintifyPrintProviderFull[]
> {
  return printifyFetch("/catalog/print_providers.json");
}

/** GET /v1/catalog/print_providers/{print_provider_id}.json - Get a specific print provider with blueprint offerings */
export function fetchPrintifyPrintProviderById(
  printProviderId: number,
): Promise<PrintifyPrintProviderFull> {
  return printifyFetch(`/catalog/print_providers/${printProviderId}.json`);
}

// --- Image Uploads ---

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

/** POST /v1/uploads/images.json - Upload image via URL */
export function uploadPrintifyImageByUrl(
  imageUrl: string,
  fileName: string,
): Promise<PrintifyUploadResult> {
  return printifyFetch("/uploads/images.json", {
    method: "POST",
    body: JSON.stringify({ file_name: fileName, url: imageUrl }),
  });
}

/** GET /v1/uploads/{image_id}.json - Get an uploaded image by ID */
export function getPrintifyUpload(
  imageId: string,
): Promise<PrintifyUploadResult> {
  return printifyFetch(`/uploads/${imageId}.json`);
}

/** POST /v1/uploads/{image_id}/archive.json - Archive an uploaded image */
export async function archivePrintifyUpload(
  imageId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await printifyFetch(`/uploads/${imageId}/archive.json`, {
      method: "POST",
    });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

// --- Shipping Calculation (Legacy V1 catalog-based) ---

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

/**
 * Valid Printify webhook subscription topics (per OpenAPI spec).
 * Note: "product:published" does NOT exist as a subscribable topic.
 * Only "product:publish:started" is valid. Printify may send different
 * event type strings in the webhook payload, but subscriptions must
 * use these exact topics.
 */
export type PrintifyWebhookEventType =
  | "shop:disconnected"
  | "product:deleted"
  | "product:publish:started"
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

/** PUT /v1/shops/{shop_id}/webhooks/{webhook_id}.json - Modify a webhook */
export function updatePrintifyWebhook(
  shopId: string,
  webhookId: string,
  body: { url?: string; topic?: PrintifyWebhookEventType },
): Promise<PrintifyWebhookSubscription> {
  return printifyFetch(`/shops/${shopId}/webhooks/${webhookId}.json`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
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
