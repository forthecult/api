/**
 * eSIM Card Reseller API Client
 *
 * Server-side client for the eSIM Card reseller API (https://portal.esimcard.com).
 * Handles authentication, token management, and all eSIM operations.
 */

const ESIM_API_BASE = "https://portal.esimcard.com/api/developer/reseller";

// ---------- Types ----------

export type EsimCountry = {
  id: number;
  name: string;
  code?: string;
  image_url: string;
  packages?: EsimPackage[];
};

export type EsimPackage = {
  id: string;
  name: string;
  price: string;
  data_quantity: number;
  data_unit: string;
  voice_quantity?: number;
  voice_unit?: string;
  sms_quantity?: number;
  package_validity: number;
  package_validity_unit: string;
  package_type?: string;
  unlimited?: boolean;
};

export type EsimPackageDetail = EsimPackage & {
  romaing_countries?: EsimCountryWithCoverage[];
  countries?: EsimCountryWithCoverage[];
};

export type NetworkCoverage = {
  network_name: string;
  network_code: string;
  two_g: boolean;
  three_g: boolean;
  four_G: boolean;
  five_G: boolean;
};

export type EsimCountryWithCoverage = {
  id: number;
  name: string;
  image_url: string;
  network_coverage: NetworkCoverage[];
};

export type EsimContinent = {
  id: number;
  name: string;
  code: string;
  image_url: string;
};

export type PaginationMeta = {
  total: number;
  perPage: number;
  currentPage: number;
  lastPage: number;
};

export type PricingCountry = {
  name: string;
  code: string;
  packages: EsimPackage[];
};

export type EsimPurchaseResult = {
  sim_applied: boolean;
  sim?: {
    id: string;
    iccid: string;
    status: string;
  };
  message?: string;
  sim_id?: string;
  order_id?: number;
};

export type DataVoiceSmsPurchaseResult = {
  id: string;
  package: string;
  activated: boolean;
  status: string;
};

export type PurchasedEsim = {
  id: string;
  iccid: string;
  created_at: string;
  last_bundle: string;
  status: string;
  total_bundles: number;
  universal_link?: string;
};

export type PurchasedEsimDetail = {
  sim: {
    id: string;
    iccid: string;
    status: string;
    total_bundles: number;
  };
  in_use_packages: Array<{
    id: string;
    package: string;
    status: string;
  }>;
};

export type PurchasedBundle = {
  id: string;
  package: string;
  initial_data_quantity: number;
  initial_data_unit: string;
  rem_data_quantity: number;
  rem_data_unit: string;
  date_created: string;
  date_activated: string;
  date_expiry: string;
  activated: boolean;
  status: string;
};

export type EsimUsage = {
  initial_data_quantity: number | string;
  initial_data_unit: string;
  rem_data_quantity: number | string;
  rem_data_unit: string;
};

// ---------- Token Cache ----------

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

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

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const { email, password } = getCredentials();
  const res = await fetch(`${ESIM_API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw new Error(`eSIM API login failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    status: boolean;
    access_token: string;
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

async function esimFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${ESIM_API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (res.status === 401) {
    // Token expired — clear cache and retry once
    cachedToken = null;
    tokenExpiresAt = 0;
    const newToken = await getAccessToken();
    const retryRes = await fetch(`${ESIM_API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${newToken}`,
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
}

// ---------- API Methods ----------

/** Get all packages & pricing grouped by country */
export async function getEsimPricing(): Promise<{
  status: boolean;
  data: { countries: PricingCountry[] };
}> {
  return esimFetch("/pricing");
}

/** Get paginated list of all packages */
export async function getEsimPackages(
  packageType: "DATA-ONLY" | "DATA-VOICE-SMS" = "DATA-ONLY",
  page = 1,
): Promise<{
  status: boolean;
  meta: PaginationMeta;
  data: EsimPackage[];
}> {
  return esimFetch(
    `/packages?package_type=${packageType}&page=${page}`,
  );
}

/** Get detailed info for a specific package */
export async function getEsimPackageDetail(
  packageId: string,
): Promise<{ status: boolean; data: EsimPackageDetail }> {
  return esimFetch(`/package/detail/${packageId}`);
}

/** Get list of countries with eSIM coverage */
export async function getEsimCountries(): Promise<{
  status: boolean;
  data: EsimCountry[];
}> {
  return esimFetch("/packages/country");
}

/** Get packages available for a specific country */
export async function getEsimCountryPackages(
  countryId: number,
  packageType?: "DATA-ONLY" | "DATA-VOICE-SMS",
  page = 1,
): Promise<{
  status: boolean;
  meta: PaginationMeta;
  data: EsimPackage[];
}> {
  const params = new URLSearchParams({ page: String(page) });
  if (packageType) params.set("package_type", packageType);
  return esimFetch(`/packages/country/${countryId}?${params}`);
}

/** Get list of continents */
export async function getEsimContinents(): Promise<{
  status: boolean;
  data: EsimContinent[];
}> {
  return esimFetch("/packages/continent");
}

/** Get packages for a specific continent */
export async function getEsimContinentPackages(
  continentId: number,
  packageType?: "DATA-ONLY" | "DATA-VOICE-SMS",
  page = 1,
): Promise<{
  status: boolean;
  meta: PaginationMeta;
  data: EsimPackage[];
}> {
  const params = new URLSearchParams({ page: String(page) });
  if (packageType) params.set("package_type", packageType);
  return esimFetch(`/packages/continent/${continentId}?${params}`);
}

/** Get global packages */
export async function getEsimGlobalPackages(
  packageType: "DATA-ONLY" | "DATA-VOICE-SMS" = "DATA-ONLY",
): Promise<{
  status: boolean;
  meta: PaginationMeta;
  data: EsimPackage[];
}> {
  return esimFetch(`/packages/global/${packageType}`);
}

/** Check if an eSIM can be topped up */
export async function checkEsimTopup(
  imei: string,
): Promise<{ status: boolean; data: { topup_available: boolean } }> {
  return esimFetch("/can-topup-esim", {
    method: "POST",
    body: JSON.stringify({ imei }),
  });
}

/** Purchase a data-only eSIM package */
export async function purchaseEsimPackage(
  packageTypeId: string,
  imei?: string,
): Promise<{ status: boolean; data: EsimPurchaseResult }> {
  return esimFetch("/package/purchase", {
    method: "POST",
    body: JSON.stringify({
      package_type_id: packageTypeId,
      ...(imei && { imei }),
    }),
  });
}

/** Purchase a data+voice+SMS eSIM package */
export async function purchaseEsimDataVoiceSms(
  packageTypeId: string,
  imei?: string,
): Promise<{
  status: boolean;
  data: DataVoiceSmsPurchaseResult;
  message?: string;
}> {
  return esimFetch("/package/date_voice_sms/purchase", {
    method: "POST",
    body: JSON.stringify({
      package_type_id: packageTypeId,
      ...(imei && { imei }),
    }),
  });
}

/** Purchase a package asynchronously */
export async function purchaseEsimAsync(
  packageTypeId: string,
  imei?: string,
): Promise<{
  status: boolean;
  data: { sim_applied: boolean; sim_id: string; order_id: number };
}> {
  return esimFetch("/package/purchase/async", {
    method: "POST",
    body: JSON.stringify({
      package_type_id: packageTypeId,
      ...(imei && { imei }),
    }),
  });
}

/** Get list of purchased eSIMs */
export async function getMyEsims(
  page = 1,
): Promise<{
  status: boolean;
  meta: PaginationMeta;
  data: PurchasedEsim[];
}> {
  return esimFetch(`/my-esims?page=${page}`);
}

/** Get details for a specific purchased eSIM */
export async function getEsimDetail(
  esimId: string,
): Promise<{ status: boolean; data: PurchasedEsimDetail }> {
  return esimFetch(`/my-esims/${esimId}`);
}

/** Get usage for a specific eSIM */
export async function getEsimUsage(
  esimId: string,
): Promise<{ status: boolean; data: EsimUsage }> {
  return esimFetch(`/my-sim/${esimId}/usage`);
}

/** Get purchased bundles */
export async function getMyBundles(
  page = 1,
): Promise<{
  status: boolean;
  meta: PaginationMeta;
  data: PurchasedBundle[];
}> {
  return esimFetch(`/my-bundles?page=${page}`);
}

/** Get bundle details */
export async function getBundleDetail(
  bundleId: string,
): Promise<{ status: boolean; data: PurchasedBundle[] }> {
  return esimFetch(`/bundles/${bundleId}`);
}

/** Get order details */
export async function getEsimOrder(
  orderId: number,
): Promise<{ status: boolean; data: unknown[] }> {
  return esimFetch(`/order/${orderId}`);
}

/** Get reseller account balance */
export async function getEsimBalance(): Promise<{
  status: boolean;
  balance: number;
}> {
  return esimFetch("/balance");
}

/** Get network coverage information */
export async function getNetworkCoverages(): Promise<{
  status: boolean;
  data: EsimCountryWithCoverage[];
}> {
  return esimFetch("/network-coverages");
}
