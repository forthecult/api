import { eq } from "drizzle-orm";
import { headers } from "next/headers";

import { db } from "~/db";
import { userTable } from "~/db/schema";
import { auth } from "~/lib/auth";

export type UserTheme = "dark" | "light" | "system";

/**
 * Server-only: returns the current session user's saved theme, or null if not logged in or no theme set.
 */
export async function getCurrentUserTheme(): Promise<null | UserTheme> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) return null;

    const [row] = await db
      .select({ theme: userTable.theme })
      .from(userTable)
      .where(eq(userTable.id, session.user.id))
      .limit(1);

    const t = row?.theme;
    if (t === "light" || t === "dark" || t === "system") return t;
    return null;
  } catch {
    return null;
  }
}
