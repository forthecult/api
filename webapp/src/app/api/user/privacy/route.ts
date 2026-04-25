import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "~/db";
import { userTable } from "~/db/schema";
import { auth } from "~/lib/auth";
import { csrfFailureResponse, verifyCsrfOrigin } from "~/lib/csrf";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
  rateLimitResponse,
} from "~/lib/rate-limit";

const patchSchema = z.object({
  adPlatformConversionForwarding: z.boolean().optional(),
});

/**
 * GET /api/user/privacy — current user’s ad CAPI forwarding preference.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rl = await checkRateLimit(`user-privacy:${ip}`, RATE_LIMITS.api);
  if (!rl.success) return rateLimitResponse(rl);

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [row] = await db
    .select({
      adPlatformConversionForwarding: userTable.adPlatformConversionForwarding,
    })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1);

  return NextResponse.json({
    adPlatformConversionForwarding: row?.adPlatformConversionForwarding ?? true,
  });
}

/**
 * PATCH /api/user/privacy — update ad CAPI forwarding (server-side opt-out).
 */
export async function PATCH(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rl = await checkRateLimit(`user-privacy:${ip}`, RATE_LIMITS.api);
  if (!rl.success) return rateLimitResponse(rl);

  if (!verifyCsrfOrigin(request.headers)) return csrfFailureResponse();

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { details: parsed.error.flatten().fieldErrors, error: "Invalid body" },
      { status: 400 },
    );
  }

  if (parsed.data.adPlatformConversionForwarding === undefined) {
    return NextResponse.json({ error: "No updates" }, { status: 400 });
  }

  await db
    .update(userTable)
    .set({
      adPlatformConversionForwarding:
        parsed.data.adPlatformConversionForwarding,
      updatedAt: new Date(),
    })
    .where(eq(userTable.id, session.user.id));

  return NextResponse.json({
    adPlatformConversionForwarding: parsed.data.adPlatformConversionForwarding,
  });
}
