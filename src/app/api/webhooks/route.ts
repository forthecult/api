import { createId } from "@paralleldrive/cuid2";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { webhookRegistrationsTable } from "~/db/schema";

/**
 * Register a webhook URL to receive POST notifications when order status changes.
 * POST /api/webhooks
 * Body: { url: string, secret?: string, events?: string }
 * Avoids polling for AI agents.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      url?: string;
      secret?: string;
      events?: string;
    };
    const url =
      typeof body.url === "string" && body.url.trim() ? body.url.trim() : "";
    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "url must be a valid URL" },
        { status: 400 },
      );
    }

    const id = createId();
    const now = new Date();
    await db.insert(webhookRegistrationsTable).values({
      id,
      url,
      secret: typeof body.secret === "string" ? body.secret : null,
      events:
        typeof body.events === "string" && body.events.trim()
          ? body.events.trim()
          : "order.updated",
      createdAt: now,
    });

    return NextResponse.json({
      id,
      url,
      events: "order.updated",
      message:
        "Webhook registered. You will receive POST requests when order status changes.",
    });
  } catch (err) {
    console.error("Webhook registration error:", err);
    return NextResponse.json(
      { error: "Failed to register webhook" },
      { status: 500 },
    );
  }
}
