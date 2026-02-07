import { desc, eq } from "drizzle-orm";
import { Package } from "lucide-react";
import Link from "next/link";

import { getCurrentUserOrRedirect } from "~/lib/auth";
import { db } from "~/db";
import { formatCents, formatDateShort } from "~/lib/format";
import { isRealEmail } from "~/lib/is-real-email";
import { linkOrdersToUserByEmail } from "~/lib/link-orders-to-user";
import { ordersTable } from "~/db/schema";
import { Button } from "~/ui/primitives/button";
import { Card, CardContent, CardHeader } from "~/ui/primitives/card";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  cancelled: "Cancelled",
  delivered: "Delivered",
  fulfilled: "Shipped",
  paid: "Processing",
  pending: "Unpaid",
  processing: "Processing",
  refunded: "Refunded",
  shipped: "Shipped",
  unfulfilled: "Pending",
  on_hold: "On hold",
  partially_fulfilled: "Processing",
};

const STATUS_CLASS: Record<string, string> = {
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  delivered:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  fulfilled:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  shipped:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  paid: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  pending: "bg-muted text-muted-foreground",
  processing:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  refunded: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  unfulfilled: "bg-muted text-muted-foreground",
  on_hold:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  partially_fulfilled:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

export default async function OrdersPage() {
  const user = await getCurrentUserOrRedirect();
  if (!user) return null;

  // If email is verified and is a real email (not a wallet placeholder), claim any guest orders placed with this email
  const emailVerified = (user as { emailVerified?: boolean }).emailVerified;
  if (emailVerified && user.email?.trim() && isRealEmail(user.email)) {
    await linkOrdersToUserByEmail(user.id, user.email);
  }

  const orders = await db.query.ordersTable.findMany({
    orderBy: [desc(ordersTable.createdAt)],
    where: eq(ordersTable.userId, user.id),
  });

  return (
    <>
      <div className="flex items-center gap-2">
        <Package className="h-7 w-7" />
        <h1 className="text-2xl font-semibold tracking-tight">My Orders</h1>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">
              You haven&apos;t placed any orders yet.
            </p>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/products">Browse products</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="sr-only">
            <span>Order list</span>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {orders.map((order) => {
                // Unpaid: show "Unpaid"; paid but order still "pending" → "Processing"; else use fulfillment/payment/status
                const paymentPending =
                  order.paymentStatus?.toLowerCase() === "pending";
                const paidWithPendingOrder =
                  order.paymentStatus?.toLowerCase() === "paid" &&
                  order.status?.toLowerCase() === "pending";
                const displayStatus = paymentPending
                  ? "pending"
                  : paidWithPendingOrder
                    ? "processing"
                    : (order.fulfillmentStatus?.toLowerCase() ??
                      order.paymentStatus?.toLowerCase() ??
                      order.status?.toLowerCase() ??
                      "pending");
                const statusKey = displayStatus;
                const label = STATUS_LABELS[statusKey] ?? displayStatus;
                const statusClass =
                  STATUS_CLASS[statusKey] ?? "bg-muted text-muted-foreground";
                return (
                  <li key={order.id}>
                    <div
                      className="flex flex-wrap items-center gap-3 px-4 py-4 sm:flex-nowrap sm:gap-4"
                      data-testid="order-row"
                    >
                      <span className="font-mono text-sm text-muted-foreground">
                        #{order.id.slice(0, 8)}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass}`}
                      >
                        {label}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {formatDateShort(order.createdAt)}
                      </span>
                      <span className="font-medium">
                        {formatCents(order.totalCents)}
                      </span>
                      <Button
                        asChild
                        className="ml-auto shrink-0"
                        size="sm"
                        variant="ghost"
                      >
                        <Link href={`/dashboard/orders/${order.id}`}>
                          Details
                          <span className="sr-only"> for order {order.id}</span>
                        </Link>
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}
