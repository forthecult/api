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

export type BtcpayCurrency = "BTC" | "DOGE" | "XMR";

export interface BtcpayConfig {
  baseUrl: string;
  storeId: string | null;
  apiKey: string | null;
  configured: boolean;
}

export function getBtcpayConfig(): BtcpayConfig {
  const baseUrl = process.env.BTCPAY_SERVER_URL?.trim();
  const storeId = process.env.BTCPAY_STORE_ID?.trim() ?? null;
  const apiKey = process.env.BTCPAY_API_KEY?.trim() ?? null;
  const configured = Boolean(baseUrl && apiKey);
  return {
    baseUrl: baseUrl ?? "",
    storeId,
    apiKey,
    configured,
  };
}

/** Bitpay-compatible create invoice request (BTCPay accepts this). */
export interface CreateInvoiceParams {
  price: number; // USD amount (e.g. 29.99)
  currency: string; // "USD"
  orderId: string;
  itemDesc: string;
  notificationURL: string;
  redirectURL: string;
  /** Optional: limit to specific crypto (BTC, DOGE, XMR). BTCPay may support via metadata. */
  currencyCode?: BtcpayCurrency;
}

export interface CreateInvoiceResult {
  id: string;
  url: string;
  status: string;
}

/**
 * Create an invoice on BTCPay Server (Bitpay-compatible POST /invoices).
 * Returns null if BTCPay is not configured.
 */
export async function createBtcpayInvoice(
  params: CreateInvoiceParams,
): Promise<CreateInvoiceResult | null> {
  const { baseUrl, apiKey, configured } = getBtcpayConfig();
  if (!configured || !baseUrl || !apiKey) return null;

  const body = {
    price: params.price,
    currency: params.currency,
    orderId: params.orderId,
    itemDesc: params.itemDesc,
    notificationURL: params.notificationURL,
    redirectURL: params.redirectURL,
  };

  // Bitpay legacy API: POST /invoices (relative to server root)
  const url = `${baseUrl.replace(/\/$/, "")}/invoices`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // BTCPay/ Bitpay: token as Basic auth (token:empty) or Authorization header per server
      Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`BTCPay create invoice failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    data?: { id?: string; url?: string; status?: string };
    id?: string;
    url?: string;
    status?: string;
  };
  const invoice = data.data ?? data;
  const id = invoice.id ?? (data as { id?: string }).id;
  const invoiceUrl = invoice.url ?? (data as { url?: string }).url;
  const status =
    invoice.status ?? (data as { status?: string }).status ?? "new";
  if (!id) throw new Error("BTCPay response missing invoice id");
  return {
    id: String(id),
    url: invoiceUrl
      ? String(invoiceUrl)
      : `${baseUrl.replace(/\/$/, "")}/i/${id}`,
    status: String(status),
  };
}

/** Invoice status from BTCPay/Bitpay. "Settled" means paid and confirmed. */
export type InvoiceStatus =
  | "new"
  | "paid"
  | "confirmed"
  | "complete"
  | "expired"
  | "invalid"
  | "settled";

/**
 * Fetch invoice status from BTCPay Server.
 * Returns null if not configured or invoice not found.
 */
export async function getBtcpayInvoiceStatus(
  invoiceId: string,
): Promise<InvoiceStatus | null> {
  const { baseUrl, apiKey, configured } = getBtcpayConfig();
  if (!configured || !baseUrl || !apiKey) return null;

  const url = `${baseUrl.replace(/\/$/, "")}/invoices/${encodeURIComponent(invoiceId)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
    },
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
