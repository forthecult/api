/**
 * BTCPay Server integration (Bitpay-compatible API).
 * Used for Bitcoin, Dogecoin, and Monero payments.
 * See: https://docs.btcpayserver.org/CustomIntegration/
 *
 * Env (optional until you have a BTCPay server):
 *   BTCPAY_SERVER_URL  - e.g. https://btcpay.example.com
 *   BTCPAY_STORE_ID   - store id (Greenfield uses this; Bitpay-legacy may not)
 *   BTCPAY_API_KEY    - API token from Server side pairing / Access tokens
 */

const PAYMENT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export interface BtcpayConfig {
  apiKey: null | string;
  baseUrl: string;
  configured: boolean;
  storeId: null | string;
}

export type BtcpayCurrency = "BTC" | "DOGE" | "XMR";

/** Bitpay-compatible create invoice request (BTCPay accepts this). */
export interface CreateInvoiceParams {
  currency: string; // "USD"
  /** Optional: limit to specific crypto (BTC, DOGE, XMR). BTCPay may support via metadata. */
  currencyCode?: BtcpayCurrency;
  itemDesc: string;
  notificationURL: string;
  orderId: string;
  price: number; // USD amount (e.g. 29.99)
  redirectURL: string;
}

export interface CreateInvoiceResult {
  id: string;
  status: string;
  url: string;
}

/** Invoice status from BTCPay/Bitpay. "Settled" means paid and confirmed. */
export type InvoiceStatus =
  | "complete"
  | "confirmed"
  | "expired"
  | "invalid"
  | "new"
  | "paid"
  | "settled";

/** Build redirect URL back to our success page with orderId. */
export function buildSuccessRedirectUrl(
  origin: string,
  orderId: string,
): string {
  return `${origin.replace(/\/$/, "")}/checkout/success?orderId=${encodeURIComponent(orderId)}`;
}

/** Build webhook URL for BTCPay to call on invoice events. */
export function buildWebhookUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/webhooks/btcpay`;
}

/**
 * Create an invoice on BTCPay Server (Bitpay-compatible POST /invoices).
 * Returns null if BTCPay is not configured.
 */
export async function createBtcpayInvoice(
  params: CreateInvoiceParams,
): Promise<CreateInvoiceResult | null> {
  const { apiKey, baseUrl, configured } = getBtcpayConfig();
  if (!configured || !baseUrl || !apiKey) return null;

  const body = {
    currency: params.currency,
    itemDesc: params.itemDesc,
    notificationURL: params.notificationURL,
    orderId: params.orderId,
    price: params.price,
    redirectURL: params.redirectURL,
  };

  // Bitpay legacy API: POST /invoices (relative to server root)
  const url = `${baseUrl.replace(/\/$/, "")}/invoices`;
  const res = await fetch(url, {
    body: JSON.stringify(body),
    headers: {
      // BTCPay/ Bitpay: token as Basic auth (token:empty) or Authorization header per server
      Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`BTCPay create invoice failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    data?: { id?: string; status?: string; url?: string };
    id?: string;
    status?: string;
    url?: string;
  };
  const invoice = data.data ?? data;
  const id = invoice.id ?? (data as { id?: string }).id;
  const invoiceUrl = invoice.url ?? (data as { url?: string }).url;
  const status =
    invoice.status ?? (data as { status?: string }).status ?? "new";
  if (!id) throw new Error("BTCPay response missing invoice id");
  return {
    id: String(id),
    status: String(status),
    url: invoiceUrl
      ? String(invoiceUrl)
      : `${baseUrl.replace(/\/$/, "")}/i/${id}`,
  };
}

export function getBtcpayConfig(): BtcpayConfig {
  const baseUrl = process.env.BTCPAY_SERVER_URL?.trim();
  const storeId = process.env.BTCPAY_STORE_ID?.trim() ?? null;
  const apiKey = process.env.BTCPAY_API_KEY?.trim() ?? null;
  const configured = Boolean(baseUrl && apiKey);
  return {
    apiKey,
    baseUrl: baseUrl ?? "",
    configured,
    storeId,
  };
}

/**
 * Fetch invoice status from BTCPay Server.
 * Returns null if not configured or invoice not found.
 */
export async function getBtcpayInvoiceStatus(
  invoiceId: string,
): Promise<InvoiceStatus | null> {
  const { apiKey, baseUrl, configured } = getBtcpayConfig();
  if (!configured || !baseUrl || !apiKey) return null;

  const url = `${baseUrl.replace(/\/$/, "")}/invoices/${encodeURIComponent(invoiceId)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
    },
    method: "GET",
  });

  if (!res.ok) {
    if (res.status === 404) return null;
    const text = await res.text();
    throw new Error(`BTCPay get invoice failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    data?: { status?: string };
    status?: string;
  };
  const invoice = data.data ?? data;
  const status = (
    invoice.status ??
    (data as { status?: string }).status ??
    "new"
  ).toLowerCase();
  return status as InvoiceStatus;
}

/** True when payment is considered complete (no further confirmation needed). */
export function isInvoiceSettled(status: InvoiceStatus | null): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return (
    s === "paid" || s === "confirmed" || s === "complete" || s === "settled"
  );
}
