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
  const rateLimitResult = await checkRateLimit(
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

    const to =
      (typeof process.env.CONTACT_TO_EMAIL === "string" &&
        process.env.CONTACT_TO_EMAIL.trim()) ||
      "support@forthecult.store";

    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        const from =
          typeof process.env.RESEND_FROM_EMAIL === "string" &&
          process.env.RESEND_FROM_EMAIL.length > 0
            ? process.env.RESEND_FROM_EMAIL.trim()
            : "onboarding@resend.dev";
        const safeMessage = message
          .trim()
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        const safeName = name
          .trim()
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        const safeEmail = email
          .trim()
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        const safeSubject = subject
          .trim()
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        const { error } = await resend.emails.send({
          from,
          to,
          replyTo: email.trim(),
          subject: `[Contact] ${subject.trim()}`,
          html: `<!DOCTYPE html><html><body><p><strong>From:</strong> ${safeName} &lt;${safeEmail}&gt;</p><p><strong>Subject:</strong> ${safeSubject}</p><hr/><pre style="white-space:pre-wrap;font-family:inherit;">${safeMessage}</pre></body></html>`,
          text: `From: ${name.trim()} <${email.trim()}>\nSubject: ${subject.trim()}\n\n${message.trim()}`,
        });
        if (error) {
          console.error("[Contact form] Resend error:", error);
          return NextResponse.json(
            { error: "Failed to send message. Please try again." },
            { status: 500 },
          );
        }
      } catch (err) {
        console.error("[Contact form] Resend send failed:", err);
        return NextResponse.json(
          { error: "Failed to send message. Please try again." },
          { status: 500 },
        );
      }
    } else if (process.env.NODE_ENV === "development") {
      console.log("[Contact form] No RESEND_API_KEY - would send to", to, {
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message:
          message.trim().slice(0, 200) +
          (message.trim().length > 200 ? "…" : ""),
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Contact form error:", err);
    return NextResponse.json(
      { error: "Failed to send message. Please try again." },
      { status: 500 },
    );
  }
}
