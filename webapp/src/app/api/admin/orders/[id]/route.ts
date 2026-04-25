import { createId } from "@paralleldrive/cuid2";
import { and, eq, inArray } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import {
  orderItemsTable,
  ordersTable,
  productAvailableCountryTable,
  productsTable,
} from "~/db/schema";
import { userTable } from "~/db/schema/users/tables";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";
import {
  onOrderCreated,
  onOrderStatusUpdate,
} from "~/lib/create-user-notification";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAdminAuth(_request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const { id } = await params;
    // TODO: Standardize error response format across admin routes (L20)

    // Explicit select to avoid 500 when DB is missing newer columns (e.g. btcpay*, paymentMethod).
    const [order] = await db
      .select({
        chainId: ordersTable.chainId,
        createdAt: ordersTable.createdAt,
        cryptoAmount: ordersTable.cryptoAmount,
        cryptoCurrency: ordersTable.cryptoCurrency,
        // Crypto payment details
        cryptoCurrencyNetwork: ordersTable.cryptoCurrencyNetwork,
        cryptoTxHash: ordersTable.cryptoTxHash,
        customerNote: ordersTable.customerNote,
        deliveredAt: ordersTable.deliveredAt,
        discountPercent: ordersTable.discountPercent,
        email: ordersTable.email,
        estimatedDeliveryFrom: ordersTable.estimatedDeliveryFrom,
        estimatedDeliveryTo: ordersTable.estimatedDeliveryTo,
        fulfillmentStatus: ordersTable.fulfillmentStatus,
        id: ordersTable.id,
        internalNotes: ordersTable.internalNotes,
        payerWalletAddress: ordersTable.payerWalletAddress,
        paymentMethod: ordersTable.paymentMethod,
        paymentStatus: ordersTable.paymentStatus,
        printfulCostShippingCents: ordersTable.printfulCostShippingCents,
        printfulCostTaxCents: ordersTable.printfulCostTaxCents,
        printfulCostTotalCents: ordersTable.printfulCostTotalCents,
        // Printful costs (admin-only)
        printfulOrderId: ordersTable.printfulOrderId,
        shippedAt: ordersTable.shippedAt,
        shippingAddress1: ordersTable.shippingAddress1,
        shippingAddress2: ordersTable.shippingAddress2,
        shippingCity: ordersTable.shippingCity,
        shippingCountryCode: ordersTable.shippingCountryCode,
        shippingFeeCents: ordersTable.shippingFeeCents,
        shippingName: ordersTable.shippingName,
        shippingPhone: ordersTable.shippingPhone,
        shippingStateCode: ordersTable.shippingStateCode,
        shippingZip: ordersTable.shippingZip,
        solanaPayDepositAddress: ordersTable.solanaPayDepositAddress,
        solanaPayReference: ordersTable.solanaPayReference,
        status: ordersTable.status,
        stripeCheckoutSessionId: ordersTable.stripeCheckoutSessionId,
        taxCents: ordersTable.taxCents,
        totalCents: ordersTable.totalCents,
        trackingCarrier: ordersTable.trackingCarrier,
        trackingEventsJson: ordersTable.trackingEventsJson,
        // Tracking
        trackingNumber: ordersTable.trackingNumber,
        trackingUrl: ordersTable.trackingUrl,
        updatedAt: ordersTable.updatedAt,
        userId: ordersTable.userId,
      })
      .from(ordersTable)
      .where(eq(ordersTable.id, id))
      .limit(1);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const orderItems = await db
      .select({
        id: orderItemsTable.id,
        name: orderItemsTable.name,
        priceCents: orderItemsTable.priceCents,
        productId: orderItemsTable.productId,
        quantity: orderItemsTable.quantity,
      })
      .from(orderItemsTable)
      .where(eq(orderItemsTable.orderId, id));

    const productIds = [
      ...new Set(
        orderItems
          .map((i) => i.productId)
          .filter((pid): pid is string => pid != null),
      ),
    ];

    let allowedCountryCodes: null | string[] = null;
    if (productIds.length > 0) {
      const restrictions = await db
        .select({
          countryCode: productAvailableCountryTable.countryCode,
          productId: productAvailableCountryTable.productId,
        })
        .from(productAvailableCountryTable)
        .where(inArray(productAvailableCountryTable.productId, productIds));
      const byProduct = new Map<string, Set<string>>();
      for (const r of restrictions) {
        if (!byProduct.has(r.productId)) {
          byProduct.set(r.productId, new Set());
        }
        byProduct.get(r.productId)!.add(r.countryCode);
      }
      const productsWithRestrictions = productIds.filter(
        (id) => (byProduct.get(id)?.size ?? 0) > 0,
      );
      if (productsWithRestrictions.length > 0) {
        const intersection = productsWithRestrictions.reduce<Set<string>>(
          (acc, id) => {
            const set = byProduct.get(id)!;
            if (acc.size === 0) return new Set(set);
            const next = new Set<string>();
            for (const c of set) {
              if (acc.has(c)) next.add(c);
            }
            return next;
          },
          new Set(),
        );
        allowedCountryCodes = Array.from(intersection);
      }
    }

    const productMap = new Map<
      string,
      { id: string; imageUrl: null | string; name: string }
    >();
    if (productIds.length > 0) {
      const products = await db
        .select({
          id: productsTable.id,
          imageUrl: productsTable.imageUrl,
          name: productsTable.name,
        })
        .from(productsTable)
        .where(inArray(productsTable.id, productIds));
      for (const p of products) {
        productMap.set(p.id, { id: p.id, imageUrl: p.imageUrl, name: p.name });
      }
    }
    const items = orderItems.map((i) => ({
      id: i.id,
      imageUrl: productMap.get(i.productId ?? "")?.imageUrl ?? null,
      name: i.name,
      priceCents: i.priceCents,
      productId: i.productId,
      productName: productMap.get(i.productId ?? "")?.name ?? i.name,
      quantity: i.quantity,
    }));

    const user = order.userId
      ? (
          await db
            .select({
              email: userTable.email,
              id: userTable.id,
              name: userTable.name,
            })
            .from(userTable)
            .where(eq(userTable.id, order.userId))
            .limit(1)
        )[0]
      : null;

    const subtotalCents = items.reduce(
      (sum, i) => sum + i.priceCents * i.quantity,
      0,
    );
    const shippingFeeCents = order.shippingFeeCents ?? 0;
    const taxCents = order.taxCents ?? 0;
    const discountPercent = order.discountPercent ?? 0;
    const afterDiscount =
      subtotalCents +
      shippingFeeCents +
      taxCents -
      (subtotalCents * discountPercent) / 100;

    let paymentMethod = "Other";
    if (order.stripeCheckoutSessionId) paymentMethod = "Credit/Debit card";
    else if (order.paymentMethod === "btcpay")
      paymentMethod = "BTCPay (Bitcoin/Doge/Monero)";
    else if (order.paymentMethod === "eth_pay")
      paymentMethod = "EVM (ETH/USDC/USDT)";
    else if (order.paymentMethod === "ton_pay") paymentMethod = "TON";
    else if (order.solanaPayReference || order.solanaPayDepositAddress)
      paymentMethod = "Solana Pay";

    const shippingMethod = order.shippingName?.trim() || "Standard";

    const paymentStatus =
      order.paymentStatus ??
      (order.status === "refund_pending"
        ? "refund_pending"
        : order.status === "refunded"
          ? "refunded"
          : order.status === "paid" || order.status === "fulfilled"
            ? "paid"
            : order.status === "cancelled"
              ? "cancelled"
              : "pending");
    const fulfillmentStatus =
      order.fulfillmentStatus ??
      (order.status === "fulfilled" ? "fulfilled" : "unfulfilled");

    // Build crypto payment info if applicable
    const cryptoPayment =
      order.cryptoTxHash || order.cryptoCurrency || order.payerWalletAddress
        ? {
            amount: order.cryptoAmount ?? null,
            chainId: order.chainId ?? null,
            currency: order.cryptoCurrency ?? null,
            network: order.cryptoCurrencyNetwork ?? null,
            payerWallet: order.payerWalletAddress ?? null,
            txHash: order.cryptoTxHash ?? null,
          }
        : null;

    return NextResponse.json({
      allowedCountryCodes,
      createdAt: order.createdAt.toISOString(),
      // Crypto payment details (admin-only)
      cryptoPayment,
      customerNote: order.customerNote ?? "",
      discountPercent,
      email: order.email,
      fulfillmentStatus,
      id: order.id,
      internalNotes: order.internalNotes ?? "",
      items,
      paymentMethod,
      paymentStatus,
      // Printful costs (admin-only wholesale costs)
      printfulCosts: order.printfulOrderId
        ? {
            shippingCents: order.printfulCostShippingCents ?? null,
            taxCents: order.printfulCostTaxCents ?? null,
            totalCents: order.printfulCostTotalCents ?? null,
          }
        : null,
      shippingAddress1: order.shippingAddress1 ?? "",
      shippingAddress2: order.shippingAddress2 ?? "",
      shippingCity: order.shippingCity ?? "",
      shippingCountryCode: order.shippingCountryCode ?? "",
      shippingFeeCents,
      shippingMethod,
      shippingName: order.shippingName ?? "",
      shippingPhone: order.shippingPhone ?? "",
      shippingStateCode: order.shippingStateCode ?? "",
      shippingZip: order.shippingZip ?? "",
      status: order.status,
      subtotalCents,
      taxCents,
      totalCents: order.totalCents,
      totalComputedCents: Math.round(afterDiscount),
      // Tracking
      tracking: {
        carrier: order.trackingCarrier ?? null,
        deliveredAt: order.deliveredAt?.toISOString() ?? null,
        estimatedDeliveryFrom: order.estimatedDeliveryFrom ?? null,
        estimatedDeliveryTo: order.estimatedDeliveryTo ?? null,
        events: order.trackingEventsJson ?? null,
        shippedAt: order.shippedAt?.toISOString() ?? null,
        trackingNumber: order.trackingNumber ?? null,
        trackingUrl: order.trackingUrl ?? null,
      },
      updatedAt: order.updatedAt.toISOString(),
      user: user ? { email: user.email, id: user.id, name: user.name } : null,
      userId: order.userId,
    });
  } catch (err) {
    console.error("Admin order get error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    const isColumnError =
      typeof message === "string" &&
      message.includes("column") &&
      message.includes("does not exist");
    return NextResponse.json(
      {
        error: "Failed to load order",
        ...(process.env.NODE_ENV === "development" && {
          detail: isColumnError
            ? "Database may be missing columns. Try: bun run db:push"
            : message,
        }),
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const { id } = await params;
    // TODO: Standardize error response format across admin routes (L20)
    // nanoid uses A-Za-z0-9_- ; slugs use a-z0-9-
    const NANOID_RE = /^[A-Za-z0-9_-]{10,40}$/;
    if (!NANOID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }
    const body = (await request.json()) as {
      addItems?: { productId: string; quantity: number }[];
      customerNote?: null | string;
      discountPercent?: number;
      fulfillmentStatus?: string;
      internalNotes?: null | string;
      items?: { id: string; quantity: number }[];
      paymentStatus?: string;
      shippingAddress1?: null | string;
      shippingAddress2?: null | string;
      shippingCity?: null | string;
      shippingCountryCode?: null | string;
      shippingFeeCents?: number;
      shippingName?: null | string;
      shippingPhone?: null | string;
      shippingStateCode?: null | string;
      shippingZip?: null | string;
      status?: string;
      taxCents?: number;
      trackingCarrier?: null | string;
      // Tracking (admin can manually set these)
      trackingNumber?: null | string;
      trackingUrl?: null | string;
    };

    const [existing] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (
      typeof body.shippingFeeCents === "number" &&
      body.shippingFeeCents < 0
    ) {
      return NextResponse.json(
        { error: "Shipping fee cannot be negative" },
        { status: 400 },
      );
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.status === "string" && body.status.trim()) {
      const allowed = [
        "pending",
        "paid",
        "fulfilled",
        "cancelled",
        "refunded",
        "refund_pending",
      ];
      if (allowed.includes(body.status)) updates.status = body.status;
    }
    const paymentAllowed = [
      "pending",
      "paid",
      "refunded",
      "refund_pending",
      "cancelled",
    ];
    const rawPayment =
      typeof body.paymentStatus === "string"
        ? body.paymentStatus.trim().toLowerCase()
        : undefined;
    if (rawPayment && paymentAllowed.includes(rawPayment)) {
      updates.paymentStatus = rawPayment;
      // Keep legacy status in sync so customer dashboard (which uses status) reflects payment
      if (rawPayment === "paid") updates.status = "paid";
      else if (
        rawPayment === "cancelled" ||
        rawPayment === "refunded" ||
        rawPayment === "refund_pending"
      )
        updates.status = rawPayment;
      else if (rawPayment === "pending") updates.status = "pending";
    }
    const fulfillmentAllowed = [
      "unfulfilled",
      "on_hold",
      "partially_fulfilled",
      "fulfilled",
    ];
    if (
      typeof body.fulfillmentStatus === "string" &&
      fulfillmentAllowed.includes(body.fulfillmentStatus)
    ) {
      updates.fulfillmentStatus = body.fulfillmentStatus;
      // Keep legacy status in sync so customer dashboard reflects fulfillment
      if (body.fulfillmentStatus === "fulfilled") updates.status = "fulfilled";
      else if (
        body.fulfillmentStatus === "unfulfilled" ||
        body.fulfillmentStatus === "on_hold" ||
        body.fulfillmentStatus === "partially_fulfilled"
      ) {
        // Only revert to paid if current status was fulfilled (don't overwrite cancelled/refunded)
        if (updates.status === undefined && existing.status === "fulfilled") {
          updates.status = "paid";
        }
      }
    }
    if (body.customerNote !== undefined)
      updates.customerNote = body.customerNote ?? null;
    if (body.internalNotes !== undefined)
      updates.internalNotes = body.internalNotes ?? null;
    if (typeof body.shippingFeeCents === "number")
      updates.shippingFeeCents = body.shippingFeeCents;
    if (typeof body.taxCents === "number" && body.taxCents >= 0)
      updates.taxCents = body.taxCents;
    if (typeof body.discountPercent === "number")
      updates.discountPercent = Math.max(
        0,
        Math.min(100, body.discountPercent),
      );
    if (body.shippingName !== undefined)
      updates.shippingName = body.shippingName ?? null;
    if (body.shippingAddress1 !== undefined)
      updates.shippingAddress1 = body.shippingAddress1 ?? null;
    if (body.shippingAddress2 !== undefined)
      updates.shippingAddress2 = body.shippingAddress2 ?? null;
    if (body.shippingCity !== undefined)
      updates.shippingCity = body.shippingCity ?? null;
    if (body.shippingStateCode !== undefined)
      updates.shippingStateCode = body.shippingStateCode ?? null;
    if (body.shippingZip !== undefined)
      updates.shippingZip = body.shippingZip ?? null;
    if (body.shippingCountryCode !== undefined)
      updates.shippingCountryCode = body.shippingCountryCode ?? null;
    if (body.shippingPhone !== undefined)
      updates.shippingPhone = body.shippingPhone ?? null;
    // Tracking fields
    if (body.trackingNumber !== undefined)
      updates.trackingNumber = body.trackingNumber ?? null;
    if (body.trackingUrl !== undefined)
      updates.trackingUrl = body.trackingUrl ?? null;
    if (body.trackingCarrier !== undefined)
      updates.trackingCarrier = body.trackingCarrier ?? null;

    const [updated] = await db.transaction(async (tx) => {
      if (Array.isArray(body.items) && body.items.length > 0) {
        for (const row of body.items) {
          if (typeof row.id === "string" && typeof row.quantity === "number") {
            if (row.quantity <= 0) {
              await tx
                .delete(orderItemsTable)
                .where(
                  and(
                    eq(orderItemsTable.id, row.id),
                    eq(orderItemsTable.orderId, id),
                  ),
                );
            } else {
              await tx
                .update(orderItemsTable)
                .set({ quantity: row.quantity })
                .where(
                  and(
                    eq(orderItemsTable.id, row.id),
                    eq(orderItemsTable.orderId, id),
                  ),
                );
            }
          }
        }
      }

      if (Array.isArray(body.addItems) && body.addItems.length > 0) {
        for (const add of body.addItems) {
          if (
            !add.productId ||
            typeof add.quantity !== "number" ||
            add.quantity < 1
          )
            continue;
          const [product] = await tx
            .select({
              id: productsTable.id,
              name: productsTable.name,
              priceCents: productsTable.priceCents,
            })
            .from(productsTable)
            .where(eq(productsTable.id, add.productId))
            .limit(1);
          if (!product) continue;
          await tx.insert(orderItemsTable).values({
            id: createId(),
            name: product.name,
            orderId: id,
            priceCents: product.priceCents,
            productId: product.id,
            quantity: add.quantity,
          });
        }
      }

      const needRecalc =
        updates.shippingFeeCents !== undefined ||
        updates.taxCents !== undefined ||
        updates.discountPercent !== undefined ||
        (Array.isArray(body.items) && body.items.length > 0) ||
        (Array.isArray(body.addItems) && body.addItems.length > 0);
      if (needRecalc) {
        const items = await tx
          .select({
            priceCents: orderItemsTable.priceCents,
            quantity: orderItemsTable.quantity,
          })
          .from(orderItemsTable)
          .where(eq(orderItemsTable.orderId, id));
        const subtotalCents = items.reduce(
          (s, i) => s + i.priceCents * i.quantity,
          0,
        );
        const shippingFeeCents =
          (updates.shippingFeeCents as number | undefined) ??
          existing.shippingFeeCents ??
          0;
        const taxCents =
          (updates.taxCents as number | undefined) ?? existing.taxCents ?? 0;
        const discountPercent =
          (updates.discountPercent as number | undefined) ??
          existing.discountPercent ??
          0;
        updates.totalCents = Math.round(
          subtotalCents +
            shippingFeeCents +
            taxCents -
            (subtotalCents * discountPercent) / 100,
        );
      }

      return tx
        .update(ordersTable)
        .set(updates as Record<string, unknown>)
        .where(eq(ordersTable.id, id))
        .returning();
    });

    if (!updated) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Trigger transactional notifications when admin marks order paid (website "Order confirmed", email)
    const nowPaid =
      (updates.paymentStatus as string | undefined) === "paid" ||
      updated.paymentStatus === "paid";
    const wasNotPaid =
      existing.paymentStatus !== "paid" &&
      existing.paymentStatus !== "confirmed";
    if (nowPaid && wasNotPaid) {
      void onOrderCreated(updated.id);
    }
    // Trigger transactional notifications (Telegram, website widget, email) when admin marks order fulfilled
    if (updates.fulfillmentStatus === "fulfilled") {
      void onOrderStatusUpdate(updated.id, "order_shipped");
    }

    console.info(
      `[admin-audit] Order ${id} updated by admin. Status: ${body.status ?? "unchanged"}, Items modified: ${body.items?.length ?? 0}`,
    );

    const paymentStatus =
      updated.paymentStatus ??
      (updated.status === "refund_pending"
        ? "refund_pending"
        : updated.status === "refunded"
          ? "refunded"
          : updated.status === "paid" || updated.status === "fulfilled"
            ? "paid"
            : updated.status === "cancelled"
              ? "cancelled"
              : "pending");
    const fulfillmentStatus =
      updated.fulfillmentStatus ??
      (updated.status === "fulfilled" ? "fulfilled" : "unfulfilled");

    return NextResponse.json({
      fulfillmentStatus,
      id: updated.id,
      paymentStatus,
      status: updated.status,
      totalCents: updated.totalCents,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err) {
    console.error("Admin order update error:", err);
    return NextResponse.json(
      { error: "Failed to update order" },
      { status: 500 },
    );
  }
}
