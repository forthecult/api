import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { productReviewsTable } from "~/db/schema";
import { getAdminAuth } from "~/lib/admin-api-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = (await request.json()) as { visible?: boolean };
    if (typeof body.visible !== "boolean") {
      return NextResponse.json(
        { error: "visible must be a boolean" },
        { status: 400 },
      );
    }

    const [updated] = await db
      .update(productReviewsTable)
      .set({
        visible: body.visible,
        updatedAt: new Date(),
      })
      .where(eq(productReviewsTable.id, id))
      .returning({
        id: productReviewsTable.id,
        visible: productReviewsTable.visible,
      });

    if (!updated) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Admin review update error:", err);
    return NextResponse.json(
      { error: "Failed to update review" },
      { status: 500 },
    );
  }
}
