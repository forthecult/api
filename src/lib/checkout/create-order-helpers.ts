/**
 * Shared logic for checkout create-order API routes.
 * Each payment-method route uses these helpers to avoid duplicating
 * product validation, order creation, and post-order bookkeeping.
 */

import { createId } from "@paralleldrive/cuid2";
import { eq, inArray, sql } from "drizzle-orm";

import { db } from "~/db";
import {
  affiliateTable,
  couponRedemptionTable,
  couponsTable,
  esimOrdersTable,
  orderItemsTable,
  ordersTable,
  productVariantsTable,
  productsTable,
} from "~/db/schema";
import { userTable } from "~/db/schema/users/tables";
import { resolveAffiliateForOrder } from "~/lib/affiliate";
import { resolveCouponForCheckout } from "~/lib/coupon";
import { getEsimPackageDetail } from "~/lib/esim-api";

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
  /** Set for eSIM items (productId starts with esim_); package ID from reseller API. */
  esimPackageId?: string;
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
 *
 * TODO: [INVENTORY] Add stock validation when inventory tracking is implemented.
 * Currently relies on POD providers (Printful/Printify) for stock management.
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

    // eSIM items: pass through without DB lookup (client sends priceCents and name)
    if (item.productId.startsWith("esim_")) {
      const name = typeof item.name === "string" && item.name.trim() ? item.name.trim() : null;
      const priceCents =
        typeof item.priceCents === "number" && item.priceCents >= 0
          ? item.priceCents
          : null;
      if (!name || priceCents === null) continue;
      const esimPackageId = item.productId.replace(/^esim_/, "");
      if (!esimPackageId) continue;
      validatedItems.push({
        productId: item.productId,
        name,
        priceCents,
        quantity: item.quantity,
        esimPackageId,
      });
      continue;
    }

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

  // Pick the best discount: coupon vs affiliate. If coupon gives a better
  // (lower) total, null out the affiliate so commission is not credited.
  let effectiveAffiliate = affiliateResult;
  let expectedTotal: number;

  if (couponResult && affiliateResult) {
    // Both present – pick the one that gives the lower total
    if (couponResult.totalAfterDiscountCents <= affiliateResult.totalAfterDiscountCents) {
      expectedTotal = couponResult.totalAfterDiscountCents;
      effectiveAffiliate = null; // coupon won → no affiliate commission
    } else {
      expectedTotal = affiliateResult.totalAfterDiscountCents;
    }
  } else if (couponResult) {
    expectedTotal = couponResult.totalAfterDiscountCents;
  } else if (affiliateResult) {
    expectedTotal = affiliateResult.totalAfterDiscountCents;
  } else {
    expectedTotal = baseTotal;
  }

  return { affiliateResult: effectiveAffiliate, couponResult, expectedTotal };
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
      // eSIM items have no product row; store null to satisfy FK
      productId: item.esimPackageId ? null : item.productId,
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

  // Affiliate earnings (atomic increment to avoid SELECT-then-UPDATE race) --
  if (affiliateResult) {
    await db
      .update(affiliateTable)
      .set({
        updatedAt: now,
        totalEarnedCents: sql`${affiliateTable.totalEarnedCents} + ${affiliateResult.affiliate.commissionCents}`,
      })
      .where(eq(affiliateTable.id, affiliateResult.affiliate.affiliateId));
  }

  // Coupon redemption (atomic guard against max-uses TOCTOU race) -----------
  if (couponResult) {
    const redemptionId = createId();
    // Use conditional INSERT to atomically enforce maxUses:
    // only insert if the current redemption count is below the coupon's maxUses.
    await db.execute(sql`
      INSERT INTO ${couponRedemptionTable} (id, coupon_id, order_id, user_id, created_at)
      SELECT ${redemptionId}, ${couponResult.couponId}, ${orderId}, ${userId}, ${now}
      WHERE (
        SELECT COALESCE(${couponsTable.maxUses}, 0) FROM ${couponsTable} WHERE ${couponsTable.id} = ${couponResult.couponId}
      ) = 0
      OR (
        SELECT COUNT(*) FROM ${couponRedemptionTable} WHERE ${couponRedemptionTable.couponId} = ${couponResult.couponId}
      ) < (
        SELECT COALESCE(${couponsTable.maxUses}, 2147483647) FROM ${couponsTable} WHERE ${couponsTable.id} = ${couponResult.couponId}
      )
    `);
  }
}

// ---------------------------------------------------------------------------
// 6b. createEsimOrderRecordsForOrder
// ---------------------------------------------------------------------------

/**
 * For orders that contain eSIM line items, create esim_order records.
 * Called after insertOrderItems in create-order routes. Fetches package
 * details from the eSIM API and inserts one esim order per quantity per item.
 */
export async function createEsimOrderRecordsForOrder(params: {
  orderId: string;
  userId: string | null;
  paymentMethod: string;
  items: ValidatedOrderItem[];
}): Promise<void> {
  const { orderId, userId, paymentMethod, items } = params;
  const esimItems = items.filter((i) => i.esimPackageId);
  if (esimItems.length === 0) return;

  const now = new Date();
  for (const item of esimItems) {
    const pkgResult = await getEsimPackageDetail(item.esimPackageId!);
    if (!pkgResult.status || !pkgResult.data) {
      console.error(
        `[createEsimOrderRecords] Package not found: ${item.esimPackageId}`,
      );
      continue;
    }
    const pkg = pkgResult.data;
    const costCents = Math.round(Number(pkg.price) * 100);
    const countryName =
      pkg.countries?.[0]?.name ?? pkg.romaing_countries?.[0]?.name ?? null;
    const packageType = (pkg.package_type ?? "DATA-ONLY") as string;

    for (let q = 0; q < item.quantity; q++) {
      await db.insert(esimOrdersTable).values({
        id: createId(),
        userId,
        orderId,
        packageId: item.esimPackageId!,
        packageName: pkg.name,
        packageType,
        dataQuantity: pkg.data_quantity,
        dataUnit: pkg.data_unit,
        validityDays: pkg.package_validity,
        countryName,
        costCents,
        priceCents: item.priceCents,
        currency: "USD",
        paymentMethod,
        paymentStatus: "pending",
        status: "pending",
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// 7. createOrderTransaction (wraps insert + items + bookkeeping in a tx)
// ---------------------------------------------------------------------------

/**
 * Execute {@link insertOrder}, {@link insertOrderItems}, and
 * {@link postOrderBookkeeping} inside a single database transaction so that a
 * failure in any step rolls back the entire order creation.
 */
export async function createOrderTransaction(params: {
  base: BaseOrderFields;
  extraFields?: Record<string, unknown>;
  items: ValidatedOrderItem[];
  bookkeeping: BookkeepingInput;
}): Promise<string> {
  return db.transaction(async (tx) => {
    // Re-use the existing helpers but execute against the transaction
    const now = new Date();

    // Insert order
    await tx.insert(ordersTable).values({
      id: params.base.orderId,
      createdAt: now,
      email: params.base.email.trim(),
      fulfillmentStatus: "unfulfilled",
      paymentMethod: params.base.paymentMethod,
      paymentStatus: "pending",
      shippingFeeCents: params.base.shippingFeeCents,
      taxCents: params.base.taxCents,
      status: "pending",
      totalCents: params.base.totalCents,
      updatedAt: now,
      userId: params.base.userId,
      ...(params.base.telegramUserId
        ? { telegramUserId: String(params.base.telegramUserId) }
        : {}),
      ...(params.base.telegramUsername
        ? { telegramUsername: params.base.telegramUsername }
        : {}),
      ...(params.base.telegramFirstName
        ? { telegramFirstName: params.base.telegramFirstName }
        : {}),
      ...(params.base.affiliateResult && {
        affiliateId: params.base.affiliateResult.affiliate.affiliateId,
        affiliateCode: params.base.affiliateResult.affiliate.affiliateCode,
        affiliateCommissionCents:
          params.base.affiliateResult.affiliate.commissionCents,
        affiliateDiscountCents:
          params.base.affiliateResult.affiliate.discountCents,
      }),
      ...(params.extraFields ?? {}),
    });

    // Insert order items
    if (params.items.length > 0) {
      await tx.insert(orderItemsTable).values(
        params.items.map((item) => ({
          id: createId(),
          name: item.name,
          orderId: params.base.orderId,
          priceCents: item.priceCents,
          productId: item.esimPackageId ? null : item.productId,
          productVariantId: item.productVariantId ?? null,
          quantity: item.quantity,
        })),
      );
    }

    // Post-order bookkeeping (within the same tx)
    const { orderId, userId, affiliateResult, couponResult, emailMarketingConsent, smsMarketingConsent } = params.bookkeeping;

    if (
      userId &&
      (emailMarketingConsent === true || smsMarketingConsent === true)
    ) {
      await tx
        .update(userTable)
        .set({
          updatedAt: now,
          ...(emailMarketingConsent === true && { receiveMarketing: true }),
          ...(smsMarketingConsent === true && { receiveSmsMarketing: true }),
        })
        .where(eq(userTable.id, userId));
    }

    if (affiliateResult) {
      await tx
        .update(affiliateTable)
        .set({
          updatedAt: now,
          totalEarnedCents: sql`${affiliateTable.totalEarnedCents} + ${affiliateResult.affiliate.commissionCents}`,
        })
        .where(eq(affiliateTable.id, affiliateResult.affiliate.affiliateId));
    }

    if (couponResult) {
      const redemptionId = createId();
      await tx.execute(sql`
        INSERT INTO ${couponRedemptionTable} (id, coupon_id, order_id, user_id, created_at)
        SELECT ${redemptionId}, ${couponResult.couponId}, ${orderId}, ${userId}, ${now}
        WHERE (
          SELECT COALESCE(${couponsTable.maxUses}, 0) FROM ${couponsTable} WHERE ${couponsTable.id} = ${couponResult.couponId}
        ) = 0
        OR (
          SELECT COUNT(*) FROM ${couponRedemptionTable} WHERE ${couponRedemptionTable.couponId} = ${couponResult.couponId}
        ) < (
          SELECT COALESCE(${couponsTable.maxUses}, 2147483647) FROM ${couponsTable} WHERE ${couponsTable.id} = ${couponResult.couponId}
        )
      `);
    }

    return params.base.orderId;
  });
}

// ---------------------------------------------------------------------------
// 8. handleCreateOrderError (consistent error response)
// ---------------------------------------------------------------------------

/**
 * Build a JSON error body from a caught exception, consistent with the
 * existing pattern in every create-order route.
 */
export function buildOrderErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return "Failed to create order";
  const msg = err.message ?? "";
  if (msg.includes("relation") || msg.includes("does not exist")) {
    return "Database schema out of date. Run: bun run db:push. If you recently added the user role column, run scripts/migrate-add-user-role.sql first.";
  }
  if (msg.includes("column") && msg.includes("does not exist")) {
    return "Database migration required. Run scripts/migrate-add-user-role.sql against your database.";
  }
  // In development, surface the actual error for debugging
  if (process.env.NODE_ENV === "development") {
    return `Failed to create order: ${msg}`;
  }
  return "Failed to create order";
}
