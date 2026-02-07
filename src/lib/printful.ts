/**
 * Printful API v2 client. Base URL: https://api.printful.com, auth: Bearer token.
 * Used for catalog sync, shipping rates, and order creation/confirmation.
 */

const PRINTFUL_BASE = "https://api.printful.com";
const PRINTFUL_V2 = `${PRINTFUL_BASE}/v2`;

function getToken(): string {
  const token = process.env.PRINTFUL_API_TOKEN?.trim();
  if (!token) throw new Error("PRINTFUL_API_TOKEN is not set");
  return token;
}

/** use when Printful is optional (e.g. shipping fallback). */
export function getPrintfulIfConfigured(): { token: string } | null {
  const token = process.env.PRINTFUL_API_TOKEN?.trim();
  if (!token) return null;
  return { token };
}

async function pfFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; storeId?: number } = {},
): Promise<T> {
  const { method = "GET", body, storeId } = options;
  const token = getToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (storeId != null) headers["X-PF-Store-Id"] = String(storeId);

  const res = await fetch(
    path.startsWith("http") ? path : `${PRINTFUL_V2}${path}`,
    {
      method,
      headers,
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

// --- Catalog (products sync) ---

export type PrintfulCatalogProduct = {
  id: number;
  main_category_id: number;
  type: string;
  name: string;
  brand: string | null;
  model: string | null;
  image: string | null;
  variant_count: number;
  is_discontinued: boolean;
  description: string | null;
  _links?: { variants?: { href: string } };
};

export type PrintfulCatalogVariant = {
  id: number;
  catalog_product_id: number;
  name: string;
  size: string | null;
  color: string | null;
  color_code: string | null;
  color_code2: string | null;
  image: string | null;
};

export type PrintfulCatalogProductsResponse = {
  data: PrintfulCatalogProduct[];
  paging: { total: number; offset: number; limit: number };
  _links?: Record<string, { href: string }>;
};

export type PrintfulCatalogVariantsResponse = {
  data: PrintfulCatalogVariant[];
  paging: { total: number; offset: number; limit: number };
  _links?: Record<string, { href: string }>;
};

export type PrintfulVariantPriceResponse = {
  data: {
    currency: string;
    variant: {
      id: number;
      techniques: Array<{
        technique_key: string;
        price: string;
        discounted_price: string;
      }>;
    };
  };
};

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

/** GET /v2/catalog-products/{id}/catalog-variants. */
export function fetchCatalogVariants(catalogProductId: number) {
  return pfFetch<PrintfulCatalogVariantsResponse>(
    `/catalog-products/${catalogProductId}/catalog-variants`,
  );
}

/** GET /v2/catalog-variants/{id}/prices. Optional: selling_region_name, currency. */
export function fetchVariantPrices(
  catalogVariantId: number,
  params: { selling_region_name?: string; currency?: string } = {},
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

// --- Size guide ---

export type PrintfulSizeGuideResponse = {
  data: {
    catalog_product_id: number;
    available_sizes: string[];
    size_tables: Array<{
      type: string;
      unit: string;
      description?: string;
      image_url?: string;
      measurements?: Array<{ type_label: string; values: unknown[] }>;
    }>;
  };
};

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

/** GET /v2/catalog-products/{id} – single product. */
export function fetchCatalogProduct(catalogProductId: number) {
  return pfFetch<{ data: PrintfulCatalogProduct }>(
    `/catalog-products/${catalogProductId}`,
  );
}

/**
 * GET /v2/catalog-products/{id}/shipping-countries – countries this product can ship to.
 * Returns ISO 3166-1 alpha-2 codes. On 404 or error, returns null (caller can fall back to static list).
 */
export async function fetchCatalogProductShippingCountries(
  catalogProductId: number,
): Promise<string[] | null> {
  try {
    const res = await pfFetch<{
      data?: Array<{ country_code?: string }> | { country_codes?: string[] };
    }>(`/catalog-products/${catalogProductId}/shipping-countries`);
    if (!res?.data) return null;
    const arr = Array.isArray(res.data)
      ? res.data
      : (res.data as { country_codes?: string[] }).country_codes;
    if (!Array.isArray(arr)) return null;
    const codes = arr
      .map((x) =>
        typeof x === "string" ? x : (x as { country_code?: string }).country_code,
      )
      .filter((c): c is string => typeof c === "string" && c.length === 2);
    return codes.length > 0 ? codes.map((c) => c.toUpperCase()) : null;
  } catch {
    return null;
  }
}

// --- Shipping rates ---

export type PrintfulRecipient = {
  name?: string;
  company?: string;
  address1: string;
  address2?: string;
  city?: string;
  state_code?: string;
  state_name?: string;
  country_code: string;
  country_name?: string;
  zip?: string;
  phone?: string;
  email?: string;
};

export type PrintfulShippingOrderItem = {
  source: "catalog";
  catalog_variant_id: number;
  quantity: number;
};

export type PrintfulShippingRatesRequest = {
  recipient: PrintfulRecipient;
  order_items: PrintfulShippingOrderItem[];
  currency?: string;
};

export type PrintfulShippingRateOption = {
  shipping: string;
  shipping_method_name: string;
  rate: string;
  currency: string;
  min_delivery_days?: number;
  max_delivery_days?: number;
  min_delivery_date?: string;
  max_delivery_date?: string;
  shipments?: Array<{
    departure_country?: string;
    customs_fees_possible?: boolean;
  }>;
};

export type PrintfulShippingRatesResponse = {
  data: PrintfulShippingRateOption[];
  extra?: unknown[];
};

/** POST /v2/shipping-rates. Recipient must include country_code; state_code required for US, CA, AU. */
export function fetchShippingRates(
  body: PrintfulShippingRatesRequest,
  storeId?: number,
): Promise<PrintfulShippingRatesResponse> {
  return pfFetch("/shipping-rates", { method: "POST", body, storeId });
}

// --- Orders ---

export type PrintfulOrderItem = {
  source: "catalog";
  catalog_variant_id: number;
  quantity: number;
  external_id?: string;
  retail_price?: string;
  name?: string;
};

export type PrintfulCreateOrderRequest = {
  external_id?: string;
  shipping?: string;
  recipient: PrintfulRecipient;
  order_items: PrintfulOrderItem[];
  customization?: {
    gift?: { subject?: string; message?: string };
    packing_slip?: Record<string, unknown>;
  };
  retail_costs?: {
    currency?: string;
    discount?: string;
    shipping?: string;
    tax?: string;
  };
};

export type PrintfulOrderResponse = {
  data: {
    id: number;
    external_id: string | null;
    store_id: number;
    status: string;
    created_at: string;
    updated_at: string;
    recipient: PrintfulRecipient;
    costs?: {
      calculation_status: string;
      currency: string | null;
      total: string | null;
    };
    retail_costs?: { calculation_status: string; total: string | null };
    order_items?: Array<{
      id: number;
      catalog_variant_id: number;
      quantity: number;
      name: string | null;
      price: string | null;
      retail_price: string | null;
    }>;
    _links?: {
      order_confirmation?: { href: string };
      shipments?: { href: string };
    };
  };
};

/** POST /v2/orders – creates draft. */
export function createPrintfulOrder(
  body: PrintfulCreateOrderRequest,
  storeId?: number,
): Promise<PrintfulOrderResponse> {
  return pfFetch("/orders", { method: "POST", body, storeId });
}

/** POST /v2/orders/{order_id}/confirmation – submit for fulfillment. */
export function confirmPrintfulOrder(
  printfulOrderId: number,
  storeId?: number,
): Promise<PrintfulOrderResponse> {
  return pfFetch(`/orders/${printfulOrderId}/confirmation`, {
    method: "POST",
    storeId,
  });
}

/** GET /v2/orders/{order_id} – retrieve order details. */
export function getPrintfulOrder(
  printfulOrderId: number,
  storeId?: number,
): Promise<PrintfulOrderResponse> {
  return pfFetch(`/orders/${printfulOrderId}`, { storeId });
}

/** DELETE /v2/orders/{order_id} – delete/cancel a draft or failed order. */
export async function deletePrintfulOrder(
  printfulOrderId: number,
  storeId?: number,
): Promise<{ success: boolean; error?: string }> {
  const token = getToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (storeId != null) headers["X-PF-Store-Id"] = String(storeId);

  const res = await fetch(`${PRINTFUL_V2}/orders/${printfulOrderId}`, {
    method: "DELETE",
    headers,
  });

  if (res.status === 204) {
    return { success: true };
  }

  if (res.status === 409) {
    return {
      success: false,
      error: "Order cannot be cancelled - already in process",
    };
  }

  if (!res.ok) {
    const text = await res.text();
    return { success: false, error: `Printful API ${res.status}: ${text}` };
  }

  return { success: true };
}

// ============================================================================
// Printful V1 API – Sync Products (Products API)
// Used for bidirectional product synchronization
// ============================================================================

const PRINTFUL_V1 = PRINTFUL_BASE;

async function pfFetchV1<T>(
  path: string,
  options: { method?: string; body?: unknown; storeId?: number } = {},
): Promise<T> {
  const { method = "GET", body, storeId } = options;
  const token = getToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (storeId != null) headers["X-PF-Store-Id"] = String(storeId);

  const res = await fetch(
    path.startsWith("http") ? path : `${PRINTFUL_V1}${path}`,
    {
      method,
      headers,
      ...(body != null && { body: JSON.stringify(body) }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    let errMessage = `Printful V1 API ${res.status}: ${text}`;
    try {
      const json = JSON.parse(text) as {
        result?: string;
        error?: { message?: string };
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

// --- Store Information API (account-level, no X-PF-Store-Id) ---

export type PrintfulStoreInfo = {
  id: number;
  type: string;
  name: string;
  website?: string;
  address?: string;
  created_at?: number;
};

/**
 * GET /stores – Get basic information about all stores (account-level).
 * Requires an account-level private token.
 */
export async function fetchStores(): Promise<PrintfulStoreInfo[]> {
  const list = await pfFetchV1<PrintfulStoreInfo[] | { store: PrintfulStoreInfo[] }>(
    "/stores",
    {},
  );
  if (Array.isArray(list)) return list;
  if (list?.store && Array.isArray(list.store)) return list.store;
  return [];
}

/**
 * Fetch country of origin (and HS code if present) from Printful V1 catalog product.
 * V1 GET /products/{id} returns origin_country; used during sync to populate shipping/customs.
 */
export async function fetchCatalogProductShippingCustoms(
  catalogProductId: number,
): Promise<{ countryOfOrigin: string | null; hsCode: string | null }> {
  try {
    const result = await pfFetchV1<{
      product?: { origin_country?: string; hs_code?: string };
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

// --- Sync Product Types ---

export type PrintfulSyncProductFile = {
  type: string;
  id?: number;
  url?: string;
  options?: Array<{ id: string; value: string | boolean }>;
  hash?: string;
  filename?: string;
  mime_type?: string;
  size?: number;
  width?: number;
  height?: number;
  dpi?: number;
  status?: string;
  created?: number;
  thumbnail_url?: string;
  preview_url?: string;
  visible?: boolean;
};

export type PrintfulSyncVariant = {
  id: number;
  external_id: string | null;
  sync_product_id: number;
  name: string;
  synced: boolean;
  variant_id: number; // Printful catalog variant ID
  retail_price: string | null;
  currency: string;
  is_ignored: boolean;
  sku: string | null;
  product: {
    variant_id: number;
    product_id: number;
    image: string | null;
    name: string;
  };
  files: PrintfulSyncProductFile[];
  options: Array<{ id: string; value: string }>;
  main_category_id: number;
  size: string | null;
  color: string | null;
  availability_status?: string;
};

export type PrintfulSyncProduct = {
  id: number;
  external_id: string | null;
  name: string;
  variants: number;
  synced: number;
  thumbnail_url: string | null;
  is_ignored: boolean;
};

export type PrintfulSyncProductFull = {
  sync_product: PrintfulSyncProduct;
  sync_variants: PrintfulSyncVariant[];
};

export type PrintfulSyncProductsResponse = {
  code: number;
  paging: { total: number; offset: number; limit: number };
  result: PrintfulSyncProduct[];
};

// --- Sync Products API (V1) ---

/**
 * GET /store/products – List sync products from your Printful store.
 * @param params Optional filter and pagination params
 * @param storeId Optional store ID for account-level tokens
 */
export async function fetchSyncProducts(
  params: {
    status?:
      | "all"
      | "synced"
      | "unsynced"
      | "ignored"
      | "imported"
      | "discontinued"
      | "out_of_stock";
    category_id?: string;
    offset?: number;
    limit?: number;
  } = {},
  storeId?: number,
): Promise<{
  products: PrintfulSyncProduct[];
  paging: { total: number; offset: number; limit: number };
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
  return { products: json.result, paging: json.paging };
}

/**
 * POST /store/products – Create a new sync product with sync variants.
 */
export async function createSyncProduct(
  body: {
    sync_product: {
      external_id?: string;
      name: string;
      thumbnail?: string;
      is_ignored?: boolean;
    };
    sync_variants: Array<{
      external_id?: string;
      variant_id: number;
      retail_price?: string;
      is_ignored?: boolean;
      sku?: string;
      files: Array<{
        type?: string;
        url: string;
        position?: {
          area_width: number;
          area_height: number;
          width: number;
          height: number;
          top: number;
          left: number;
        };
        options?: Array<{ id: string; value: string | boolean }>;
        filename?: string;
        visible?: boolean;
      }>;
      options?: Array<{ id: string; value: string }>;
      availability_status?:
        | "active"
        | "discontinued"
        | "out_of_stock"
        | "temporary_out_of_stock";
    }>;
  },
  storeId?: number,
): Promise<PrintfulSyncProduct> {
  return pfFetchV1("/store/products", { method: "POST", body, storeId });
}

/**
 * GET /store/products/{id} – Get a sync product with its variants.
 * @param id Sync Product ID (integer) or External ID (prefixed with @)
 */
export function fetchSyncProduct(
  id: string | number,
  storeId?: number,
): Promise<PrintfulSyncProductFull> {
  return pfFetchV1(`/store/products/${id}`, { storeId });
}

/**
 * PUT /store/products/{id} – Modify a sync product.
 * Note: Only specify fields that need to change.
 * When updating variants, include IDs of all variants to keep - omitted ones are deleted.
 * Rate limit: 10 requests per 60 seconds.
 */
export async function updateSyncProduct(
  id: string | number,
  body: {
    sync_product?: {
      external_id?: string;
      name?: string;
      thumbnail?: string;
      is_ignored?: boolean;
    };
    sync_variants?: Array<{
      id?: number; // Include ID to keep existing variant
      external_id?: string;
      variant_id?: number;
      retail_price?: string;
      is_ignored?: boolean;
      sku?: string;
      files?: Array<{
        type?: string;
        url?: string;
        options?: Array<{ id: string; value: string | boolean }>;
        filename?: string;
        visible?: boolean;
      }>;
      options?: Array<{ id: string; value: string }>;
      availability_status?:
        | "active"
        | "discontinued"
        | "out_of_stock"
        | "temporary_out_of_stock";
    }>;
  },
  storeId?: number,
): Promise<PrintfulSyncProduct> {
  return pfFetchV1(`/store/products/${id}`, { method: "PUT", body, storeId });
}

/**
 * PUT /store/variants/{id} – Modify a single sync variant.
 * Only specify fields that need to change.
 */
export async function updateSyncVariant(
  id: string | number,
  body: {
    external_id?: string;
    variant_id?: number;
    retail_price?: string;
    is_ignored?: boolean;
    sku?: string;
    files?: Array<{
      type?: string;
      url?: string;
      options?: Array<{ id: string; value: string | boolean }>;
      filename?: string;
      visible?: boolean;
    }>;
    options?: Array<{ id: string; value: string }>;
    availability_status?:
      | "active"
      | "discontinued"
      | "out_of_stock"
      | "temporary_out_of_stock";
  },
  storeId?: number,
): Promise<PrintfulSyncVariant> {
  return pfFetchV1(`/store/variants/${id}`, { method: "PUT", body, storeId });
}

/**
 * GET /store/variants/{id} – Get a single sync variant.
 */
export function fetchSyncVariant(
  id: string | number,
  storeId?: number,
): Promise<PrintfulSyncVariant> {
  return pfFetchV1(`/store/variants/${id}`, { storeId });
}

/**
 * DELETE /store/products/{id} – Delete a sync product and all its variants.
 */
export async function deleteSyncProduct(
  id: string | number,
  storeId?: number,
): Promise<{ success: boolean; error?: string }> {
  const token = getToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (storeId != null) headers["X-PF-Store-Id"] = String(storeId);

  const res = await fetch(`${PRINTFUL_V1}/store/products/${id}`, {
    method: "DELETE",
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    return { success: false, error: `Printful V1 API ${res.status}: ${text}` };
  }

  return { success: true };
}

// --- Product Templates API (V1) ---
// https://developers.printful.com/docs/#tag/Product-Templates-API
// Account-level; list/get templates created in your Printful account.

export type PrintfulProductTemplateItem = {
  id: number;
  product_id: number;
  external_product_id: string | null;
  title: string;
  available_variant_ids: number[];
  option_data?: Array<{ id: string; value: string | string[] }>;
  colors?: Array<{ color_name: string; color_codes: string[] }>;
  sizes?: string[];
  mockup_file_url?: string;
  mockup_file?: {
    imageURL?: string;
    thumbnailURL?: string;
    status?: string;
  };
  placements?: Array<{
    placement: string;
    display_name: string;
    technique_key?: string;
    technique_display_name?: string;
    options?: unknown[];
  }>;
  placement_option_data?: Array<{ type: string; options: unknown[] }>;
  design_id?: string | null;
  created_at?: number;
  updated_at?: number;
};

export type PrintfulProductTemplatesResponse = {
  items: PrintfulProductTemplateItem[];
  paging?: { total: number; offset: number; limit: number };
};

/**
 * GET /product-templates – List product templates (account-level).
 * Requires scope product_templates or product_templates/read.
 */
export async function fetchProductTemplates(
  params: { offset?: number; limit?: number } = {},
  storeId?: number,
): Promise<PrintfulProductTemplatesResponse> {
  const search = new URLSearchParams();
  if (params.offset != null) search.set("offset", String(params.offset));
  if (params.limit != null) search.set("limit", String(params.limit));
  const qs = search.toString() ? `?${search.toString()}` : "";
  return pfFetchV1<PrintfulProductTemplatesResponse>(`/product-templates${qs}`, { storeId });
}

/**
 * GET /product-templates/{id} – Get a single product template by ID or external ID (e.g. @988123).
 */
export async function fetchProductTemplate(
  id: string | number,
  storeId?: number,
): Promise<PrintfulProductTemplateItem> {
  const path = typeof id === "string" && id.startsWith("@") ? `/product-templates/${id}` : `/product-templates/${id}`;
  return pfFetchV1(path, { storeId }) as Promise<PrintfulProductTemplateItem>;
}

// --- Mockup Generator API (V1) – retrieve print/design file URLs for template variants ---

/** Response shape for printfiles endpoint (placement → file URL). */
export type PrintfulTemplatePrintfilesResult = {
  [placement: string]: Array<{ url?: string; type?: string; [key: string]: unknown }>;
};

/**
 * GET /mockup-generator/product-templates/{templateId}/variants/{variantId}/printfiles
 * Returns the actual print/design file URLs for a product template variant (used when creating sync products).
 * Optional: technique_key (e.g. "DTG") for placement-specific technique.
 */
export async function fetchTemplateVariantPrintfiles(
  templateId: number,
  variantId: number,
  options?: { technique_key?: string },
): Promise<PrintfulTemplatePrintfilesResult | null> {
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

// --- Webhooks V1 API ---

export type PrintfulWebhookConfig = {
  url: string;
  types: string[];
  params?: Record<string, unknown>;
};

/**
 * GET /webhooks – Get current webhook configuration.
 */
export async function getWebhookConfig(
  storeId?: number,
): Promise<PrintfulWebhookConfig | null> {
  try {
    return await pfFetchV1("/webhooks", { storeId });
  } catch {
    // No webhook configured
    return null;
  }
}

/**
 * POST /webhooks – Set up webhook configuration.
 */
export async function setWebhookConfig(
  config: PrintfulWebhookConfig,
  storeId?: number,
): Promise<PrintfulWebhookConfig> {
  return pfFetchV1("/webhooks", { method: "POST", body: config, storeId });
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
