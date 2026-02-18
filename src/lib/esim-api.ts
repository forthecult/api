/**
 * eSIM Card Reseller API Client
 *
 * Server-side client for the eSIM Card reseller API (https://portal.esimcard.com).
 * Handles authentication, token management, and all eSIM operations.
 */

const ESIM_API_BASE = "https://portal.esimcard.com/api/developer/reseller";

/** Request timeout in ms to avoid hanging on slow provider responses. */
const ESIM_REQUEST_TIMEOUT_MS =
  Number(process.env.ESIM_REQUEST_TIMEOUT_MS) || 20_000;

/** Max retries on 429 (rate limit). */
const ESIM_429_MAX_RETRIES = 3;
const ESIM_429_BACKOFF_MS = [2_000, 5_000, 10_000];

// ---------- Types ----------

export interface DataVoiceSmsPurchaseResult {
  activated: boolean;
  id: string;
  package: string;
  status: string;
}

export interface EsimContinent {
  code: string;
  id: number;
  image_url: string;
  name: string;
}

export interface EsimCountry {
  code?: string;
  id: number;
  image_url: string;
  name: string;
  packages?: EsimPackage[];
}

export interface EsimCountryWithCoverage {
  id: number;
  image_url: string;
  name: string;
  network_coverage: NetworkCoverage[];
}

export interface EsimPackage {
  data_quantity: number;
  data_unit: string;
  id: string;
  name: string;
  package_type?: string;
  package_validity: number;
  package_validity_unit: string;
  price: string;
  sms_quantity?: number;
  unlimited?: boolean;
  voice_quantity?: number;
  voice_unit?: string;
}

export type EsimPackageDetail = EsimPackage & {
  countries?: EsimCountryWithCoverage[];
  romaing_countries?: EsimCountryWithCoverage[];
};

export interface EsimPurchaseResult {
  message?: string;
  order_id?: number;
  sim?: {
    iccid: string;
    id: string;
    status: string;
  };
  sim_applied: boolean;
  sim_id?: string;
}

export interface EsimUsage {
  initial_data_quantity: number | string;
  initial_data_unit: string;
  rem_data_quantity: number | string;
  rem_data_unit: string;
}

export interface NetworkCoverage {
  five_G: boolean;
  four_G: boolean;
  network_code: string;
  network_name: string;
  three_g: boolean;
  two_g: boolean;
}

export interface PaginationMeta {
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
}

export interface PricingCountry {
  code: string;
  name: string;
  packages: EsimPackage[];
}

export interface PurchasedBundle {
  activated: boolean;
  date_activated: string;
  date_created: string;
  date_expiry: string;
  id: string;
  initial_data_quantity: number;
  initial_data_unit: string;
  package: string;
  rem_data_quantity: number;
  rem_data_unit: string;
  status: string;
}

export interface PurchasedEsim {
  created_at: string;
  iccid: string;
  id: string;
  last_bundle: string;
  status: string;
  total_bundles: number;
  universal_link?: string;
}

export interface PurchasedEsimDetail {
  in_use_packages: {
    id: string;
    package: string;
    status: string;
  }[];
  sim: {
    iccid: string;
    id: string;
    status: string;
    total_bundles: number;
  };
}

// ---------- Token Cache ----------

let cachedToken: null | string = null;
let tokenExpiresAt = 0;

/** Check if an eSIM can be topped up */
export async function checkEsimTopup(
  imei: string,
): Promise<{ data: { topup_available: boolean }; status: boolean }> {
  return esimFetch("/can-topup-esim", {
    body: JSON.stringify({ imei }),
    method: "POST",
  });
}

/**
 * Check whether a package is still available from the provider AND whether
 * it has 5G coverage, in a single detail call. This is used by list endpoints
 * to filter out packages the provider no longer serves.
 */
export async function checkPackageAvailability(
  packageId: string,
): Promise<{ available: boolean; has5g: boolean }> {
  try {
    const result = await getEsimPackageDetail(packageId);
    if (!result.status || !result.data) {
      return { available: false, has5g: false };
    }
    const countries =
      result.data.countries ?? result.data.romaing_countries ?? [];
    const has5g = countries.some((c) =>
      (c.network_coverage ?? []).some((n) => n.five_G),
    );
    return { available: true, has5g };
  } catch {
    return { available: false, has5g: false };
  }
}

/** Get bundle details */
export async function getBundleDetail(
  bundleId: string,
): Promise<{ data: PurchasedBundle[]; status: boolean }> {
  return esimFetch(`/bundles/${bundleId}`);
}

// ---------- API Methods ----------

/** Get reseller account balance */
export async function getEsimBalance(): Promise<{
  balance: number;
  status: boolean;
}> {
  return esimFetch("/balance");
}

/** Get packages for a specific continent */
export async function getEsimContinentPackages(
  continentId: number,
  packageType?: "DATA-ONLY" | "DATA-VOICE-SMS",
  page = 1,
): Promise<{
  data: EsimPackage[];
  meta: PaginationMeta;
  status: boolean;
}> {
  const params = new URLSearchParams({ page: String(page) });
  if (packageType) params.set("package_type", packageType);
  return esimFetch(`/packages/continent/${continentId}?${params}`);
}

/** Get list of continents */
export async function getEsimContinents(): Promise<{
  data: EsimContinent[];
  status: boolean;
}> {
  return esimFetch("/packages/continent");
}

/** Get list of countries with eSIM coverage */
export async function getEsimCountries(): Promise<{
  data: EsimCountry[];
  status: boolean;
}> {
  return esimFetch("/packages/country");
}

/** Get packages available for a specific country */
export async function getEsimCountryPackages(
  countryId: number,
  packageType?: "DATA-ONLY" | "DATA-VOICE-SMS",
  page = 1,
): Promise<{
  data: EsimPackage[];
  meta: PaginationMeta;
  status: boolean;
}> {
  const params = new URLSearchParams({ page: String(page) });
  if (packageType) params.set("package_type", packageType);
  return esimFetch(`/packages/country/${countryId}?${params}`);
}

/** Get details for a specific purchased eSIM */
export async function getEsimDetail(
  esimId: string,
): Promise<{ data: PurchasedEsimDetail; status: boolean }> {
  return esimFetch(`/my-esims/${esimId}`);
}

/** Get global packages */
export async function getEsimGlobalPackages(
  packageType: "DATA-ONLY" | "DATA-VOICE-SMS" = "DATA-ONLY",
): Promise<{
  data: EsimPackage[];
  meta: PaginationMeta;
  status: boolean;
}> {
  return esimFetch(`/packages/global/${packageType}`);
}

/** Get order details */
export async function getEsimOrder(
  orderId: number,
): Promise<{ data: unknown[]; status: boolean }> {
  return esimFetch(`/order/${orderId}`);
}

/** Get detailed info for a specific package */
export async function getEsimPackageDetail(
  packageId: string,
): Promise<{ data: EsimPackageDetail; status: boolean }> {
  return esimFetch(`/package/detail/${packageId}`);
}

/** Get package detail with retries for transient provider/network failures. */
export async function getEsimPackageDetailWithRetry(
  packageId: string,
  maxRetries = 3,
): Promise<{ data: EsimPackageDetail; status: boolean }> {
  const delays = [0, 500, 1500]; // first attempt immediate, then backoff
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0 && delays[attempt] != null) {
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
    try {
      const result = await getEsimPackageDetail(packageId);
      if (result?.status && result?.data) return result;
      lastError = new Error("Provider returned no data");
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

/** Get paginated list of all packages */
export async function getEsimPackages(
  packageType: "DATA-ONLY" | "DATA-VOICE-SMS" = "DATA-ONLY",
  page = 1,
): Promise<{
  data: EsimPackage[];
  meta: PaginationMeta;
  status: boolean;
}> {
  return esimFetch(`/packages?package_type=${packageType}&page=${page}`);
}

/** Get all packages & pricing grouped by country */
export async function getEsimPricing(): Promise<{
  data: { countries: PricingCountry[] };
  status: boolean;
}> {
  return esimFetch("/pricing");
}

/** Get usage for a specific eSIM */
export async function getEsimUsage(
  esimId: string,
): Promise<{ data: EsimUsage; status: boolean }> {
  return esimFetch(`/my-sim/${esimId}/usage`);
}

/** Get purchased bundles */
export async function getMyBundles(page = 1): Promise<{
  data: PurchasedBundle[];
  meta: PaginationMeta;
  status: boolean;
}> {
  return esimFetch(`/my-bundles?page=${page}`);
}

/** Get list of purchased eSIMs */
export async function getMyEsims(page = 1): Promise<{
  data: PurchasedEsim[];
  meta: PaginationMeta;
  status: boolean;
}> {
  return esimFetch(`/my-esims?page=${page}`);
}

/** Get network coverage information */
export async function getNetworkCoverages(): Promise<{
  data: EsimCountryWithCoverage[];
  status: boolean;
}> {
  return esimFetch("/network-coverages");
}

/** Returns true if the package has any 5G network coverage (for list enrichment). */
export async function getPackageHas5g(packageId: string): Promise<boolean> {
  try {
    const result = await getEsimPackageDetail(packageId);
    if (!result.status || !result.data) return false;
    const countries =
      result.data.countries ?? result.data.romaing_countries ?? [];
    return countries.some((c) =>
      (c.network_coverage ?? []).some((n) => n.five_G),
    );
  } catch {
    return false;
  }
}

/** Purchase a package asynchronously */
export async function purchaseEsimAsync(
  packageTypeId: string,
  imei?: string,
): Promise<{
  data: { order_id: number; sim_applied: boolean; sim_id: string };
  status: boolean;
}> {
  return esimFetch("/package/purchase/async", {
    body: JSON.stringify({
      package_type_id: packageTypeId,
      ...(imei && { imei }),
    }),
    method: "POST",
  });
}

/** Purchase a data+voice+SMS eSIM package */
export async function purchaseEsimDataVoiceSms(
  packageTypeId: string,
  imei?: string,
): Promise<{
  data: DataVoiceSmsPurchaseResult;
  message?: string;
  status: boolean;
}> {
  return esimFetch("/package/date_voice_sms/purchase", {
    body: JSON.stringify({
      package_type_id: packageTypeId,
      ...(imei && { imei }),
    }),
    method: "POST",
  });
}

/** Purchase a data-only eSIM package */
export async function purchaseEsimPackage(
  packageTypeId: string,
  imei?: string,
): Promise<{ data: EsimPurchaseResult; status: boolean }> {
  return esimFetch("/package/purchase", {
    body: JSON.stringify({
      package_type_id: packageTypeId,
      ...(imei && { imei }),
    }),
    method: "POST",
  });
}

async function esimFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let lastRes: Response | null = null;
  for (let attempt = 0; attempt <= ESIM_429_MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const useTimeout = !options.signal;
    const timeoutId = useTimeout
      ? setTimeout(() => controller.abort(), ESIM_REQUEST_TIMEOUT_MS)
      : undefined;
    const signal = options.signal ?? controller.signal;

    try {
      const token = await getAccessToken();
      const res = await fetch(`${ESIM_API_BASE}${path}`, {
        ...options,
        signal,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });
      if (timeoutId != null) clearTimeout(timeoutId);
      lastRes = res;

      if (res.status === 429 && attempt < ESIM_429_MAX_RETRIES) {
        const retryAfter = res.headers.get("Retry-After");
        const waitMs =
          retryAfter != null && /^\d+$/.test(retryAfter.trim())
            ? Number(retryAfter) * 1000
            : ESIM_429_BACKOFF_MS[attempt] ?? 10_000;
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      if (res.status === 401) {
        cachedToken = null;
        tokenExpiresAt = 0;
        const newToken = await getAccessToken();
        const retryRes = await fetch(`${ESIM_API_BASE}${path}`, {
          ...options,
          headers: {
            Authorization: `Bearer ${newToken}`,
            "Content-Type": "application/json",
            ...options.headers,
          },
        });
        if (!retryRes.ok) {
          throw new Error(`eSIM API request failed: ${retryRes.status}`);
        }
        return retryRes.json() as Promise<T>;
      }

      if (!res.ok) {
        throw new Error(`eSIM API request failed: ${res.status}`);
      }

      return res.json() as Promise<T>;
    } catch (err) {
      if (timeoutId != null) clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("eSIM API request timed out");
      }
      throw err;
    }
  }
  throw new Error(
    `eSIM API request failed: ${lastRes?.status ?? 429} (rate limited after ${ESIM_429_MAX_RETRIES + 1} attempts)`,
  );
}

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const { email, password } = getCredentials();
  const res = await fetch(`${ESIM_API_BASE}/login`, {
    body: JSON.stringify({ email, password }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  if (!res.ok) {
    throw new Error(`eSIM API login failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    status: boolean;
    token_type: string;
  };

  if (!data.status || !data.access_token) {
    throw new Error("eSIM API login failed: invalid credentials");
  }

  cachedToken = data.access_token;
  // Tokens typically last a long time; cache for 23 hours
  tokenExpiresAt = Date.now() + 23 * 60 * 60 * 1000;

  return cachedToken;
}

function getCredentials() {
  const email = process.env.ESIM_API_EMAIL;
  const password = process.env.ESIM_API_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Missing ESIM_API_EMAIL or ESIM_API_PASSWORD environment variables",
    );
  }
  return { email, password };
}
