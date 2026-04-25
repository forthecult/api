import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { userTable } from "~/db/schema/users/tables";
import { auth } from "~/lib/auth";
import { csrfFailureResponse, verifyCsrfOrigin } from "~/lib/csrf";
import { combineToE164 } from "~/lib/phone-e164";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
  rateLimitResponse,
} from "~/lib/rate-limit";

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
      email: userTable.email,
      firstName: userTable.firstName,
      id: userTable.id,
      image: userTable.image,
      lastName: userTable.lastName,
      name: userTable.name,
      phone: userTable.phone,
      phoneCountry: userTable.phoneCountry,
      theme: userTable.theme,
    })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const theme =
    user.theme === "light" || user.theme === "dark" || user.theme === "system"
      ? user.theme
      : "system";

  return NextResponse.json({
    birthDate: "",
    email: user.email ?? "",
    firstName: user.firstName ?? "",
    id: user.id,
    image: user.image ?? null,
    lastName: user.lastName ?? "",
    name: user.name ?? "",
    phone: user.phone ?? "",
    phoneCountry: user.phoneCountry ?? "",
    theme,
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
    birthDate?: null | string;
    firstName?: string;
    image?: null | string;
    lastName?: string;
    phone?: null | string;
    phoneCountry?: null | string;
    phoneLocal?: null | string;
    theme?: "dark" | "light" | "system";
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updates: Record<string, null | string> = {};
  if (typeof body.firstName === "string") {
    updates.firstName = body.firstName.trim() || null;
  }
  if (typeof body.lastName === "string") {
    updates.lastName = body.lastName.trim() || null;
  }
  // Temporary compatibility: birthDate column may not exist in all DBs yet.
  // Keep accepting the field in payload for forward compatibility, but ignore it.
  if (body.image !== undefined) {
    updates.image =
      typeof body.image === "string" && body.image.trim()
        ? body.image.trim()
        : null;
  }
  if (body.phoneCountry !== undefined) {
    updates.phoneCountry =
      typeof body.phoneCountry === "string" && body.phoneCountry.trim()
        ? body.phoneCountry.trim().toUpperCase().slice(0, 2)
        : null;
  }
  if (
    body.phoneLocal !== undefined &&
    (typeof body.phoneLocal === "string" || body.phoneLocal === null)
  ) {
    let iso: string | undefined;
    if (typeof body.phoneCountry === "string" && body.phoneCountry.trim()) {
      iso = body.phoneCountry.trim().toUpperCase().slice(0, 2);
    } else {
      const [row] = await db
        .select({ phoneCountry: userTable.phoneCountry })
        .from(userTable)
        .where(eq(userTable.id, session.user.id))
        .limit(1);
      iso = row?.phoneCountry?.trim() || "US";
    }
    if (body.phoneLocal === null || (body.phoneLocal as string) === "") {
      updates.phone = null;
    } else if (typeof body.phoneLocal === "string" && iso) {
      const e164 = combineToE164(iso, body.phoneLocal);
      if (e164) updates.phone = e164;
      else {
        return NextResponse.json(
          { error: "Invalid phone number for selected country" },
          { status: 400 },
        );
      }
    }
  } else if (body.phone !== undefined) {
    updates.phone =
      typeof body.phone === "string" && body.phone.trim()
        ? body.phone.trim()
        : null;
  }
  if (
    body.theme === "light" ||
    body.theme === "dark" ||
    body.theme === "system"
  ) {
    updates.theme = body.theme;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 },
    );
  }

  // Also update the combined 'name' field for Better Auth session compatibility
  if (updates.firstName !== undefined || updates.lastName !== undefined) {
    // Get current values to combine with updates
    const [currentUser] = await db
      .select({ firstName: userTable.firstName, lastName: userTable.lastName })
      .from(userTable)
      .where(eq(userTable.id, session.user.id))
      .limit(1);

    const newFirstName =
      updates.firstName !== undefined
        ? updates.firstName
        : currentUser?.firstName;
    const newLastName =
      updates.lastName !== undefined ? updates.lastName : currentUser?.lastName;
    const combinedName =
      [newFirstName, newLastName].filter(Boolean).join(" ") || "User";
    updates.name = combinedName;
  }

  const [updated] = await db
    .update(userTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(userTable.id, session.user.id))
    .returning({
      firstName: userTable.firstName,
      id: userTable.id,
      image: userTable.image,
      lastName: userTable.lastName,
      name: userTable.name,
      phone: userTable.phone,
      phoneCountry: userTable.phoneCountry,
      theme: userTable.theme,
    });

  if (!updated) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const theme =
    updated.theme === "light" ||
    updated.theme === "dark" ||
    updated.theme === "system"
      ? updated.theme
      : "system";

  return NextResponse.json({
    birthDate: "",
    firstName: updated.firstName ?? "",
    image: updated.image ?? null,
    lastName: updated.lastName ?? "",
    name: updated.name ?? "",
    phone: updated.phone ?? "",
    phoneCountry: updated.phoneCountry ?? "",
    theme,
  });
}
