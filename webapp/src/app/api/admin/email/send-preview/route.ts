import { type NextRequest, NextResponse } from "next/server";

import {
  adminPreviewOrderExists,
  buildAdminEmailPreview,
} from "~/lib/admin-email-preview";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";
import { sendEmail } from "~/lib/email/send-email";

interface Body {
  kind?: string;
  orderId?: string;
  to?: string;
  userId?: string;
}

/**
 * POST /api/admin/email/send-preview
 * Body: { to, kind, userId?, orderId? } — sends a rendered preview with `[PREVIEW]` subject.
 * Uses `internal: true` so marketing consent / suppression do not block test sends.
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
  const kind = typeof body.kind === "string" ? body.kind.trim() : "";
  const userId =
    typeof body.userId === "string" && body.userId.trim()
      ? body.userId.trim()
      : undefined;
  const orderId =
    typeof body.orderId === "string" && body.orderId.trim()
      ? body.orderId.trim()
      : undefined;

  if (!to) {
    return NextResponse.json({ error: "to is required" }, { status: 400 });
  }
  if (!kind) {
    return NextResponse.json({ error: "kind is required" }, { status: 400 });
  }

  if (orderId && !(await adminPreviewOrderExists(orderId))) {
    return NextResponse.json(
      { error: `Order not found: ${orderId}` },
      { status: 404 },
    );
  }

  const built = await buildAdminEmailPreview(kind, { orderId, userId });
  if ("error" in built) {
    return NextResponse.json({ error: built.error }, { status: 400 });
  }

  const result = await sendEmail({
    correlationId: `admin-preview:${Date.now()}:${kind}`,
    internal: true,
    kind: built.kind,
    react: built.react,
    subject: built.subject,
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
