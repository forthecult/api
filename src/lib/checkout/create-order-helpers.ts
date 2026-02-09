/**
 * Shared logic for checkout create-order API routes.
 * Each payment-method route uses these helpers to avoid duplicating
 * product validation, order creation, and post-order bookkeeping.
 */

import { createId } from "@paralleldrive/cuid2";
import { eq, inArray } from "drizzle-orm";

import { db } from "~/db";
import {
  affiliateTable,
  couponRedemptionTable,
  orderItemsTable,
  ordersTable,
  productVariantsTable,
  productsTable,
} from "~/db/schema";
import { userTable } from "~/db/schema/users/tables";
import { resolveAffiliateForOrder } from "~/lib/affiliate";
import { resolveCouponForCheckout } from "~/lib/coupon";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A validated order item with server-side prices from the DB. */
export interface ValidatedOrderItem {
  productId: string;
  productVariantId?: string;
  name: string;
  priceCents: number;
  quantity: number;
}

/** Raw item from the client request (after Zod parsing). */
export interface RawOrderItem {
  productId: string;
  productVariantId?: string;
  name?: string;
  priceCents?: number;
  quantity: number;
}

/** Result returned by {@link validateAndFetchProducts}. */
export interface ProductValidationResult {
  /** Validated order items with server-side prices. */
  validatedItems: ValidatedOrderItem[];
  /** Product lookup map keyed by product ID. */
  productMap: Map<string, { id: string; name: string; priceCents: number }>;
  /** Variant lookup map keyed by variant ID. */
  variantMap: Map<string, { id: string; productId: string; priceCents: number }>;
  /** De-duplicated product IDs present in the validated items. */
  productIds: string[];
  /** Server-computed subtotal in cents (sum of priceCents * quantity). */
  subtotalCents: number;
}

/** Unwrapped affiliate helper result type. */
export type AffiliateResult = NonNullable<
  Awaited<ReturnType<typeof resolveAffiliateForOrder>>
>;

/** Unwrapped coupon helper result type. */
export type CouponResult = NonNullable<
  Awaited<ReturnType<typeof resolveCouponForCheckout>>
>;

/** Result returned by {@link resolveDiscounts}. */
export interface DiscountResult {
  affiliateResult: AffiliateResult | null;
  couponResult: CouponResult | null;
  /** Expected total after applying the best discount (before tax). */
  expectedTotal: number;
}

/** Result returned by {@link validateTotal}. */
export interface TotalValidationResult {
  valid: boolean;
  expectedTotal: number;
}

/** Fields common to every order insert (payment-method-specific fields are spread on top). */
export interface BaseOrderFields {
  orderId: string;
  email: string;
  paymentMethod: string;
  totalCents: number;
  shippingFeeCents: number;
  taxCents: number;
  userId: string | null;
  /** Optional customer note / reference. */
  reference?: string | null;
  telegramUserId?: string | null;
  telegramUsername?: string | null;
  telegramFirstName?: string | null;
  affiliateResult?: AffiliateResult | null;
}

/** Input for {@link postOrderBookkeeping}. */
export interface BookkeepingInput {
  orderId: string;
  userId: string | null;
  affiliateResult: AffiliateResult | null;
  couponResult: CouponResult | null;
  emailMarketingConsent?: boolean;
  smsMarketingConsent?: boolean;
}

// ---------------------------------------------------------------------------
// 1. validateAndFetchProducts
// ---------------------------------------------------------------------------

/**
 * Fetch products and variants from the DB, validate each raw item,
 * and compute the server-side subtotal.
 *
 * Returns `null` when no valid items remain (caller should return 400).
 */
export async function validateAndFetchProducts(
  rawItems: RawOrderItem[],
): Promise<ProductValidationResult | null> {
  // Unique product IDs
  const productIds = [
    ...new Set(rawItems.map((i) => i?.productId).filter(Boolean)),
  ] as string[];

  const products =
    productIds.length > 0
      ? await db
          .select({
            id: productsTable.id,
            name: productsTable.name,
            priceCents: productsTable.priceCents,
          })
          .from(productsTable)
          .where(inArray(productsTable.id, productIds))
      : [];
  const productMap = new Map(products.map((p) => [p.id, p]));

  // Variant IDs
  const variantIds = rawItems
    .map((i) => i?.productVariantId)
    .filter((v): v is string => typeof v === "string" && v.length > 0);

  const variants =
    variantIds.length > 0
      ? await db
          .select({
            id: productVariantsTable.id,
            productId: productVariantsTable.productId,
            priceCents: productVariantsTable.priceCents,
          })
          .from(productVariantsTable)
          .where(inArray(productVariantsTable.id, variantIds))
      : [];
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  // Validate each item and build the enriched list
  const validatedItems: ValidatedOrderItem[] = [];
  for (const item of rawItems) {
    if (
      typeof item?.productId !== "string" ||
      typeof item?.quantity !== "number" ||
      item.quantity < 1
    )
      continue;

    const product = productMap.get(item.productId);
    if (!product) continue;

    if (item.productVariantId) {
      const variant = variantMap.get(item.productVariantId);
      if (!variant || variant.productId !== item.productId) continue;
      validatedItems.push({
        productId: product.id,
        productVariantId: variant.id,
        name: product.name,
        priceCents: variant.priceCents,
        quantity: item.quantity,
      });
    } else {
      validatedItems.push({
        productId: product.id,
        name: product.name,
        priceCents: product.priceCents,
        quantity: item.quantity,
      });
    }
  }

  if (validatedItems.length === 0) return null;

  const subtotalCents = validatedItems.reduce(
    (sum, i) => sum + i.priceCents * i.quantity,
    0,
  );

  return { validatedItems, productMap, variantMap, productIds, subtotalCents };
}

// ---------------------------------------------------------------------------
// 2. resolveDiscounts
// ---------------------------------------------------------------------------

/**
 * Resolve affiliate and coupon discounts for the order.
 *
 * Returns the affiliate/coupon result objects (for later bookkeeping) and
 * the `expectedTotal` that should be compared against the client total.
 */
export async function resolveDiscounts(params: {
  affiliateCode?: string | null;
  couponCode?: string | null;
  subtotalCents: number;
  shippingFeeCents: number;
  userId?: string | null;
  productIds: string[];
}): Promise<DiscountResult> {
  const {
    affiliateCode,
    couponCode,
    subtotalCents,
    shippingFeeCents,
    userId,
    productIds,
  } = params;

  const affiliateResult = await resolveAffiliateForOrder(
    affiliateCode,
    subtotalCents,
    shippingFeeCents,
  );

  const couponResult = couponCode
    ? await resolveCouponForCheckout(couponCode, subtotalCents, shippingFeeCents, {
        userId: userId ?? undefined,
        productIds,
      })
    : null;

  const baseTotal = subtotalCents + shippingFeeCents;
  const expectedTotal =
    couponResult?.totalAfterDiscountCents ??
    affiliateResult?.totalAfterDiscountCents ??
    baseTotal;

  return { affiliateResult, couponResult, expectedTotal };
}

// ---------------------------------------------------------------------------
// 3. validateTotal
// ---------------------------------------------------------------------------

/**
 * Compare the client-submitted total against the server-computed expected
 * total. Returns `{ valid, expectedTotal }`.
 *
 * @param toleranceCents  Maximum acceptable difference (default 100 = $1).
 * @param extraCents      Extra cents to add to expectedTotal before comparing
 *                        (e.g. taxCents for routes that include tax).
 */
export function validateTotal(params: {
  clientTotalCents: number;
  expectedTotal: number;
  toleranceCents?: number;
  extraCents?: number;
}): TotalValidationResult {
  const {
    clientTotalCents,
    expectedTotal: base,
    toleranceCents = 100,
    extraCents = 0,
  } = params;
  const expectedTotal = base + extraCents;
  const valid = Math.abs(clientTotalCents - expectedTotal) <= toleranceCents;
  return { valid, expectedTotal };
}

// ---------------------------------------------------------------------------
// 4. insertOrder
// ---------------------------------------------------------------------------

/**
 * Insert a new order row into `ordersTable`.
 *
 * Accepts common fields via {@link BaseOrderFields} and any payment-specific
 * overrides via `extraFields` (spread last so they win).
 *
 * Returns the generated `orderId`.
 */
export async function insertOrder(
  base: BaseOrderFields,
  extraFields: Record<string, unknown> = {},
): Promise<string> {
  const now = new Date();
  await db.insert(ordersTable).values({
    id: base.orderId,
    createdAt: now,
    email: base.email.trim(),
    fulfillmentStatus: "unfulfilled",
    paymentMethod: base.paymentMethod,
    paymentStatus: "pending",
    shippingFeeCents: base.shippingFeeCents,
    taxCents: base.taxCents,
    status: "pending",
    totalCents: base.totalCents,
    updatedAt: now,
    userId: base.userId,
    ...(base.telegramUserId
      ? { telegramUserId: String(base.telegramUserId) }
      : {}),
    ...(base.telegramUsername ? { telegramUsername: base.telegramUsername } : {}),
    ...(base.telegramFirstName
      ? { telegramFirstName: base.telegramFirstName }
      : {}),
    ...(base.affiliateResult && {
      affiliateId: base.affiliateResult.affiliate.affiliateId,
      affiliateCode: base.affiliateResult.affiliate.affiliateCode,
      affiliateCommissionCents:
        base.affiliateResult.affiliate.commissionCents,
      affiliateDiscountCents: base.affiliateResult.affiliate.discountCents,
    }),
    ...extraFields,
  });

  return base.orderId;
}

// ---------------------------------------------------------------------------
// 5. insertOrderItems
// ---------------------------------------------------------------------------

/**
 * Bulk-insert validated order items into `orderItemsTable`.
 */
export async function insertOrderItems(
  items: ValidatedOrderItem[],
  orderId: string,
): Promise<void> {
  if (items.length === 0) return;

  await db.insert(orderItemsTable).values(
    items.map((item) => ({
      id: createId(),
      name: item.name,
      orderId,
      priceCents: item.priceCents,
      productId: item.productId,
      productVariantId: item.productVariantId ?? null,
      quantity: item.quantity,
    })),
  );
}

// ---------------------------------------------------------------------------
// 6. postOrderBookkeeping
// ---------------------------------------------------------------------------

/**
 * Run all post-insert side-effects that are shared across every payment method:
 *   - Update user marketing-consent flags.
 *   - Increment affiliate `totalEarnedCents`.
 *   - Record coupon redemption.
 */
export async function postOrderBookkeeping(
  input: BookkeepingInput,
): Promise<void> {
  const {
    orderId,
    userId,
    affiliateResult,
    couponResult,
    emailMarketingConsent,
    smsMarketingConsent,
  } = input;
  const now = new Date();

  // Marketing consent -------------------------------------------------------
  if (
    userId &&
    (emailMarketingConsent === true || smsMarketingConsent === true)
  ) {
    await db
      .update(userTable)
      .set({
        updatedAt: now,
        ...(emailMarketingConsent === true && { receiveMarketing: true }),
        ...(smsMarketingConsent === true && { receiveSmsMarketing: true }),
      })
      .where(eq(userTable.id, userId));
  }

  // Affiliate earnings ------------------------------------------------------
  if (affiliateResult) {
    const [row] = await db
      .select({ totalEarnedCents: affiliateTable.totalEarnedCents })
      .from(affiliateTable)
      .where(eq(affiliateTable.id, affiliateResult.affiliate.affiliateId))
      .limit(1);
    const current = row?.totalEarnedCents ?? 0;
    await db
      .update(affiliateTable)
      .set({
        updatedAt: now,
        totalEarnedCents: current + affiliateResult.affiliate.commissionCents,
      })
      .where(eq(affiliateTable.id, affiliateResult.affiliate.affiliateId));
  }

  // Coupon redemption -------------------------------------------------------
  if (couponResult) {
    await db.insert(couponRedemptionTable).values({
      id: createId(),
      couponId: couponResult.couponId,
      orderId,
      userId,
      createdAt: now,
    });
  }
}

// ---------------------------------------------------------------------------
// 7. handleCreateOrderError (consistent error response)
// ---------------------------------------------------------------------------

/**
 * Build a JSON error body from a caught exception, consistent with the
 * existing pattern in every create-order route.
 */
export function buildOrderErrorMessage(err: unknown): string {
  if (
    err instanceof Error &&
    (err.message?.includes("relation") ||
      err.message?.includes("does not exist"))
  ) {
    return "Database tables missing. Run: bun run db:push";
  }
  return "Failed to create order";
}
