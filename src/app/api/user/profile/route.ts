import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { userTable } from "~/db/schema/users/tables";
import { auth } from "~/lib/auth";
import { verifyCsrfOrigin, csrfFailureResponse } from "~/lib/csrf";
import { getClientIp, RATE_LIMITS, checkRateLimit, rateLimitResponse } from "~/lib/rate-limit";

/**
 * GET /api/user/profile
 * Returns current user's profile (firstName, lastName, image) for display/edit.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rl = await checkRateLimit(`user-profile:${ip}`, RATE_LIMITS.api);
  if (!rl.success) return rateLimitResponse(rl);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db
    .select({
      id: userTable.id,
      firstName: userTable.firstName,
      lastName: userTable.lastName,
      name: userTable.name,
      image: userTable.image,
      email: userTable.email,
      phone: userTable.phone,
    })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: user.id,
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    name: user.name ?? "",
    image: user.image ?? null,
    email: user.email ?? "",
    phone: user.phone ?? "",
  });
}

/**
 * PATCH /api/user/profile
 * Update current user's firstName, lastName, and/or image (URL).
 * Body: { firstName?: string, lastName?: string, image?: string | null }
 */
export async function PATCH(request: NextRequest) {
  // [SECURITY] Verify Origin header to prevent CSRF attacks (sameSite: "none" disables browser CSRF protection)
  if (!verifyCsrfOrigin(request.headers)) return csrfFailureResponse();
  const ip = getClientIp(request.headers);
  const rl = await checkRateLimit(`user-profile:${ip}`, RATE_LIMITS.api);
  if (!rl.success) return rateLimitResponse(rl);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    firstName?: string;
    lastName?: string;
    image?: string | null;
    phone?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updates: Record<string, string | null> = {};
  if (typeof body.firstName === "string") {
    updates.firstName = body.firstName.trim() || null;
  }
  if (typeof body.lastName === "string") {
    updates.lastName = body.lastName.trim() || null;
  }
  if (body.image !== undefined) {
    updates.image = typeof body.image === "string" && body.image.trim() ? body.image.trim() : null;
  }
  if (body.phone !== undefined) {
    updates.phone = typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // Also update the combined 'name' field for Better Auth session compatibility
  if (updates.firstName !== undefined || updates.lastName !== undefined) {
    // Get current values to combine with updates
    const [currentUser] = await db
      .select({ firstName: userTable.firstName, lastName: userTable.lastName })
      .from(userTable)
      .where(eq(userTable.id, session.user.id))
      .limit(1);
    
    const newFirstName = updates.firstName !== undefined ? updates.firstName : currentUser?.firstName;
    const newLastName = updates.lastName !== undefined ? updates.lastName : currentUser?.lastName;
    const combinedName = [newFirstName, newLastName].filter(Boolean).join(" ") || "User";
    updates.name = combinedName;
  }

  const [updated] = await db
    .update(userTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(userTable.id, session.user.id))
    .returning({
      id: userTable.id,
      firstName: userTable.firstName,
      lastName: userTable.lastName,
      name: userTable.name,
      image: userTable.image,
    });

  if (!updated) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    firstName: updated.firstName ?? "",
    lastName: updated.lastName ?? "",
    name: updated.name ?? "",
    image: updated.image ?? null,
  });
}
