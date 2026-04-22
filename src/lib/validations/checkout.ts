/**
 * Zod validation schemas for checkout, orders, and shipping APIs.
 */

import { z } from "zod";

// --- Order Item Schema ---
export const orderItemSchema = z.object({
  name: z.string().optional(),
  priceCents: z.number().int().nonnegative().optional(),
  productId: z.string().min(1, "Product ID is required"),
  productVariantId: z.string().optional(),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
});

export type OrderItemInput = z.infer<typeof orderItemSchema>;

// --- Create Order Schema ---
export const createOrderSchema = z.object({
  // Affiliate referral code (from cookie or manual entry)
  affiliateCode: z.string().trim().max(64).optional(),
  // Discount (coupon) code — applied at checkout; backend validates and records redemption
  couponCode: z.string().trim().max(64).optional(),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email address")
    .transform((e) => e.trim().toLowerCase()),
  emailMarketingConsent: z.boolean().optional(),
  // When wallet is not sent (e.g. user unlinked), tier 1–3 from tier history so tier discounts still apply.
  memberTier: z.number().int().min(1).max(3).optional(),
  orderItems: z
    .array(orderItemSchema)
    .min(1, "At least one order item is required"),
  reference: z.string().optional(),
  // Shipping address (optional). Only required for physical goods; digital-only orders often omit it.
  shipping: z
    .object({
      address1: z.string().max(500).optional(),
      address2: z.string().max(200).optional(),
      city: z.string().max(100).optional(),
      countryCode: z.string().max(10).optional(),
      name: z.string().max(200).optional(),
      phone: z.string().max(30).optional(),
      stateCode: z.string().max(20).optional(),
      zip: z.string().max(20).optional(),
    })
    .optional(),
  shippingFeeCents: z.number().int().nonnegative().optional().default(0),
  smsMarketingConsent: z.boolean().optional(),
  taxCents: z.number().int().nonnegative().optional().default(0),
  telegramFirstName: z.string().optional(),
  // Telegram Mini App — when order is placed from Telegram
  telegramUserId: z.string().optional(),
  telegramUsername: z.string().optional(),
  // Solana Pay: which token was selected (solana | usdc | whitewhale | crust | pump | troll | soluna | seeker | cult)
  token: z
    .enum([
      "solana",
      "usdc",
      "whitewhale",
      "crust",
      "pump",
      "troll",
      "soluna",
      "seeker",
      "cult",
    ])
    .optional(),
  // purely advisory: the client-displayed crypto amount (e.g. "0.05") for the
  // selected token. the server recomputes from a trusted price feed and persists
  // its own value as `crypto_amount`; this field is only used to flag UI drift.
  cryptoAmount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d+)?$/)
    .max(40)
    .optional(),
  totalCents: z.number().int().nonnegative("Total must be non-negative"),
  userId: z.string().nullable().optional(),
  // Staking wallet for CULT member tier discounts (stacked with coupon/affiliate).
  // When provided, wallet must be linked to the account or verified with walletMessage + walletSignature(Base58).
  wallet: z.string().trim().max(128).optional(),
  // Message to sign for tier verification (from GET /api/checkout/wallet-verify-message). Required when wallet is sent and not linked.
  walletMessage: z.string().trim().max(200).optional(),
  // Signature of walletMessage (base64 or base58). Required when wallet is sent and not linked.
  walletSignature: z.string().trim().max(500).optional(),
  walletSignatureBase58: z.string().trim().max(500).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// Map full country names (uppercase) to ISO 2-letter codes for shipping API resilience.
// Used when client sends country name instead of code (e.g. address autocomplete, persisted form).
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  ARGENTINA: "AR",
  AUSTRALIA: "AU",
  AUSTRIA: "AT",
  BELGIUM: "BE",
  BELIZE: "BZ",
  BRAZIL: "BR",
  CANADA: "CA",
  CHILE: "CL",
  "COSTA RICA": "CR",
  DENMARK: "DK",
  "EL SALVADOR": "SV",
  ESTONIA: "EE",
  FIJI: "FJ",
  FINLAND: "FI",
  FRANCE: "FR",
  GERMANY: "DE",
  "HONG KONG": "HK",
  ICELAND: "IS",
  INDIA: "IN",
  IRELAND: "IE",
  ISRAEL: "IL",
  ITALY: "IT",
  JAPAN: "JP",
  LIECHTENSTEIN: "LI",
  LITHUANIA: "LT",
  LUXEMBOURG: "LU",
  MEXICO: "MX",
  MONTENEGRO: "ME",
  NETHERLANDS: "NL",
  "NEW ZEALAND": "NZ",
  NORWAY: "NO",
  PANAMA: "PA",
  PHILIPPINES: "PH",
  POLAND: "PL",
  PORTUGAL: "PT",
  QATAR: "QA",
  "SAINT KITTS AND NEVIS": "KN",
  "SAUDI ARABIA": "SA",
  SINGAPORE: "SG",
  "SOUTH KOREA": "KR",
  SPAIN: "ES",
  SWEDEN: "SE",
  SWITZERLAND: "CH",
  TAIWAN: "TW",
  "UNITED ARAB EMIRATES": "AE",
  "UNITED KINGDOM": "GB",
  "UNITED STATES": "US",
};

/** Normalize country input to 2–3 letter ISO code. Safe to use for shipping/address. */
export function normalizeCountryCode(raw: string): string {
  const c = raw.trim().toUpperCase();
  if (c.length <= 3) return c.length >= 2 ? c : "";
  return COUNTRY_NAME_TO_CODE[c] ?? c.slice(0, 2);
}

// --- Shipping Calculate Schema ---
export const shippingCalculateSchema = z.object({
  countryCode: z
    .string()
    .min(1, "Country code is required")
    .max(100)
    .transform((c) => normalizeCountryCode(c))
    .refine((c) => c.length >= 2 && c.length <= 3, {
      message: "Country code must be 2–3 characters or a valid country name",
    }),
  couponCode: z.string().trim().min(1).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        productVariantId: z.string().optional(),
        quantity: z.number().int().min(1),
      }),
    )
    .default([]),
  orderValueCents: z.number().int().nonnegative().default(0),
});

export type ShippingCalculateInput = z.infer<typeof shippingCalculateSchema>;

export const productShippingEstimateSchema = z.object({
  address1: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  countryCode: z
    .string()
    .min(1, "Country code is required")
    .max(100)
    .transform((c) => normalizeCountryCode(c))
    .refine((c) => c.length >= 2 && c.length <= 3, {
      message: "Country code must be 2–3 characters or a valid country name",
    }),
  postalCode: z.string().max(30).optional(),
  productId: z.string().min(1, "Product ID is required"),
  productVariantId: z.string().min(1).optional(),
  quantity: z.number().int().min(1).max(99).default(1),
  stateCode: z.string().max(30).optional(),
});

export type ProductShippingEstimatePayload = z.infer<
  typeof productShippingEstimateSchema
>;

// --- Address Schema (for shipping/billing) ---
export const addressSchema = z.object({
  apartment: z.string().max(100).optional(),
  city: z.string().min(1, "City is required").max(100),
  company: z.string().max(200).optional(),
  country: z.string().min(2, "Country is required").max(100),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  phone: z.string().max(30).optional(),
  state: z.string().max(100).optional(),
  street: z.string().min(1, "Street address is required").max(500),
  zip: z.string().min(1, "ZIP/Postal code is required").max(20),
});

export type AddressInput = z.infer<typeof addressSchema>;

// --- Product ID Param Schema ---
export const productIdSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
});

// --- Pagination Schema ---
export const paginationSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) =>
      Math.min(100, Math.max(1, Number.parseInt(v || "20", 10))),
    ),
  page: z
    .string()
    .optional()
    .transform((v) => Math.max(1, Number.parseInt(v || "1", 10))),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

/**
 * Validate request body and return parsed data or error response.
 * Use in API routes: const data = validateBody(schema, await request.json());
 */
export function validateBody<T>(
  schema: z.ZodType<T>,
  body: unknown,
):
  | { data: T; success: true }
  | { error: string; issues: z.ZodIssue[]; success: false } {
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      error: result.error.issues.map((i) => i.message).join(", "),
      issues: result.error.issues,
      success: false,
    };
  }
  return { data: result.data, success: true };
}

// --- Helper: Safe parse with error response ---
export function validateOrThrow<T>(
  schema: z.ZodType<T>,
  data: unknown,
): T | { details?: z.ZodIssue[]; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      details: result.error.issues,
      error: "Validation failed",
    };
  }
  return result.data;
}
