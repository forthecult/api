import { type NextRequest, NextResponse } from "next/server";

import {
  getClientIp,
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from "~/lib/rate-limit";

const BODY_LIMIT = 10 * 1024; // 10 KB

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rateLimitResult = checkRateLimit(
    `contact:${ip}`,
    RATE_LIMITS.contact,
  );
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult);
  }

  try {
    const raw = await request.text();
    if (raw.length > BODY_LIMIT) {
      return NextResponse.json(
        { error: "Request body too large" },
        { status: 400 },
      );
    }
    const body = JSON.parse(raw) as unknown;
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const { name, email, subject, message } = body as Record<string, unknown>;
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (typeof email !== "string" || !email.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (typeof subject !== "string" || !subject.trim()) {
      return NextResponse.json(
        { error: "Subject is required" },
        { status: 400 },
      );
    }
    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 },
      );
    }

    // In development, log the message; in production, integrate your email provider (Resend, SendGrid, etc.)
    if (process.env.NODE_ENV === "development") {
      console.log("[Contact form]", {
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message:
          message.trim().slice(0, 200) +
          (message.trim().length > 200 ? "…" : ""),
      });
    }
    // TODO: In production, send email via Resend/SendGrid/etc. using CONTACT_TO_EMAIL or similar.

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Contact form error:", err);
    return NextResponse.json(
      { error: "Failed to send message. Please try again." },
      { status: 500 },
    );
  }
}
