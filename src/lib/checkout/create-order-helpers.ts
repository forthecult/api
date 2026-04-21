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
  productsTable,
  productVariantsTable,
} from "~/db/schema";
import { userTable } from "~/db/schema/users/tables";
import { resolveAffiliateForOrder } from "~/lib/affiliate";
import {
  type CartLineItem,
  resolveAutomaticCouponForCheckout,
  resolveCouponForCheckout,
} from "~/lib/coupon";
import { getEsimPackageDetail } from "~/lib/esim-api";
import { getMemberTierForWallet } from "~/lib/get-member-tier";
import { resolveTierDiscountsForCheckout } from "~/lib/tier-discount";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Unwrapped affiliate helper result type. */
export type AffiliateResult = NonNullable<
  Awaited<ReturnType<typeof resolveAffiliateForOrder>>
>;

/** Fields common to every order insert (payment-method-specific fields are spread on top). */
export interface BaseOrderFields {
  affiliateResult?: AffiliateResult | null;
  email: string;
  orderId: string;
  paymentMethod: string;
  /** Optional customer note / reference. */
  reference?: null | string;
  shippingFeeCents: number;
  taxCents: number;
  telegramFirstName?: null | string;
  telegramUserId?: null | string;
  telegramUsername?: null | string;
  totalCents: number;
  userId: null | string;
}

/** Input for {@link postOrderBookkeeping}. */
export interface BookkeepingInput {
  affiliateResult: AffiliateResult | null;
  couponResult: CouponResult | null;
  emailMarketingConsent?: boolean;
  orderId: string;
  smsMarketingConsent?: boolean;
  userId: null | string;
}

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

/** Result returned by {@link validateAndFetchProducts}. */
export interface ProductValidationResult {
  /** De-duplicated product IDs present in the validated items. */
  productIds: string[];
  /** Product lookup map keyed by product ID. */
  productMap: Map<string, { id: string; name: string; priceCents: number }>;
  /** Server-computed subtotal in cents (sum of priceCents * quantity). */
  subtotalCents: number;
  /** Validated order items with server-side prices. */
  validatedItems: ValidatedOrderItem[];
  /** Variant lookup map keyed by variant ID. */
  variantMap: Map<
    string,
    { id: string; priceCents: number; productId: string }
  >;
}

/** Raw item from the client request (after Zod parsing). */
export interface RawOrderItem {
  name?: string;
  priceCents?: number;
  productId: string;
  productVariantId?: string;
  quantity: number;
}

/** Result returned by {@link validateTotal}. */
export interface TotalValidationResult {
  expectedTotal: number;
  valid: boolean;
}

/** A validated order item with server-side prices from the DB. */
export interface ValidatedOrderItem {
  /** Set for eSIM items (productId starts with esim_); package ID from reseller API. */
  esimPackageId?: string;
  name: string;
  priceCents: number;
  productId: string;
  productVariantId?: string;
  quantity: number;
}

// ---------------------------------------------------------------------------
// 1. validateAndFetchProducts
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

// ---------------------------------------------------------------------------
// 2. resolveDiscounts
// ---------------------------------------------------------------------------

/**
 * For orders that contain eSIM line items, create esim_order records.
 * Called after insertOrderItems in create-order routes. Fetches package
 * details from the eSIM API and inserts one esim order per quantity per item.
 */
export async function createEsimOrderRecordsForOrder(params: {
  items: ValidatedOrderItem[];
  orderId: string;
  paymentMethod: string;
  userId: null | string;
}): Promise<void> {
  const { items, orderId, paymentMethod, userId } = params;
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
    const dataQuantity = Number(pkg.data_quantity);
    const validityDays = Number(pkg.package_validity) || 1;
    const dataUnit =
      pkg.data_unit && String(pkg.data_unit).toUpperCase() === "MB"
        ? "MB"
        : "GB";
    const packageTypeVal =
      pkg.package_type === "DATA-VOICE-SMS" ? "DATA-VOICE-SMS" : "DATA-ONLY";

    for (let q = 0; q < item.quantity; q++) {
      await db.insert(esimOrdersTable).values({
        costCents,
        countryName,
        createdAt: now,
        currency: "USD",
        dataQuantity: Number.isNaN(dataQuantity) ? 0 : dataQuantity,
        dataUnit,
        id: createId(),
        orderId,
        packageId: item.esimPackageId!,
        packageName: String(pkg.name ?? "eSIM"),
        packageType: packageTypeVal,
        paymentMethod,
        paymentStatus: "pending",
        priceCents: item.priceCents,
        status: "pending",
        updatedAt: now,
        userId,
        validityDays,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// 3. validateTotal
// ---------------------------------------------------------------------------

/**
 * Execute {@link insertOrder}, {@link insertOrderItems}, and
 * {@link postOrderBookkeeping} inside a single database transaction so that a
 * failure in any step rolls back the entire order creation.
 */
export async function createOrderTransaction(params: {
  base: BaseOrderFields;
  bookkeeping: BookkeepingInput;
  extraFields?: Record<string, unknown>;
  items: ValidatedOrderItem[];
}): Promise<string> {
  return db.transaction(async (tx) => {
    // Re-use the existing helpers but execute against the transaction
    const now = new Date();

    // Insert order
    await tx.insert(ordersTable).values({
      createdAt: now,
      email: params.base.email.trim(),
      fulfillmentStatus: "unfulfilled",
      id: params.base.orderId,
      paymentMethod: params.base.paymentMethod,
      paymentStatus: "pending",
      shippingFeeCents: params.base.shippingFeeCents,
      status: "pending",
      taxCents: params.base.taxCents,
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
        affiliateCode: params.base.affiliateResult.affiliate.affiliateCode,
        affiliateCommissionCents:
          params.base.affiliateResult.affiliate.commissionCents,
        affiliateDiscountCents:
          params.base.affiliateResult.affiliate.discountCents,
        affiliateId: params.base.affiliateResult.affiliate.affiliateId,
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
    const {
      affiliateResult,
      couponResult,
      emailMarketingConsent,
      orderId,
      smsMarketingConsent,
      userId,
    } = params.bookkeeping;

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
          totalEarnedCents: sql`${affiliateTable.totalEarnedCents} + ${affiliateResult.affiliate.commissionCents}`,
          updatedAt: now,
        })
        .where(eq(affiliateTable.id, affiliateResult.affiliate.affiliateId));
    }

    if (couponResult) {
      const redemptionId = createId();
      const userIdParam = userId ?? null;
      const nowIso = now.toISOString();
      await tx.execute(sql`
        INSERT INTO ${couponRedemptionTable} (id, coupon_id, order_id, user_id, created_at)
        SELECT ${redemptionId}, ${couponResult.couponId}, ${orderId}, ${userIdParam}, ${nowIso}
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
    createdAt: now,
    email: base.email.trim(),
    fulfillmentStatus: "unfulfilled",
    id: base.orderId,
    paymentMethod: base.paymentMethod,
    paymentStatus: "pending",
    shippingFeeCents: base.shippingFeeCents,
    status: "pending",
    taxCents: base.taxCents,
    totalCents: base.totalCents,
    updatedAt: now,
    userId: base.userId,
    ...(base.telegramUserId
      ? { telegramUserId: String(base.telegramUserId) }
      : {}),
    ...(base.telegramUsername
      ? { telegramUsername: base.telegramUsername }
      : {}),
    ...(base.telegramFirstName
      ? { telegramFirstName: base.telegramFirstName }
      : {}),
    ...(base.affiliateResult && {
      affiliateCode: base.affiliateResult.affiliate.affiliateCode,
      affiliateCommissionCents: base.affiliateResult.affiliate.commissionCents,
      affiliateDiscountCents: base.affiliateResult.affiliate.discountCents,
      affiliateId: base.affiliateResult.affiliate.affiliateId,
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
    affiliateResult,
    couponResult,
    emailMarketingConsent,
    orderId,
    smsMarketingConsent,
    userId,
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
        totalEarnedCents: sql`${affiliateTable.totalEarnedCents} + ${affiliateResult.affiliate.commissionCents}`,
        updatedAt: now,
      })
      .where(eq(affiliateTable.id, affiliateResult.affiliate.affiliateId));
  }

  // Coupon redemption (atomic guard against max-uses TOCTOU race) -----------
  // Coerce userId to null when undefined so node-pg never receives undefined (ERR_INVALID_ARG_TYPE).
  // Pass created_at as ISO string: raw sql binding expects string/Buffer, not Date (ERR_INVALID_ARG_TYPE).
  if (couponResult) {
    const redemptionId = createId();
    const userIdParam = userId ?? null;
    const nowIso = now.toISOString();
    // Use conditional INSERT to atomically enforce maxUses:
    // only insert if the current redemption count is below the coupon's maxUses.
    await db.execute(sql`
      INSERT INTO ${couponRedemptionTable} (id, coupon_id, order_id, user_id, created_at)
      SELECT ${redemptionId}, ${couponResult.couponId}, ${orderId}, ${userIdParam}, ${nowIso}
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
 * Resolve affiliate and coupon discounts for the order.
 *
 * Returns the affiliate/coupon result objects (for later bookkeeping) and
 * the `expectedTotal` that should be compared against the client total.
 *
 * For eSIM-targeted coupons (ruleAppliesToEsim), productIds and items must
 * include eSIM cart items (productId starting with "esim_"). validateAndFetchProducts
 * already returns these in productIds and validatedItems.
 */
export async function resolveDiscounts(params: {
  affiliateCode?: null | string;
  /** When set and coupon-by-code fails, try automatic coupon; if client total matches, use it (handles payment-method switch / timing). */
  clientTotalCents?: null | number;
  couponCode?: null | string;
  /** Cart items with prices for per-product discount computation. Must include eSIM items (productId esim_*) for ruleAppliesToEsim. */
  items?: CartLineItem[];
  /** When wallet is not set (e.g. user unlinked), tier 1–3 from /api/user/membership (tier history) so tier discounts still apply. */
  memberTier?: null | number;
  /** Payment method key for payment-method-restricted coupons. */
  paymentMethodKey?: null | string;
  productIds: string[];
  shippingFeeCents: number;
  subtotalCents: number;
  /** Tolerance in cents when matching client total to automatic-coupon total (default 100). */
  toleranceCents?: number;
  userId?: null | string;
  /** Staking wallet for member tier; when set, tier is resolved from chain. */
  wallet?: null | string;
}): Promise<DiscountResult> {
  const {
    affiliateCode,
    clientTotalCents,
    couponCode,
    items,
    memberTier: memberTierParam,
    paymentMethodKey,
    productIds,
    shippingFeeCents,
    subtotalCents,
    toleranceCents = 100,
    userId,
    wallet,
  } = params;

  const affiliateResult = await resolveAffiliateForOrder(
    affiliateCode,
    subtotalCents,
    shippingFeeCents,
  );

  let couponResult = couponCode
    ? await resolveCouponForCheckout(
        couponCode,
        subtotalCents,
        shippingFeeCents,
        {
          items,
          paymentMethodKey: paymentMethodKey ?? undefined,
          productIds,
          userId: userId ?? undefined,
        },
      )
    : null;

  const baseTotal = subtotalCents + shippingFeeCents;

  // Fallback: client sent a coupon code (e.g. automatic) but code lookup failed (e.g. payment method
  // changed card → Solana so UI showed discount before refetch). Re-derive automatic coupon for this
  // cart and payment method; if the client total matches, accept it.
  if (
    couponResult === null &&
    couponCode != null &&
    couponCode.trim() !== "" &&
    typeof clientTotalCents === "number" &&
    clientTotalCents < baseTotal
  ) {
    const productCount = (items ?? []).reduce(
      (sum, i) => sum + (i?.quantity ?? 1),
      0,
    );
    const automaticResult = await resolveAutomaticCouponForCheckout({
      items: items ?? undefined,
      paymentMethodKey: paymentMethodKey ?? undefined,
      productCount,
      productIds,
      shippingFeeCents,
      subtotalCents,
      userId: userId ?? undefined,
    });
    if (automaticResult) {
      let expectedFromAutomatic = automaticResult.totalAfterDiscountCents;
      const resolvedTier = wallet?.trim()
        ? await getMemberTierForWallet(wallet.trim())
        : (memberTierParam ?? null);
      if (resolvedTier != null) {
        const tierResult = await resolveTierDiscountsForCheckout(resolvedTier, {
          items: items ?? [],
          shippingFeeCents,
          subtotalCents,
        });
        expectedFromAutomatic = Math.max(
          0,
          expectedFromAutomatic - tierResult.totalCents,
        );
      }
      const expectedRounded = Math.round(expectedFromAutomatic);
      if (Math.abs(clientTotalCents - expectedRounded) <= toleranceCents) {
        couponResult = automaticResult;
      }
    }
  }

  // Pick the best discount: coupon vs affiliate. If coupon gives a better
  // (lower) total, null out the affiliate so commission is not credited.
  let effectiveAffiliate = affiliateResult;
  let expectedTotal: number;

  if (couponResult && affiliateResult) {
    if (
      couponResult.totalAfterDiscountCents <=
      affiliateResult.totalAfterDiscountCents
    ) {
      expectedTotal = couponResult.totalAfterDiscountCents;
      effectiveAffiliate = null;
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

  // when member has tier discounts: use the better of coupon vs tier (tier overrides when it gives a lower total)
  const resolvedTier = wallet?.trim()
    ? await getMemberTierForWallet(wallet.trim())
    : (memberTierParam ?? null);
  if (resolvedTier != null) {
    const tierResult = await resolveTierDiscountsForCheckout(resolvedTier, {
      items: items ?? [],
      shippingFeeCents,
      subtotalCents,
    });
    if (tierResult.totalCents > 0) {
      const totalWithTierOnly = Math.max(0, baseTotal - tierResult.totalCents);
      if (totalWithTierOnly <= expectedTotal) {
        expectedTotal = totalWithTierOnly;
        couponResult = null;
      }
    }
  }

  return { affiliateResult: effectiveAffiliate, couponResult, expectedTotal };
}

// ---------------------------------------------------------------------------
// 7. createOrderTransaction (wraps insert + items + bookkeeping in a tx)
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
): Promise<null | ProductValidationResult> {
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
            priceCents: productVariantsTable.priceCents,
            productId: productVariantsTable.productId,
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
      const name =
        typeof item.name === "string" && item.name.trim()
          ? item.name.trim()
          : null;
      const priceCents =
        typeof item.priceCents === "number" && item.priceCents >= 0
          ? item.priceCents
          : null;
      if (!name || priceCents === null) continue;
      const esimPackageId = item.productId.replace(/^esim_/, "");
      if (!esimPackageId) continue;
      validatedItems.push({
        esimPackageId,
        name,
        priceCents,
        productId: item.productId,
        quantity: item.quantity,
      });
      continue;
    }

    const product = productMap.get(item.productId);
    if (!product) continue;

    if (item.productVariantId) {
      const variant = variantMap.get(item.productVariantId);
      if (!variant || variant.productId !== item.productId) continue;
      validatedItems.push({
        name: product.name,
        priceCents: variant.priceCents,
        productId: product.id,
        productVariantId: variant.id,
        quantity: item.quantity,
      });
    } else {
      validatedItems.push({
        name: product.name,
        priceCents: product.priceCents,
        productId: product.id,
        quantity: item.quantity,
      });
    }
  }

  if (validatedItems.length === 0) return null;

  const subtotalCents = validatedItems.reduce(
    (sum, i) => sum + i.priceCents * i.quantity,
    0,
  );

  return { productIds, productMap, subtotalCents, validatedItems, variantMap };
}

// ---------------------------------------------------------------------------
// 8. handleCreateOrderError (consistent error response)
// ---------------------------------------------------------------------------

/**
 * Compare the client-submitted total against the server-computed expected
 * total. Returns `{ valid, expectedTotal }`.
 *
 * Create-order routes use server total as the order amount. They reject only
 * when clientTotalCents < expectedTotal (undercharge/tampering). When
 * client sends same or more (e.g. race: UI not yet updated after payment
 * method switch), routes accept and use expectedTotal so the flow works
 * without asking the user to wait or retry.
 *
 * @param toleranceCents  Maximum acceptable difference (default 100 = $1).
 * @param extraCents      Extra cents to add to expectedTotal before comparing
 *                        (e.g. taxCents for routes that include tax).
 */
export function validateTotal(params: {
  clientTotalCents: number;
  expectedTotal: number;
  extraCents?: number;
  toleranceCents?: number;
}): TotalValidationResult {
  const {
    clientTotalCents,
    expectedTotal: base,
    extraCents = 0,
    toleranceCents = 100,
  } = params;
  // Round to avoid float mismatch (e.g. tier/coupon stacking)
  const expectedTotal = Math.round(base + extraCents);
  const diff = Math.abs(clientTotalCents - expectedTotal);
  const valid = diff <= toleranceCents;
  if (!valid) {
    console.warn("[checkout] total mismatch:", {
      clientTotalCents,
      diff,
      expectedTotal,
      toleranceCents,
    });
  }
  return { expectedTotal, valid };
}
