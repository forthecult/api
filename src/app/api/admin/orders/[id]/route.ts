import { createId } from "@paralleldrive/cuid2";
import { eq, inArray } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import {
  orderItemsTable,
  ordersTable,
  productAvailableCountryTable,
  productsTable,
} from "~/db/schema";
import { userTable } from "~/db/schema/users/tables";
import { getAdminAuth } from "~/lib/admin-api-auth";
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
    if (!authResult?.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Explicit select to avoid 500 when DB is missing newer columns (e.g. btcpay*, paymentMethod).
    const [order] = await db
      .select({
        id: ordersTable.id,
        createdAt: ordersTable.createdAt,
        updatedAt: ordersTable.updatedAt,
        customerNote: ordersTable.customerNote,
        discountPercent: ordersTable.discountPercent,
        email: ordersTable.email,
        fulfillmentStatus: ordersTable.fulfillmentStatus,
        internalNotes: ordersTable.internalNotes,
        paymentStatus: ordersTable.paymentStatus,
        status: ordersTable.status,
        taxCents: ordersTable.taxCents,
        totalCents: ordersTable.totalCents,
        shippingFeeCents: ordersTable.shippingFeeCents,
        userId: ordersTable.userId,
        shippingName: ordersTable.shippingName,
        shippingAddress1: ordersTable.shippingAddress1,
        shippingAddress2: ordersTable.shippingAddress2,
        shippingCity: ordersTable.shippingCity,
        shippingStateCode: ordersTable.shippingStateCode,
        shippingZip: ordersTable.shippingZip,
        shippingCountryCode: ordersTable.shippingCountryCode,
        shippingPhone: ordersTable.shippingPhone,
        stripeCheckoutSessionId: ordersTable.stripeCheckoutSessionId,
        paymentMethod: ordersTable.paymentMethod,
        solanaPayDepositAddress: ordersTable.solanaPayDepositAddress,
        solanaPayReference: ordersTable.solanaPayReference,
        cryptoTxHash: ordersTable.cryptoTxHash,
        btcpayInvoiceUrl: ordersTable.btcpayInvoiceUrl,
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

    let allowedCountryCodes: string[] | null = null;
    if (productIds.length > 0) {
      const restrictions = await db
        .select({
          productId: productAvailableCountryTable.productId,
          countryCode: productAvailableCountryTable.countryCode,
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
      { id: string; name: string; imageUrl: string | null }
    >();
    if (productIds.length > 0) {
      const products = await db
        .select({
          id: productsTable.id,
          name: productsTable.name,
          imageUrl: productsTable.imageUrl,
        })
        .from(productsTable)
        .where(inArray(productsTable.id, productIds));
      for (const p of products) {
        productMap.set(p.id, { id: p.id, name: p.name, imageUrl: p.imageUrl });
      }
    }
    const items = orderItems.map((i) => ({
      id: i.id,
      name: i.name,
      priceCents: i.priceCents,
      productId: i.productId,
      quantity: i.quantity,
      imageUrl: productMap.get(i.productId ?? "")?.imageUrl ?? null,
      productName: productMap.get(i.productId ?? "")?.name ?? i.name,
    }));

    const user = order.userId
      ? (
          await db
            .select({
              id: userTable.id,
              name: userTable.name,
              email: userTable.email,
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
      (order.status === "refunded"
        ? "refunded"
        : order.status === "paid" || order.status === "fulfilled"
          ? "paid"
          : order.status === "cancelled"
            ? "cancelled"
            : "pending");
    const fulfillmentStatus =
      order.fulfillmentStatus ??
      (order.status === "fulfilled" ? "fulfilled" : "unfulfilled");

    return NextResponse.json({
      id: order.id,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      email: order.email,
      status: order.status,
      paymentStatus,
      fulfillmentStatus,
      totalCents: order.totalCents,
      customerNote: order.customerNote ?? "",
      internalNotes: order.internalNotes ?? "",
      shippingFeeCents,
      taxCents,
      discountPercent,
      shippingMethod,
      shippingName: order.shippingName ?? "",
      shippingAddress1: order.shippingAddress1 ?? "",
      shippingAddress2: order.shippingAddress2 ?? "",
      shippingCity: order.shippingCity ?? "",
      shippingStateCode: order.shippingStateCode ?? "",
      shippingZip: order.shippingZip ?? "",
      shippingCountryCode: order.shippingCountryCode ?? "",
      shippingPhone: order.shippingPhone ?? "",
      userId: order.userId,
      user: user ? { id: user.id, name: user.name, email: user.email } : null,
      items,
      subtotalCents,
      totalComputedCents: Math.round(afterDiscount),
      paymentMethod,
      allowedCountryCodes,
      // On-chain payment: address that received funds + tx id (when available)
      ...((order.solanaPayDepositAddress ||
        order.cryptoTxHash ||
        order.btcpayInvoiceUrl) && {
        paymentReceiptAddress: order.solanaPayDepositAddress ?? undefined,
        cryptoTxHash: order.cryptoTxHash ?? undefined,
        btcpayInvoiceUrl: order.btcpayInvoiceUrl ?? undefined,
      }),
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
    if (!authResult?.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = (await request.json()) as {
      status?: string;
      paymentStatus?: string;
      fulfillmentStatus?: string;
      customerNote?: string | null;
      internalNotes?: string | null;
      shippingFeeCents?: number;
      taxCents?: number;
      discountPercent?: number;
      shippingName?: string | null;
      shippingAddress1?: string | null;
      shippingAddress2?: string | null;
      shippingCity?: string | null;
      shippingStateCode?: string | null;
      shippingZip?: string | null;
      shippingCountryCode?: string | null;
      shippingPhone?: string | null;
      items?: Array<{ id: string; quantity: number }>;
      addItems?: Array<{ productId: string; quantity: number }>;
    };

    const [existing] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.status === "string" && body.status.trim()) {
      const allowed = ["pending", "paid", "fulfilled", "cancelled", "refunded"];
      if (allowed.includes(body.status)) updates.status = body.status;
    }
    const paymentAllowed = ["pending", "paid", "refunded", "cancelled"];
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
        rawPayment === "refunded"
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

    if (Array.isArray(body.items) && body.items.length > 0) {
      for (const row of body.items) {
        if (typeof row.id === "string" && typeof row.quantity === "number") {
          if (row.quantity <= 0) {
            await db
              .delete(orderItemsTable)
              .where(eq(orderItemsTable.id, row.id));
          } else {
            await db
              .update(orderItemsTable)
              .set({ quantity: row.quantity })
              .where(eq(orderItemsTable.id, row.id));
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
        const [product] = await db
          .select({
            id: productsTable.id,
            name: productsTable.name,
            priceCents: productsTable.priceCents,
          })
          .from(productsTable)
          .where(eq(productsTable.id, add.productId))
          .limit(1);
        if (!product) continue;
        await db.insert(orderItemsTable).values({
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
      const items = await db.query.orderItemsTable.findMany({
        where: (t, { eq: eqItem }) => eqItem(t.orderId, id),
      });
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

    const [updated] = await db
      .update(ordersTable)
      .set(updates as Record<string, unknown>)
      .where(eq(ordersTable.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Trigger transactional notifications when admin marks order paid (website "Order confirmed", email)
    const nowPaid =
      (updates.paymentStatus as string | undefined) === "paid" ||
      updated.paymentStatus === "paid";
    const wasNotPaid =
      existing.paymentStatus !== "paid" && existing.paymentStatus !== "confirmed";
    if (nowPaid && wasNotPaid) {
      void onOrderCreated(updated.id);
    }
    // Trigger transactional notifications (Telegram, website widget, email) when admin marks order fulfilled
    if (updates.fulfillmentStatus === "fulfilled") {
      void onOrderStatusUpdate(updated.id, "order_shipped");
    }

    const paymentStatus =
      updated.paymentStatus ??
      (updated.status === "refunded"
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
      id: updated.id,
      status: updated.status,
      paymentStatus,
      fulfillmentStatus,
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
