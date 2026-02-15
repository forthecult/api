/**
 * Printful API v2 client. Base URL: https://api.printful.com, auth: Bearer token.
 * Used for catalog sync, shipping rates, and order creation/confirmation.
 */

const PRINTFUL_BASE = "https://api.printful.com";
const PRINTFUL_V2 = `${PRINTFUL_BASE}/v2`;

export interface PrintfulCatalogProduct {
  _links?: { variants?: { href: string } };
  brand: null | string;
  description: null | string;
  id: number;
  image: null | string;
  is_discontinued: boolean;
  main_category_id: number;
  model: null | string;
  name: string;
  type: string;
  variant_count: number;
}

export interface PrintfulCatalogProductsResponse {
  _links?: Record<string, { href: string }>;
  data: PrintfulCatalogProduct[];
  paging: { limit: number; offset: number; total: number };
}

export interface PrintfulCatalogStockEntry {
  region?: string;
  status?: string;
  variant_id?: number;
}

// --- Catalog (products sync) ---

export interface PrintfulCatalogStockResponse {
  data: PrintfulCatalogStockEntry[];
}

export interface PrintfulCatalogVariant {
  catalog_product_id: number;
  color: null | string;
  color_code: null | string;
  color_code2: null | string;
  id: number;
  image: null | string;
  name: string;
  size: null | string;
}

export interface PrintfulCatalogVariantsResponse {
  _links?: Record<string, { href: string }>;
  data: PrintfulCatalogVariant[];
  paging: { limit: number; offset: number; total: number };
}

export interface PrintfulCountriesResponse {
  data: PrintfulCountry[];
}

export interface PrintfulCountry {
  code: string;
  name: string;
  states?: { code: string; name: string }[];
}

export interface PrintfulCreateOrderRequest {
  customization?: {
    gift?: { message?: string; subject?: string };
    packing_slip?: Record<string, unknown>;
  };
  external_id?: string;
  order_items: PrintfulOrderItem[];
  recipient: PrintfulRecipient;
  retail_costs?: {
    currency?: string;
    discount?: string;
    shipping?: string;
    tax?: string;
  };
  shipping?: string;
}

export interface PrintfulMockupResult {
  catalog_variant_ids: number[];
  extra_mockup_urls?: Record<string, string>;
  mockup_url: string;
  placement: string;
  technique_key: string;
}

export interface PrintfulMockupStyle {
  category?: string;
  display_name: string;
  image_url?: string;
  placement: string;
  style_id: number;
}

// --- Size guide ---

export interface PrintfulMockupStylesResponse {
  data: PrintfulMockupStyle[];
}

export interface PrintfulMockupTaskRequest {
  files: {
    image_url: string;
    placement: string;
    position?: {
      area_height: number;
      area_width: number;
      height: number;
      left: number;
      top: number;
      width: number;
    };
  }[];
  format?: "jpg" | "png";
  option_groups?: string[];
  product_id: number;
  product_options?: Record<string, string>;
  variant_ids?: number[];
}

export interface PrintfulMockupTaskResponse {
  data: {
    error?: null | string;
    id: string;
    result?: {
      mockups: PrintfulMockupResult[];
    };
    status: "completed" | "failed" | "pending";
  };
}

export interface PrintfulOrderCosts {
  additional_fee: null | string;
  calculation_status: string;
  currency: null | string;
  digitization: null | string;
  discount: null | string;
  fulfillment_fee: null | string;
  retail_delivery_fee: null | string;
  shipping: null | string;
  subtotal: null | string;
  tax: null | string;
  total: null | string;
  vat: null | string;
}

export interface PrintfulOrderEstimationRequest {
  order_items: PrintfulOrderItem[];
  recipient: PrintfulRecipient;
  shipping?: string;
}

// --- Shipping rates ---

export interface PrintfulOrderEstimationTask {
  costs?: PrintfulOrderCosts;
  failure_reasons?: string[];
  id: string;
  retail_costs?: null | { calculation_status: string; total: null | string };
  status: "completed" | "failed" | "pending";
}

export interface PrintfulOrderItem {
  catalog_variant_id: number;
  external_id?: string;
  name?: string;
  quantity: number;
  retail_price?: string;
  source: "catalog";
}

export interface PrintfulOrderResponse {
  data: {
    _links?: {
      order_confirmation?: { href: string };
      shipments?: { href: string };
    };
    costs?: PrintfulOrderCosts;
    created_at: string;
    external_id: null | string;
    id: number;
    order_items?: {
      catalog_variant_id: number;
      id: number;
      name: null | string;
      price: null | string;
      quantity: number;
      retail_price: null | string;
    }[];
    recipient: PrintfulRecipient;
    retail_costs?: { calculation_status: string; total: null | string };
    shipments?: PrintfulShipment[];
    status: string;
    store_id: number;
    updated_at: string;
  };
}

export interface PrintfulPatchOrderRequest {
  external_id?: string;
  recipient?: Partial<PrintfulRecipient>;
  retail_costs?: {
    currency?: string;
    discount?: string;
    shipping?: string;
    tax?: string;
  };
  shipping?: string;
}

export interface PrintfulRecipient {
  address1: string;
  address2?: string;
  city?: string;
  company?: string;
  country_code: string;
  country_name?: string;
  email?: string;
  name?: string;
  phone?: string;
  state_code?: string;
  state_name?: string;
  zip?: string;
}

export interface PrintfulShipment {
  carrier?: null | string;
  delivered_at: null | string;
  delivery_status: null | string;
  departure_address?: {
    country_code?: string;
    country_name?: string;
    state_code?: string;
  };
  estimated_delivery?: {
    calculated_at?: null | string;
    from_date?: null | string;
    to_date?: null | string;
  };
  id: number;
  order_id: number;
  shipment_items?: {
    id: number;
    order_item_external_id?: null | string;
    order_item_id: number;
    order_item_name?: string;
    quantity: number;
  }[];
  shipment_status: string;
  shipped_at: null | string;
  tracking_events?: PrintfulTrackingEvent[];
  tracking_number?: null | string;
  tracking_url?: null | string;
}

// --- Orders ---

export interface PrintfulShipmentsResponse {
  data: PrintfulShipment[];
}

export interface PrintfulShippingOrderItem {
  catalog_variant_id: number;
  quantity: number;
  source: "catalog";
}

export interface PrintfulShippingRateOption {
  currency: string;
  max_delivery_date?: string;
  max_delivery_days?: number;
  min_delivery_date?: string;
  min_delivery_days?: number;
  rate: string;
  shipments?: {
    customs_fees_possible?: boolean;
    departure_country?: string;
  }[];
  shipping: string;
  shipping_method_name: string;
}

export interface PrintfulShippingRatesRequest {
  currency?: string;
  order_items: PrintfulShippingOrderItem[];
  recipient: PrintfulRecipient;
}

export interface PrintfulShippingRatesResponse {
  data: PrintfulShippingRateOption[];
  extra?: unknown[];
}

export interface PrintfulSizeGuideResponse {
  data: {
    available_sizes: string[];
    catalog_product_id: number;
    size_tables: {
      description?: string;
      image_url?: string;
      measurements?: { type_label: string; values: unknown[] }[];
      type: string;
      unit: string;
    }[];
  };
}

export interface PrintfulStoreV2 {
  id: number;
  name: string;
  type: string;
}

export interface PrintfulTrackingEvent {
  description: string;
  triggered_at: string;
}

// --- Shipments ---

export interface PrintfulVariantPriceResponse {
  data: {
    currency: string;
    variant: {
      id: number;
      techniques: {
        discounted_price: string;
        price: string;
        technique_key: string;
      }[];
    };
  };
}

export interface PrintfulWebhookV2Config {
  enabled: boolean;
  events: string[];
  signing_secret?: string;
  url: string;
}

export interface PrintfulWebhookV2Response {
  data: PrintfulWebhookV2Config;
}

/** POST /v2/orders/{order_id}/confirm – submit for fulfillment. */
export function confirmPrintfulOrder(
  printfulOrderId: number,
  storeId?: number,
): Promise<PrintfulOrderResponse> {
  return pfFetch(`/orders/${printfulOrderId}/confirm`, {
    method: "POST",
    storeId,
  });
}

// --- Order Updates (PATCH) ---

/** POST /v2/mockup-tasks – create mockup generation task(s). */
export function createMockupTask(
  body: PrintfulMockupTaskRequest,
  storeId?: number,
): Promise<PrintfulMockupTaskResponse> {
  return pfFetch("/mockup-tasks", { body, method: "POST", storeId });
}

/** POST /v2/order-estimation-tasks – create an async cost estimation task. */
export function createOrderEstimationTask(
  body: PrintfulOrderEstimationRequest,
  storeId?: number,
): Promise<{ data: PrintfulOrderEstimationTask }> {
  return pfFetch("/order-estimation-tasks", { body, method: "POST", storeId });
}

// --- Order Estimation Tasks ---

/** POST /v2/orders – creates draft. */
export function createPrintfulOrder(
  body: PrintfulCreateOrderRequest,
  storeId?: number,
): Promise<PrintfulOrderResponse> {
  return pfFetch("/orders", { body, method: "POST", storeId });
}

/** DELETE /v2/orders/{order_id} – delete/cancel a draft or failed order. */
export async function deletePrintfulOrder(
  printfulOrderId: number,
  storeId?: number,
): Promise<{ error?: string; success: boolean }> {
  const token = getToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (storeId != null) headers["X-PF-Store-Id"] = String(storeId);

  const res = await fetch(`${PRINTFUL_V2}/orders/${printfulOrderId}`, {
    headers,
    method: "DELETE",
  });

  if (res.status === 204) {
    return { success: true };
  }

  if (res.status === 409) {
    return {
      error: "Order cannot be cancelled - already in process",
      success: false,
    };
  }

  if (!res.ok) {
    const text = await res.text();
    return { error: `Printful API ${res.status}: ${text}`, success: false };
  }

  return { success: true };
}

/** DELETE /v2/webhooks/events/{type} – disable support for a specific event. */
export async function disableWebhookEvent(
  eventType: string,
  storeId?: number,
): Promise<{ success: boolean }> {
  await pfFetch(`/webhooks/events/${encodeURIComponent(eventType)}`, {
    method: "DELETE",
    storeId,
  });
  return { success: true };
}

/** DELETE /v2/webhooks – disable webhook support. */
export async function disableWebhookV2(
  storeId?: number,
): Promise<{ success: boolean }> {
  await pfFetch("/webhooks", { method: "DELETE", storeId });
  return { success: true };
}

// --- Catalog Stock ---

/** GET /v2/catalog-products/{id} – single product. */
export function fetchCatalogProduct(catalogProductId: number) {
  return pfFetch<{ data: PrintfulCatalogProduct }>(
    `/catalog-products/${catalogProductId}`,
  );
}

/** GET /v2/catalog-products/{id}/mockup-styles – mockup styles for a product. */
export function fetchCatalogProductMockupStyles(
  catalogProductId: number,
): Promise<PrintfulMockupStylesResponse> {
  return pfFetch(`/catalog-products/${catalogProductId}/mockup-styles`);
}

/** GET /v2/catalog-products (paginated). */
export function fetchCatalogProducts(
  params: { limit?: number; offset?: number } = {},
) {
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;
  return pfFetch<PrintfulCatalogProductsResponse>(
    `/catalog-products?limit=${limit}&offset=${offset}`,
  );
}

/**
 * GET /v2/catalog-products/{id}/shipping-countries – countries this product can ship to.
 * Returns ISO 3166-1 alpha-2 codes. On 404 or error, returns null (caller can fall back to static list).
 */
export async function fetchCatalogProductShippingCountries(
  catalogProductId: number,
): Promise<null | string[]> {
  try {
    const res = await pfFetch<{
      data?: { country_code?: string }[] | { country_codes?: string[] };
    }>(`/catalog-products/${catalogProductId}/shipping-countries`);
    if (!res?.data) return null;
    const arr = Array.isArray(res.data)
      ? res.data
      : (res.data as { country_codes?: string[] }).country_codes;
    if (!Array.isArray(arr)) return null;
    const codes = arr
      .map((x) =>
        typeof x === "string"
          ? x
          : (x as { country_code?: string }).country_code,
      )
      .filter((c): c is string => typeof c === "string" && c.length === 2);
    return codes.length > 0 ? codes.map((c) => c.toUpperCase()) : null;
  } catch {
    return null;
  }
}

// --- Mockup Generator v2 ---

/** GET /v2/catalog-products/{id}/stock – product stock availability by region. */
export function fetchCatalogProductStock(
  catalogProductId: number,
): Promise<PrintfulCatalogStockResponse> {
  return pfFetch(`/catalog-products/${catalogProductId}/stock`);
}

/** GET /v2/catalog-products/{id}/catalog-variants. */
export function fetchCatalogVariants(catalogProductId: number) {
  return pfFetch<PrintfulCatalogVariantsResponse>(
    `/catalog-products/${catalogProductId}/catalog-variants`,
  );
}

/** GET /v2/catalog-variants/{id}/stock – variant stock availability by region. */
export function fetchCatalogVariantStock(
  catalogVariantId: number,
): Promise<PrintfulCatalogStockResponse> {
  return pfFetch(`/catalog-variants/${catalogVariantId}/stock`);
}

/** GET /v2/countries – list all countries Printful ships to. */
export function fetchCountries(): Promise<PrintfulCountriesResponse> {
  return pfFetch("/countries");
}

/** GET /v2/orders/{order_id}/shipments – list shipments for an order. */
export function fetchOrderShipments(
  printfulOrderId: number,
  storeId?: number,
): Promise<PrintfulShipmentsResponse> {
  return pfFetch(`/orders/${printfulOrderId}/shipments`, { storeId });
}

// --- Mockup Styles ---

/** GET /v2/catalog-products/{id}/sizes. Optional: unit (inches, cm). */
export function fetchProductSizeGuide(
  catalogProductId: number,
  params: { unit?: string } = {},
) {
  const qs = params.unit ? `?unit=${encodeURIComponent(params.unit)}` : "";
  return pfFetch<PrintfulSizeGuideResponse>(
    `/catalog-products/${catalogProductId}/sizes${qs}`,
  );
}

/** Same as fetchProductSizeGuide but returns null on 404/5xx instead of throwing. Use for size chart import so one product without a guide doesn't break the flow. */
export async function fetchProductSizeGuideSafe(
  catalogProductId: number,
  params: { unit?: string } = {},
): Promise<null | PrintfulSizeGuideResponse> {
  try {
    return await fetchProductSizeGuide(catalogProductId, params);
  } catch {
    return null;
  }
}

/** POST /v2/shipping-rates. Recipient must include country_code; state_code required for US, CA, AU. */
export function fetchShippingRates(
  body: PrintfulShippingRatesRequest,
  storeId?: number,
): Promise<PrintfulShippingRatesResponse> {
  return pfFetch("/shipping-rates", { body, method: "POST", storeId });
}

// --- Countries ---

/** GET /v2/stores/{id}/statistics – get store statistics. */
export function fetchStoreStatistics(
  storeIdParam: number,
): Promise<{ data: unknown }> {
  return pfFetch(`/stores/${storeIdParam}/statistics`);
}

/** GET /v2/stores – list all stores. */
export function fetchStoresV2(): Promise<{ data: PrintfulStoreV2[] }> {
  return pfFetch("/stores");
}

/** GET /v2/catalog-variants/{id}/prices. Optional: selling_region_name, currency. */
export function fetchVariantPrices(
  catalogVariantId: number,
  params: { currency?: string; selling_region_name?: string } = {},
) {
  const search = new URLSearchParams();
  if (params.selling_region_name)
    search.set("selling_region_name", params.selling_region_name);
  if (params.currency) search.set("currency", params.currency);
  const qs = search.toString() ? `?${search.toString()}` : "";
  return pfFetch<PrintfulVariantPriceResponse>(
    `/catalog-variants/${catalogVariantId}/prices${qs}`,
  );
}

// --- Webhooks v2 ---

/** GET /v2/mockup-tasks/{id} – retrieve mockup task result. */
export function getMockupTask(
  taskId: string,
  storeId?: number,
): Promise<PrintfulMockupTaskResponse> {
  return pfFetch(`/mockup-tasks/${taskId}`, { storeId });
}

/** GET /v2/order-estimation-tasks/{id} – retrieve estimation task result. */
export function getOrderEstimationTask(
  taskId: string,
  storeId?: number,
): Promise<{ data: PrintfulOrderEstimationTask }> {
  return pfFetch(`/order-estimation-tasks/${taskId}`, { storeId });
}

/** use when Printful is optional (e.g. shipping fallback). */
export function getPrintfulIfConfigured(): null | { token: string } {
  const token = process.env.PRINTFUL_API_TOKEN?.trim();
  if (!token) return null;
  return { token };
}

/** GET /v2/orders/{order_id} – retrieve order details. */
export function getPrintfulOrder(
  printfulOrderId: number,
  storeId?: number,
): Promise<PrintfulOrderResponse> {
  return pfFetch(`/orders/${printfulOrderId}`, { storeId });
}

/** GET /v2/orders/{order_id}/invoice – retrieve order invoice. */
export function getPrintfulOrderInvoice(
  printfulOrderId: number,
  storeId?: number,
): Promise<unknown> {
  return pfFetch(`/orders/${printfulOrderId}/invoice`, { storeId });
}

/** GET /v2/webhooks – get webhook configuration. */
export async function getWebhookConfigV2(
  storeId?: number,
): Promise<null | PrintfulWebhookV2Config> {
  try {
    const res = await pfFetch<PrintfulWebhookV2Response>("/webhooks", {
      storeId,
    });
    return res.data;
  } catch {
    return null;
  }
}

/** GET /v2/webhooks/events/{type} – get event-specific configuration. */
export async function getWebhookEventConfig(
  eventType: string,
  storeId?: number,
): Promise<unknown> {
  return pfFetch(`/webhooks/events/${encodeURIComponent(eventType)}`, {
    storeId,
  });
}

/** PATCH /v2/orders/{order_id} – partial update of a draft order. */
export function patchPrintfulOrder(
  printfulOrderId: number,
  body: PrintfulPatchOrderRequest,
  storeId?: number,
): Promise<PrintfulOrderResponse> {
  return pfFetch(`/orders/${printfulOrderId}`, {
    body,
    method: "PATCH",
    storeId,
  });
}

// --- Order Invoice ---

/** POST /v2/webhooks – set up webhook configuration. */
export function setWebhookConfigV2(
  config: { events: string[]; url: string },
  storeId?: number,
): Promise<PrintfulWebhookV2Response> {
  return pfFetch("/webhooks", { body: config, method: "POST", storeId });
}

// --- Stores ---

/** POST /v2/webhooks/events/{type} – set up event-specific configuration. */
export async function setWebhookEventConfig(
  eventType: string,
  config: { params?: Record<string, unknown>; url?: string },
  storeId?: number,
): Promise<unknown> {
  return pfFetch(`/webhooks/events/${encodeURIComponent(eventType)}`, {
    body: config,
    method: "POST",
    storeId,
  });
}

function getToken(): string {
  const token = process.env.PRINTFUL_API_TOKEN?.trim();
  if (!token) throw new Error("PRINTFUL_API_TOKEN is not set");
  return token;
}

async function pfFetch<T>(
  path: string,
  options: { body?: unknown; method?: string; storeId?: number } = {},
): Promise<T> {
  const { body, method = "GET", storeId } = options;
  const token = getToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (storeId != null) headers["X-PF-Store-Id"] = String(storeId);

  const res = await fetch(
    path.startsWith("http") ? path : `${PRINTFUL_V2}${path}`,
    {
      headers,
      method,
      ...(body != null && { body: JSON.stringify(body) }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    let errMessage = `Printful API ${res.status}: ${text}`;
    try {
      const json = JSON.parse(text) as { detail?: string; title?: string };
      errMessage = json.detail ?? json.title ?? errMessage;
    } catch {
      // keep text
    }
    throw new Error(errMessage);
  }

  return res.json() as Promise<T>;
}

// ============================================================================
// Printful V1 API – Sync Products (Products API)
// Used for bidirectional product synchronization
// ============================================================================

const PRINTFUL_V1 = PRINTFUL_BASE;

export interface PrintfulProductTemplateItem {
  available_variant_ids: number[];
  colors?: { color_codes: string[]; color_name: string }[];
  created_at?: number;
  design_id?: null | string;
  external_product_id: null | string;
  id: number;
  mockup_file?: {
    imageURL?: string;
    status?: string;
    thumbnailURL?: string;
  };
  mockup_file_url?: string;
  option_data?: { id: string; value: string | string[] }[];
  placement_option_data?: { options: unknown[]; type: string }[];
  placements?: {
    display_name: string;
    options?: unknown[];
    placement: string;
    technique_display_name?: string;
    technique_key?: string;
  }[];
  product_id: number;
  sizes?: string[];
  title: string;
  updated_at?: number;
}

// --- Store Information API (account-level, no X-PF-Store-Id) ---

export interface PrintfulProductTemplatesResponse {
  items: PrintfulProductTemplateItem[];
  paging?: { limit: number; offset: number; total: number };
}

export interface PrintfulStoreInfo {
  address?: string;
  created_at?: number;
  id: number;
  name: string;
  type: string;
  website?: string;
}

export interface PrintfulSyncProduct {
  external_id: null | string;
  id: number;
  is_ignored: boolean;
  name: string;
  synced: number;
  thumbnail_url: null | string;
  variants: number;
}

// --- Sync Product Types ---

export interface PrintfulSyncProductFile {
  created?: number;
  dpi?: number;
  filename?: string;
  hash?: string;
  height?: number;
  id?: number;
  mime_type?: string;
  options?: { id: string; value: boolean | string }[];
  preview_url?: string;
  size?: number;
  status?: string;
  thumbnail_url?: string;
  type: string;
  url?: string;
  visible?: boolean;
  width?: number;
}

export interface PrintfulSyncProductFull {
  sync_product: PrintfulSyncProduct;
  sync_variants: PrintfulSyncVariant[];
}

export interface PrintfulSyncProductsResponse {
  code: number;
  paging: { limit: number; offset: number; total: number };
  result: PrintfulSyncProduct[];
}

export interface PrintfulSyncVariant {
  availability_status?: string;
  color: null | string;
  currency: string;
  external_id: null | string;
  files: PrintfulSyncProductFile[];
  id: number;
  is_ignored: boolean;
  main_category_id: number;
  name: string;
  options: { id: string; value: string }[];
  product: {
    image: null | string;
    name: string;
    product_id: number;
    variant_id: number;
  };
  retail_price: null | string;
  size: null | string;
  sku: null | string;
  sync_product_id: number;
  synced: boolean;
  variant_id: number; // Printful catalog variant ID
}

/** Response shape for printfiles endpoint (placement → file URL). */
export type PrintfulTemplatePrintfilesResult = Record<
  string,
  {
    [key: string]: unknown;
    type?: string;
    url?: string;
  }[]
>;

// --- Sync Products API (V1) ---

export interface PrintfulWebhookConfig {
  params?: Record<string, unknown>;
  types: string[];
  url: string;
}

/**
 * POST /store/products – Create a new sync product with sync variants.
 */
export async function createSyncProduct(
  body: {
    sync_product: {
      external_id?: string;
      is_ignored?: boolean;
      name: string;
      thumbnail?: string;
    };
    sync_variants: {
      availability_status?:
        | "active"
        | "discontinued"
        | "out_of_stock"
        | "temporary_out_of_stock";
      external_id?: string;
      files: {
        filename?: string;
        options?: { id: string; value: boolean | string }[];
        position?: {
          area_height: number;
          area_width: number;
          height: number;
          left: number;
          top: number;
          width: number;
        };
        type?: string;
        url: string;
        visible?: boolean;
      }[];
      is_ignored?: boolean;
      options?: { id: string; value: string }[];
      retail_price?: string;
      sku?: string;
      variant_id: number;
    }[];
  },
  storeId?: number,
): Promise<PrintfulSyncProduct> {
  return pfFetchV1("/store/products", { body, method: "POST", storeId });
}

/**
 * DELETE /store/products/{id} – Delete a sync product and all its variants.
 */
export async function deleteSyncProduct(
  id: number | string,
  storeId?: number,
): Promise<{ error?: string; success: boolean }> {
  const token = getToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (storeId != null) headers["X-PF-Store-Id"] = String(storeId);

  const res = await fetch(`${PRINTFUL_V1}/store/products/${id}`, {
    headers,
    method: "DELETE",
  });

  if (!res.ok) {
    const text = await res.text();
    return { error: `Printful V1 API ${res.status}: ${text}`, success: false };
  }

  return { success: true };
}

/**
 * DELETE /webhooks – Disable webhook support.
 */
export async function disableWebhook(
  storeId?: number,
): Promise<{ success: boolean }> {
  await pfFetchV1("/webhooks", { method: "DELETE", storeId });
  return { success: true };
}

/**
 * Fetch country of origin (and HS code if present) from Printful V1 catalog product.
 * V1 GET /products/{id} returns origin_country; used during sync to populate shipping/customs.
 */
export async function fetchCatalogProductShippingCustoms(
  catalogProductId: number,
): Promise<{ countryOfOrigin: null | string; hsCode: null | string }> {
  try {
    const result = await pfFetchV1<{
      product?: { hs_code?: string; origin_country?: string };
    }>(`/products/${catalogProductId}`);
    const product = result?.product;
    return {
      countryOfOrigin: product?.origin_country?.trim() ?? null,
      hsCode: product?.hs_code?.trim() ?? null,
    };
  } catch {
    return { countryOfOrigin: null, hsCode: null };
  }
}

/**
 * GET /product-templates/{id} – Get a single product template by ID or external ID (e.g. @988123).
 */
export async function fetchProductTemplate(
  id: number | string,
  storeId?: number,
): Promise<PrintfulProductTemplateItem> {
  const path =
    typeof id === "string" && id.startsWith("@")
      ? `/product-templates/${id}`
      : `/product-templates/${id}`;
  return pfFetchV1(path, { storeId }) as Promise<PrintfulProductTemplateItem>;
}

/**
 * GET /product-templates – List product templates (account-level).
 * Requires scope product_templates or product_templates/read.
 */
export async function fetchProductTemplates(
  params: { limit?: number; offset?: number } = {},
  storeId?: number,
): Promise<PrintfulProductTemplatesResponse> {
  const search = new URLSearchParams();
  if (params.offset != null) search.set("offset", String(params.offset));
  if (params.limit != null) search.set("limit", String(params.limit));
  const qs = search.toString() ? `?${search.toString()}` : "";
  return pfFetchV1<PrintfulProductTemplatesResponse>(
    `/product-templates${qs}`,
    { storeId },
  );
}

// --- Product Templates API (V1) ---
// https://developers.printful.com/docs/#tag/Product-Templates-API
// Account-level; list/get templates created in your Printful account.

/**
 * GET /stores – Get basic information about all stores (account-level).
 * Requires an account-level private token.
 */
export async function fetchStores(): Promise<PrintfulStoreInfo[]> {
  const list = await pfFetchV1<
    PrintfulStoreInfo[] | { store: PrintfulStoreInfo[] }
  >("/stores", {});
  if (Array.isArray(list)) return list;
  if (list?.store && Array.isArray(list.store)) return list.store;
  return [];
}

/**
 * GET /store/products/{id} – Get a sync product with its variants.
 * @param id Sync Product ID (integer) or External ID (prefixed with @)
 */
export function fetchSyncProduct(
  id: number | string,
  storeId?: number,
): Promise<PrintfulSyncProductFull> {
  return pfFetchV1(`/store/products/${id}`, { storeId });
}

/**
 * GET /store/products – List sync products from your Printful store.
 * @param params Optional filter and pagination params
 * @param storeId Optional store ID for account-level tokens
 */
export async function fetchSyncProducts(
  params: {
    category_id?: string;
    limit?: number;
    offset?: number;
    status?:
      | "all"
      | "discontinued"
      | "ignored"
      | "imported"
      | "out_of_stock"
      | "synced"
      | "unsynced";
  } = {},
  storeId?: number,
): Promise<{
  paging: { limit: number; offset: number; total: number };
  products: PrintfulSyncProduct[];
}> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.category_id) search.set("category_id", params.category_id);
  if (params.offset != null) search.set("offset", String(params.offset));
  if (params.limit != null) search.set("limit", String(params.limit));
  const qs = search.toString() ? `?${search.toString()}` : "";

  const token = getToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (storeId != null) headers["X-PF-Store-Id"] = String(storeId);

  const res = await fetch(`${PRINTFUL_V1}/store/products${qs}`, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Printful V1 API ${res.status}: ${text}`);
  }

  const json = (await res.json()) as PrintfulSyncProductsResponse;
  return { paging: json.paging, products: json.result };
}

/**
 * GET /store/variants/{id} – Get a single sync variant.
 */
export function fetchSyncVariant(
  id: number | string,
  storeId?: number,
): Promise<PrintfulSyncVariant> {
  return pfFetchV1(`/store/variants/${id}`, { storeId });
}

// --- Mockup Generator API (V1) – retrieve print/design file URLs for template variants ---

/**
 * GET /mockup-generator/product-templates/{templateId}/variants/{variantId}/printfiles
 * Returns the actual print/design file URLs for a product template variant (used when creating sync products).
 * Optional: technique_key (e.g. "DTG") for placement-specific technique.
 */
export async function fetchTemplateVariantPrintfiles(
  templateId: number,
  variantId: number,
  options?: { technique_key?: string },
): Promise<null | PrintfulTemplatePrintfilesResult> {
  const qs = options?.technique_key
    ? `?technique_key=${encodeURIComponent(options.technique_key)}`
    : "";
  try {
    const result = await pfFetchV1<PrintfulTemplatePrintfilesResult>(
      `/mockup-generator/product-templates/${templateId}/variants/${variantId}/printfiles${qs}`,
      {},
    );
    return result;
  } catch {
    return null;
  }
}

/**
 * GET /webhooks – Get current webhook configuration.
 */
export async function getWebhookConfig(
  storeId?: number,
): Promise<null | PrintfulWebhookConfig> {
  try {
    return await pfFetchV1("/webhooks", { storeId });
  } catch {
    // No webhook configured
    return null;
  }
}

// --- Webhooks V1 API ---

/**
 * POST /webhooks – Set up webhook configuration.
 */
export async function setWebhookConfig(
  config: PrintfulWebhookConfig,
  storeId?: number,
): Promise<PrintfulWebhookConfig> {
  return pfFetchV1("/webhooks", { body: config, method: "POST", storeId });
}

/**
 * PUT /store/products/{id} – Modify a sync product.
 * Note: Only specify fields that need to change.
 * When updating variants, include IDs of all variants to keep - omitted ones are deleted.
 * Rate limit: 10 requests per 60 seconds.
 */
export async function updateSyncProduct(
  id: number | string,
  body: {
    sync_product?: {
      external_id?: string;
      is_ignored?: boolean;
      name?: string;
      thumbnail?: string;
    };
    sync_variants?: {
      availability_status?:
        | "active"
        | "discontinued"
        | "out_of_stock"
        | "temporary_out_of_stock";
      external_id?: string;
      files?: {
        filename?: string;
        options?: { id: string; value: boolean | string }[];
        type?: string;
        url?: string;
        visible?: boolean;
      }[];
      id?: number; // Include ID to keep existing variant
      is_ignored?: boolean;
      options?: { id: string; value: string }[];
      retail_price?: string;
      sku?: string;
      variant_id?: number;
    }[];
  },
  storeId?: number,
): Promise<PrintfulSyncProduct> {
  return pfFetchV1(`/store/products/${id}`, { body, method: "PUT", storeId });
}

/**
 * PUT /store/variants/{id} – Modify a single sync variant.
 * Only specify fields that need to change.
 */
export async function updateSyncVariant(
  id: number | string,
  body: {
    availability_status?:
      | "active"
      | "discontinued"
      | "out_of_stock"
      | "temporary_out_of_stock";
    external_id?: string;
    files?: {
      filename?: string;
      options?: { id: string; value: boolean | string }[];
      type?: string;
      url?: string;
      visible?: boolean;
    }[];
    is_ignored?: boolean;
    options?: { id: string; value: string }[];
    retail_price?: string;
    sku?: string;
    variant_id?: number;
  },
  storeId?: number,
): Promise<PrintfulSyncVariant> {
  return pfFetchV1(`/store/variants/${id}`, { body, method: "PUT", storeId });
}

async function pfFetchV1<T>(
  path: string,
  options: { body?: unknown; method?: string; storeId?: number } = {},
): Promise<T> {
  const { body, method = "GET", storeId } = options;
  const token = getToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (storeId != null) headers["X-PF-Store-Id"] = String(storeId);

  const res = await fetch(
    path.startsWith("http") ? path : `${PRINTFUL_V1}${path}`,
    {
      headers,
      method,
      ...(body != null && { body: JSON.stringify(body) }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    let errMessage = `Printful V1 API ${res.status}: ${text}`;
    try {
      const json = JSON.parse(text) as {
        error?: { message?: string };
        result?: string;
      };
      errMessage = json.error?.message ?? json.result ?? errMessage;
    } catch {
      // keep text
    }
    throw new Error(errMessage);
  }

  const json = (await res.json()) as { code: number; result: T };
  return json.result;
}
