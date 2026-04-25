import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { runAdServerConversionsForOrder } from "~/lib/ad-server-conversions";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
  rateLimitResponse,
} from "~/lib/rate-limit";

const bodySchema = z.object({
  orderId: z.string().min(1).max(128),
});

/**
 * Internal replay / worker hook for server-side ad CAPI stub.
 * Auth: `Authorization: Bearer <INTERNAL_AD_CONVERSIONS_SECRET>`.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rl = await checkRateLimit(`internal-ad-conv:${ip}`, RATE_LIMITS.api);
  if (!rl.success) return rateLimitResponse(rl);

  const secret = process.env.INTERNAL_AD_CONVERSIONS_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "INTERNAL_AD_CONVERSIONS_SECRET is not configured" },
      { status: 503 },
    );
  }

  const auth = request.headers.get("authorization")?.trim();
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { details: parsed.error.flatten().fieldErrors, error: "Invalid body" },
      { status: 400 },
    );
  }

  await runAdServerConversionsForOrder(parsed.data.orderId);
  return NextResponse.json({ ok: true });
}
