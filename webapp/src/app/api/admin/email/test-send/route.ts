import { type NextRequest, NextResponse } from "next/server";
import { createElement } from "react";

import { OrderPlacedEmail } from "~/emails/order-placed";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";
import { sendEmail } from "~/lib/email/send-email";

interface Body {
  to?: string;
}

/**
 * POST /api/admin/email/test-send
 * Body: { to: string } — sends a layout smoke email with [TEST] subject.
 */
export async function POST(request: NextRequest) {
  const auth = await getAdminAuth(request);
  if (!auth?.ok) return adminAuthFailureResponse(auth);

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const to = typeof body.to === "string" ? body.to.trim() : "";
  if (!to) {
    return NextResponse.json({ error: "to is required" }, { status: 400 });
  }

  const result = await sendEmail({
    correlationId: `admin-test:${Date.now()}`,
    internal: true,
    kind: "order_placed",
    react: createElement(OrderPlacedEmail, {
      bodyText: "This is a test email from the admin panel.\n\nOrder ID: test",
      ctaLabel: "View storefront",
      ctaUrl:
        process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://forthecult.store",
    }),
    subject: "[TEST] Order confirmed — template preview",
    to,
  });

  if (!result.ok) {
    const status =
      "skipped" in result &&
      result.skipped &&
      result.reason === "missing_api_key"
        ? 503
        : 502;
    return NextResponse.json({ error: "send failed", result }, { status });
  }

  return NextResponse.json({
    emailEventId: result.emailEventId,
    resendId: result.resendId,
  });
}
