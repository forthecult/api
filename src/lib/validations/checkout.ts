/**
 * Zod validation schemas for checkout, orders, and shipping APIs.
 */

import { z } from "zod";

// --- Order Item Schema ---
export const orderItemSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  productVariantId: z.string().optional(),
  name: z.string().optional(),
  priceCents: z.number().int().nonnegative().optional(),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
});

export type OrderItemInput = z.infer<typeof orderItemSchema>;

// --- Create Order Schema ---
export const createOrderSchema = z.object({
  reference: z.string().optional(),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email address")
    .transform((e) => e.trim().toLowerCase()),
  orderItems: z
    .array(orderItemSchema)
    .min(1, "At least one order item is required"),
  totalCents: z.number().int().nonnegative("Total must be non-negative"),
  shippingFeeCents: z.number().int().nonnegative().optional().default(0),
  taxCents: z.number().int().nonnegative().optional().default(0),
  userId: z.string().nullable().optional(),
  emailMarketingConsent: z.boolean().optional(),
  smsMarketingConsent: z.boolean().optional(),
  // Telegram Mini App — when order is placed from Telegram
  telegramUserId: z.string().optional(),
  telegramUsername: z.string().optional(),
  telegramFirstName: z.string().optional(),
  // Affiliate referral code (from cookie or manual entry)
  affiliateCode: z.string().trim().max(64).optional(),
  // Discount (coupon) code — applied at checkout; backend validates and records redemption
  couponCode: z.string().trim().max(64).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// Map full country names (uppercase) to ISO 2-letter codes for shipping API resilience.
// Used when client sends country name instead of code (e.g. address autocomplete, persisted form).
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  "UNITED STATES": "US",
  CANADA: "CA",
  AUSTRALIA: "AU",
  "NEW ZEALAND": "NZ",
  GERMANY: "DE",
  "UNITED KINGDOM": "GB",
  SPAIN: "ES",
  ITALY: "IT",
  FRANCE: "FR",
  NETHERLANDS: "NL",
  JAPAN: "JP",
  "HONG KONG": "HK",
  ISRAEL: "IL",
  "SOUTH KOREA": "KR",
  "EL SALVADOR": "SV",
  "UNITED ARAB EMIRATES": "AE",
  MEXICO: "MX",
  PHILIPPINES: "PH",
  INDIA: "IN",
  BRAZIL: "BR",
  PANAMA: "PA",
  ARGENTINA: "AR",
  "SAINT KITTS AND NEVIS": "KN",
  "COSTA RICA": "CR",
  BELIZE: "BZ",
  CHILE: "CL",
  SWITZERLAND: "CH",
  SINGAPORE: "SG",
  ICELAND: "IS",
  DENMARK: "DK",
  MONTENEGRO: "ME",
  PORTUGAL: "PT",
  POLAND: "PL",
  FINLAND: "FI",
  LITHUANIA: "LT",
  LUXEMBOURG: "LU",
  LIECHTENSTEIN: "LI",
  BELGIUM: "BE",
  SWEDEN: "SE",
  IRELAND: "IE",
  AUSTRIA: "AT",
  NORWAY: "NO",
  ESTONIA: "EE",
  "SAUDI ARABIA": "SA",
  QATAR: "QA",
  TAIWAN: "TW",
  FIJI: "FJ",
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
  orderValueCents: z.number().int().nonnegative().default(0),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        productVariantId: z.string().optional(),
        quantity: z.number().int().min(1),
      }),
    )
    .default([]),
  couponCode: z.string().trim().min(1).optional(),
});

export type ShippingCalculateInput = z.infer<typeof shippingCalculateSchema>;

// --- Address Schema (for shipping/billing) ---
export const addressSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  company: z.string().max(200).optional(),
  street: z.string().min(1, "Street address is required").max(500),
  apartment: z.string().max(100).optional(),
  city: z.string().min(1, "City is required").max(100),
  state: z.string().max(100).optional(),
  zip: z.string().min(1, "ZIP/Postal code is required").max(20),
  country: z.string().min(2, "Country is required").max(100),
  phone: z.string().max(30).optional(),
});

export type AddressInput = z.infer<typeof addressSchema>;

// --- Product ID Param Schema ---
export const productIdSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
});

// --- Pagination Schema ---
export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => Math.max(1, Number.parseInt(v || "1", 10))),
  limit: z
    .string()
    .optional()
    .transform((v) =>
      Math.min(100, Math.max(1, Number.parseInt(v || "20", 10))),
    ),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

// --- Helper: Safe parse with error response ---
export function validateOrThrow<T>(
  schema: z.ZodType<T>,
  data: unknown,
): T | { error: string; details?: z.ZodIssue[] } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      error: "Validation failed",
      details: result.error.issues,
    };
  }
  return result.data;
}

/**
 * Validate request body and return parsed data or error response.
 * Use in API routes: const data = validateBody(schema, await request.json());
 */
export function validateBody<T>(
  schema: z.ZodType<T>,
  body: unknown,
):
  | { success: true; data: T }
  | { success: false; error: string; issues: z.ZodIssue[] } {
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((i) => i.message).join(", "),
      issues: result.error.issues,
    };
  }
  return { success: true, data: result.data };
}
