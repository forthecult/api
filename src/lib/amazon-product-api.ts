/**
 * Amazon Creators API client. The successor to PA-API 5.0.
 * Uses OAuth 2.0 client-credentials flow with token caching.
 *
 * @see https://affiliate-program.amazon.com/creatorsapi/docs/en-us/introduction
 */

export interface AmazonProduct {
  asin: string;
  source: "amazon";
  name: string;
  price: { usd: number; crypto: Record<string, string> };
  imageUrl?: string;
  rating?: number;
  reviewCount?: number;
  isPrime?: boolean;
  productUrl: string;
  inStock: boolean;
}

export interface SearchAmazonProductsParams {
  query: string;
  limit?: number;
  page?: number;
  priceMin?: number;
  priceMax?: number;
}

export interface SearchAmazonProductsResult {
  products: AmazonProduct[];
  totalResultCount?: number;
}

const CREATORS_API_HOST = "https://creatorsapi.amazon";
const AUTH_ENDPOINT = "https://api.amazon.com/auth/o2/token";
const AUTH_SCOPE = "affiliate::creatorsapi:write";

const SEARCH_INDEX = "All";
const SEARCH_RESOURCES = [
  "images.primary.medium",
  "itemInfo.title",
  "offersV2.listings.price",
  "offersV2.listings.deliveryInfo",
  "offersV2.listings.availability",
  "itemInfo.features",
  "customerReviews.starRating",
  "customerReviews.count",
];
const GET_ITEMS_RESOURCES = [
  "images.primary.medium",
  "itemInfo.title",
  "offersV2.listings.price",
  "offersV2.listings.deliveryInfo",
  "offersV2.listings.availability",
  "detailPageUrl",
];

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;

function getConfig() {
  const credentialId = process.env.AMAZON_CREDENTIAL_ID;
  const credentialSecret = process.env.AMAZON_CREDENTIAL_SECRET;
  const partnerTag = process.env.AMAZON_PARTNER_TAG;
  const marketplace = process.env.AMAZON_MARKETPLACE ?? "www.amazon.com";
  // version: "2.1" for NA, "2.2" for EU, "2.3" for FE
  const version = process.env.AMAZON_API_VERSION ?? "2.1";
  return { credentialId, credentialSecret, partnerTag, marketplace, version };
}

export function isAmazonProductApiConfigured(): boolean {
  const { credentialId, credentialSecret, partnerTag } = getConfig();
  return Boolean(credentialId && credentialSecret && partnerTag);
}

/**
 * Gets an OAuth2 access token using client credentials flow.
 * Tokens are cached and reused until ~5 min before expiry.
 */
async function getAccessToken(): Promise<string> {
  const { credentialId, credentialSecret } = getConfig();
  if (!credentialId || !credentialSecret) {
    throw new Error(
      "AMAZON_CREDENTIAL_ID and AMAZON_CREDENTIAL_SECRET must be set",
    );
  }

  // return cached token if still valid (with 5 min buffer)
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 5 * 60 * 1000) {
    return cachedToken.accessToken;
  }

  const response = await fetch(AUTH_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: credentialId,
      client_secret: credentialSecret,
      scope: AUTH_SCOPE,
    }).toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get Amazon OAuth token: ${response.status} - ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
    token_type: string;
  };

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return cachedToken.accessToken;
}

type CreatorsApiItem = {
  asin?: string;
  detailPageUrl?: string;
  images?: {
    primary?: { medium?: { url?: string }; small?: { url?: string } };
  };
  itemInfo?: {
    title?: { displayValue?: string };
  };
  offersV2?: {
    listings?: Array<{
      price?: { amount?: number; displayAmount?: string };
      deliveryInfo?: { isPrimeEligible?: boolean };
      availability?: { type?: string };
    }>;
  };
  customerReviews?: { starRating?: { value?: number }; count?: number };
};

function normalizeItem(
  item: CreatorsApiItem,
  partnerTag: string,
): AmazonProduct | null {
  const asin = item.asin;
  const title = item.itemInfo?.title?.displayValue;
  if (!asin || !title) return null;

  const listing = item.offersV2?.listings?.[0];
  const amount = listing?.price?.amount;
  const usd = typeof amount === "number" ? amount : 0;
  const image =
    item.images?.primary?.medium?.url ?? item.images?.primary?.small?.url;
  const detailUrl = item.detailPageUrl;
  const productUrl =
    detailUrl && partnerTag
      ? `${detailUrl}${detailUrl.includes("?") ? "&" : "?"}tag=${encodeURIComponent(partnerTag)}`
      : `https://www.amazon.com/dp/${asin}${partnerTag ? `?tag=${encodeURIComponent(partnerTag)}` : ""}`;
  const hasListingWithPrice =
    listing != null && typeof listing.price?.amount === "number";
  const inStock = hasListingWithPrice;

  return {
    asin,
    source: "amazon",
    name: title,
    price: { usd, crypto: {} },
    imageUrl: image ?? undefined,
    rating: item.customerReviews?.starRating?.value,
    reviewCount: item.customerReviews?.count,
    isPrime: listing?.deliveryInfo?.isPrimeEligible ?? false,
    productUrl,
    inStock,
  };
}

interface SearchItemsResponse {
  searchResult?: {
    items?: CreatorsApiItem[];
    totalResultCount?: number;
  };
  errors?: Array<{ code?: string; message?: string }>;
}

interface GetItemsResponse {
  itemsResult?: {
    items?: CreatorsApiItem[];
  };
  errors?: Array<{ code?: string; message?: string }>;
}

/**
 * Search Amazon products via Creators API searchItems.
 */
export async function searchAmazonProducts(
  params: SearchAmazonProductsParams,
): Promise<SearchAmazonProductsResult> {
  const { partnerTag, marketplace, version } = getConfig();
  if (!partnerTag) {
    throw new Error("AMAZON_PARTNER_TAG must be set");
  }

  const token = await getAccessToken();
  const limit = Math.min(10, Math.max(1, params.limit ?? 10));
  const page = Math.max(1, params.page ?? 1);

  const requestBody = {
    partnerTag,
    keywords: params.query.trim(),
    searchIndex: SEARCH_INDEX,
    itemCount: limit,
    itemPage: page,
    resources: SEARCH_RESOURCES,
  };

  const response = await fetch(`${CREATORS_API_HOST}/search-items`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
      "x-marketplace": marketplace,
      "x-api-version": version,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Creators API searchItems failed: ${response.status} - ${text}`);
  }

  const data = (await response.json()) as SearchItemsResponse;

  if (data.errors?.length) {
    const errMsg = data.errors.map((e) => e.message).join(", ");
    throw new Error(`Creators API searchItems errors: ${errMsg}`);
  }

  const items = data.searchResult?.items ?? [];
  const totalResultCount = data.searchResult?.totalResultCount;

  const products = items
    .map((item) => normalizeItem(item, partnerTag))
    .filter((p): p is AmazonProduct => p != null);

  return { products, totalResultCount };
}

/**
 * Get a single Amazon product by ASIN.
 */
export async function getAmazonProduct(
  asin: string,
): Promise<AmazonProduct | null> {
  const [product] = await getAmazonProducts([asin]);
  return product ?? null;
}

/**
 * Get multiple Amazon products by ASIN (up to 10). Returns only successfully resolved items.
 */
export async function getAmazonProducts(
  asins: string[],
): Promise<AmazonProduct[]> {
  if (asins.length === 0) return [];

  const { partnerTag, marketplace, version } = getConfig();
  if (!partnerTag) {
    throw new Error("AMAZON_PARTNER_TAG must be set");
  }

  const token = await getAccessToken();
  const ids = asins.slice(0, 10).filter((id) => id?.trim());

  const requestBody = {
    partnerTag,
    itemIds: ids,
    resources: GET_ITEMS_RESOURCES,
  };

  const response = await fetch(`${CREATORS_API_HOST}/get-items`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
      "x-marketplace": marketplace,
      "x-api-version": version,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Creators API getItems failed: ${response.status} - ${text}`);
  }

  const data = (await response.json()) as GetItemsResponse;

  if (data.errors?.length) {
    const errMsg = data.errors.map((e) => e.message).join(", ");
    throw new Error(`Creators API getItems errors: ${errMsg}`);
  }

  const items = data.itemsResult?.items ?? [];

  return items
    .map((item) => normalizeItem(item, partnerTag))
    .filter((p): p is AmazonProduct => p != null);
}
