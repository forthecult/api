import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { newsletterSubscriberTable, userTable } from "~/db/schema";
import { captureServerEvent } from "~/lib/analytics/posthog-server";
import { resolveUserIdByEmail } from "~/lib/email/consent";
import { upsertSuppression } from "~/lib/email/suppression";
import { verifyUnsubscribeToken } from "~/lib/email/unsubscribe-token";

/**
 * GET — confirmation page (RFC 8058 recommends POST for one-click; we show a confirm button).
 * POST — one-click unsubscribe (List-Unsubscribe-Post).
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!token) {
    return htmlPage("<p>Missing token.</p>", 400);
  }
  const v = verifyUnsubscribeToken(token);
  if (!v.ok) {
    return htmlPage("<p>This link is invalid or expired.</p>", 400);
  }
  return htmlPage(
    `<h1>Unsubscribe</h1><p>Stop marketing email to <strong>${v.payload.email}</strong>?</p>
     <form method="post" action="/api/email/unsubscribe">
       <input type="hidden" name="token" value="${encodeURIComponent(token)}" />
       <button type="submit" style="padding:12px 20px;background:#0f172a;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600">Unsubscribe</button>
     </form>`,
    200,
  );
}

export async function POST(request: NextRequest) {
  let token = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/x-www-form-urlencoded")) {
    const text = await request.text();
    const params = new URLSearchParams(text);
    if (params.get("List-Unsubscribe") === "One-Click") {
      token = params.get("token")?.trim() ?? "";
    } else {
      token = params.get("token")?.trim() ?? "";
    }
  } else {
    try {
      const json = (await request.json()) as { token?: string };
      const jt = typeof json.token === "string" ? json.token.trim() : "";
      if (jt) token = jt;
    } catch {
      /* keep query token */
    }
  }

  if (!token) {
    return htmlPage("<p>Missing token.</p>", 400);
  }

  const result = await performUnsubscribe(token);
  if (!result.ok) {
    return htmlPage(
      `<p>Could not unsubscribe (${result.error ?? "error"}).</p>`,
      400,
    );
  }
  return htmlPage("<p>You’ve been unsubscribed.</p>", 200);
}

function htmlPage(body: string, status = 200): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Unsubscribe</title></head><body style="font-family:system-ui,sans-serif;max-width:520px;margin:48px auto;padding:0 16px">${body}</body></html>`,
    {
      headers: { "Content-Type": "text/html; charset=utf-8" },
      status,
    },
  );
}

async function performUnsubscribe(
  token: string,
): Promise<{ error?: string; ok: boolean }> {
  const verified = verifyUnsubscribeToken(token);
  if (!verified.ok) {
    return { error: verified.error, ok: false };
  }
  const { category, email } = verified.payload;

  await upsertSuppression({
    email,
    notes: `unsubscribe:${category}`,
    reason: "unsubscribed",
    source: "one_click",
  });

  const userId = await resolveUserIdByEmail(email);
  if (userId) {
    await db
      .update(userTable)
      .set({ marketingEmail: false, updatedAt: new Date() })
      .where(eq(userTable.id, userId));
  }

  if (category === "newsletter") {
    await db
      .update(newsletterSubscriberTable)
      .set({
        status: "unsubscribed",
        unsubscribedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(newsletterSubscriberTable.email, email.toLowerCase()));
  }

  captureServerEvent(userId ?? email, "email_unsubscribed", { category });
  return { ok: true };
}
