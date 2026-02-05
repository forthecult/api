import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { auth, isAdminUser } from "~/lib/auth";

type User = {
  id: string;
  email?: string;
  name?: string;
  image?: string | null;
};

type AuthResult =
  | { ok: true; user: User }
  | { ok: false; response: NextResponse };

type AdminAuthResult =
  | { ok: true; user: User }
  | { ok: false; response: NextResponse };

/**
 * Require user authentication for an API route.
 * Returns the user if authenticated, or an error response if not.
 *
 * @example
 * export async function GET(request: NextRequest) {
 *   const authResult = await requireAuth(request);
 *   if (!authResult.ok) return authResult.response;
 *   const { user } = authResult;
 *   // ... use user.id, user.email, etc.
 * }
 */
export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 },
        ),
      };
    }
    return { ok: true, user: session.user };
  } catch (error) {
    console.error("Auth error:", error);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Authentication failed" },
        { status: 401 },
      ),
    };
  }
}

/**
 * Require admin authentication for an API route.
 * Returns the user if authenticated and is an admin, or an error response if not.
 *
 * @example
 * export async function GET(request: NextRequest) {
 *   const authResult = await requireAdmin(request);
 *   if (!authResult.ok) return authResult.response;
 *   const { user } = authResult;
 *   // ... admin-only logic
 * }
 */
export async function requireAdmin(
  request: NextRequest,
): Promise<AdminAuthResult> {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult;

  if (!isAdminUser(authResult.user)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return authResult;
}

/**
 * Get the current user session without requiring authentication.
 * Returns null if not authenticated.
 *
 * @example
 * export async function GET(request: NextRequest) {
 *   const user = await getOptionalUser(request);
 *   if (user) {
 *     // User is logged in
 *   } else {
 *     // Anonymous user
 *   }
 * }
 */
export async function getOptionalUser(
  request: NextRequest,
): Promise<User | null> {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    return session?.user ?? null;
  } catch {
    return null;
  }
}

interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

/**
 * Parse pagination parameters from request URL.
 * Returns validated page, limit, and calculated offset.
 *
 * @example
 * export async function GET(request: NextRequest) {
 *   const { page, limit, offset } = parsePagination(request, { defaultLimit: 20, maxLimit: 100 });
 *   const items = await db.select().from(table).limit(limit).offset(offset);
 * }
 */
export function parsePagination(
  request: NextRequest,
  options: { defaultLimit?: number; maxLimit?: number } = {},
): PaginationParams {
  const { defaultLimit = 20, maxLimit = 100 } = options;
  const { searchParams } = request.nextUrl;

  const page = Math.max(
    1,
    Number.parseInt(searchParams.get("page") ?? "1", 10) || 1,
  );
  const limit = Math.min(
    maxLimit,
    Math.max(
      1,
      Number.parseInt(searchParams.get("limit") ?? String(defaultLimit), 10) ||
        defaultLimit,
    ),
  );
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}
