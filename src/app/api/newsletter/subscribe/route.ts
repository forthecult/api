import { type NextRequest, NextResponse } from "next/server";

import {
  publicApiCorsPreflight,
  withPublicApiCors,
} from "~/lib/cors-public-api";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
  rateLimitResponse,
} from "~/lib/rate-limit";

interface SubscribeBody {
  email?: string;
}

export async function OPTIONS() {
  return publicApiCorsPreflight();
}

/**
 * POST /api/newsletter/subscribe
 * Subscribe an email to the newsletter.
 * Body: { email: string }
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rl = await checkRateLimit(`newsletter:${ip}`, RATE_LIMITS.api);
  if (!rl.success) return rateLimitResponse(rl);

  try {
    const body = (await request.json()) as SubscribeBody;
    const email = body.email?.trim().toLowerCase();

    if (!email) {
      return withPublicApiCors(
        NextResponse.json({ error: "Email is required" }, { status: 400 }),
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return withPublicApiCors(
        NextResponse.json({ error: "Invalid email address" }, { status: 400 }),
      );
    }

    // TODO: Integrate with actual newsletter service (e.g., Resend, Mailchimp, ConvertKit)
    // For now, just log and return success
    console.log(`[Newsletter] Subscribe request: ${email}`);

    return withPublicApiCors(
      NextResponse.json({
        message: "Successfully subscribed to newsletter",
        success: true,
      }),
    );
  } catch (err) {
    console.error("Newsletter subscribe error:", err);
    return withPublicApiCors(
      NextResponse.json({ error: "Failed to subscribe" }, { status: 500 }),
    );
  }
}
