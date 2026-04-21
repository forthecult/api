import "server-only";

/**
 * PayPal Subscriptions API (billing plans + subscriptions).
 * Uses PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET; sandbox vs live via PAYPAL_MODE=sandbox|live.
 */

function getApiBase(): string {
  const fromEnv = process.env.PAYPAL_API_BASE?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const mode = process.env.PAYPAL_MODE ?? "live";
  return mode === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
}

let cachedToken: null | { expiresAt: number; token: string } = null;

export interface CreatePayPalSubscriptionParams {
  cancelUrl: string;
  customId: string;
  email: string;
  planId: string;
  returnUrl: string;
}

export interface CreatePayPalSubscriptionResult {
  /** Redirect the buyer here to approve the billing agreement. */
  approvalUrl: string;
  subscriptionId: string;
}

/** Cancels an active PayPal billing subscription (stops future billing). */
export async function cancelPayPalSubscription(
  subscriptionId: string,
  reason = "Requested by merchant",
): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(
    `${getApiBase()}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
    {
      body: JSON.stringify({ reason }),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`PayPal cancel subscription failed: ${res.status} ${t}`);
  }
}

/**
 * Creates a subscription in APPROVAL_PENDING state; user must visit approvalUrl, then PayPal redirects to returnUrl.
 */
export async function createPayPalSubscription(
  params: CreatePayPalSubscriptionParams,
): Promise<CreatePayPalSubscriptionResult> {
  const token = await getAccessToken();
  const res = await fetch(`${getApiBase()}/v1/billing/subscriptions`, {
    body: JSON.stringify({
      application_context: {
        brand_name: "For the Cult",
        cancel_url: params.cancelUrl,
        locale: "en-US",
        return_url: params.returnUrl,
        shipping_preference: "NO_SHIPPING",
        user_action: "SUBSCRIBE_NOW",
      },
      custom_id: params.customId,
      plan_id: params.planId,
      subscriber: { email_address: params.email },
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    method: "POST",
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`PayPal create subscription failed: ${res.status} ${t}`);
  }
  const data = (await res.json()) as {
    id: string;
    links?: { href: string; rel: string }[];
  };
  const approval = data.links?.find((l) => l.rel === "approve");
  if (!approval?.href) {
    throw new Error("PayPal subscription response missing approve link");
  }
  return { approvalUrl: approval.href, subscriptionId: data.id };
}

export async function getPayPalSubscription(subscriptionId: string): Promise<{
  billing_info?: { next_billing_time?: string };
  custom_id?: string;
  plan_id?: string;
  status?: string;
}> {
  const token = await getAccessToken();
  const res = await fetch(
    `${getApiBase()}/v1/billing/subscriptions/${subscriptionId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`PayPal get subscription failed: ${res.status} ${t}`);
  }
  return (await res.json()) as {
    billing_info?: { next_billing_time?: string };
    custom_id?: string;
    plan_id?: string;
    status?: string;
  };
}

export async function verifyPayPalWebhookSignature(
  headers: Headers,
  webhookEvent: unknown,
): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim();
  if (!webhookId) return false;

  const authAlgo = headers.get("paypal-auth-algo");
  const certUrl = headers.get("paypal-cert-url");
  const transmissionId = headers.get("paypal-transmission-id");
  const transmissionSig = headers.get("paypal-transmission-sig");
  const transmissionTime = headers.get("paypal-transmission-time");

  if (
    !authAlgo ||
    !certUrl ||
    !transmissionId ||
    !transmissionSig ||
    !transmissionTime
  ) {
    return false;
  }

  const token = await getAccessToken();
  const res = await fetch(
    `${getApiBase()}/v1/notifications/verify-webhook-signature`,
    {
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_event: webhookEvent,
        webhook_id: webhookId,
      }),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );
  if (!res.ok) return false;
  const data = (await res.json()) as { verification_status?: string };
  return data.verification_status === "SUCCESS";
}

async function getAccessToken(): Promise<string> {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET not set");
  }
  const now = Date.now() / 1000;
  if (cachedToken && cachedToken.expiresAt > now + 60) {
    return cachedToken.token;
  }
  const auth = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetch(`${getApiBase()}/v1/oauth2/token`, {
    body: "grant_type=client_credentials",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`PayPal token failed: ${res.status} ${t}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  cachedToken = {
    expiresAt: now + data.expires_in,
    token: data.access_token,
  };
  return data.access_token;
}
