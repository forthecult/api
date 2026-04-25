import { type NextRequest, NextResponse } from "next/server";

import { getAdminAuth } from "~/lib/admin-api-auth";
import { getAllNotificationTemplates } from "~/lib/notification-templates";

/**
 * GET /api/admin/notification-templates
 * Returns all transactional and marketing notification copy for admin review.
 * Requires admin auth.
 */
export async function GET(request: NextRequest) {
  const auth = await getAdminAuth(request);
  if (!auth?.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const templates = getAllNotificationTemplates();
  return NextResponse.json({
    all: templates,
    marketing: templates.filter((t) => !t.transactional),
    transactional: templates.filter((t) => t.transactional),
  });
}
