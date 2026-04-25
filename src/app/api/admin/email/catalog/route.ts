import { type NextRequest, NextResponse } from "next/server";

import {
  ADMIN_EMAIL_FUNNELS,
  ADMIN_INTERNAL_EMAIL_KINDS,
  ADMIN_MARKETING_EXTRA_KINDS,
  ADMIN_TRANSACTIONAL_EMAIL_KINDS,
} from "~/lib/admin-email-catalog";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";
import { getAllNotificationTemplates } from "~/lib/notification-templates";

/**
 * GET /api/admin/email/catalog
 * Funnels, transactional/marketing metadata, and full template copy for the email settings UI.
 */
export async function GET(request: NextRequest) {
  const auth = await getAdminAuth(request);
  if (!auth?.ok) return adminAuthFailureResponse(auth);

  const templates = getAllNotificationTemplates();
  return NextResponse.json({
    funnels: ADMIN_EMAIL_FUNNELS,
    internalOnly: ADMIN_INTERNAL_EMAIL_KINDS,
    marketingExtra: ADMIN_MARKETING_EXTRA_KINDS,
    templates: {
      all: templates,
      marketing: templates.filter((t) => !t.transactional),
      transactional: templates.filter((t) => t.transactional),
    },
    transactional: ADMIN_TRANSACTIONAL_EMAIL_KINDS,
  });
}
