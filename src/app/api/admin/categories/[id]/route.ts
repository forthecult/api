import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { categoriesTable, categoryTokenGateTable } from "~/db/schema";
import { auth, isAdminUser } from "~/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: _request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const [category] = await db
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, id))
      .limit(1);

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 },
      );
    }

    const tokenGatesRows = await db
      .select({
        id: categoryTokenGateTable.id,
        tokenSymbol: categoryTokenGateTable.tokenSymbol,
        quantity: categoryTokenGateTable.quantity,
        network: categoryTokenGateTable.network,
        contractAddress: categoryTokenGateTable.contractAddress,
      })
      .from(categoryTokenGateTable)
      .where(eq(categoryTokenGateTable.categoryId, id));

    const tokenGates = tokenGatesRows.map((r) => ({
      id: r.id,
      tokenSymbol: r.tokenSymbol,
      quantity: r.quantity,
      network: r.network ?? null,
      contractAddress: r.contractAddress ?? null,
    }));

    return NextResponse.json({
      id: category.id,
      name: category.name,
      slug: category.slug,
      title: category.title,
      metaDescription: category.metaDescription,
      description: category.description,
      imageUrl: category.imageUrl,
      level: category.level,
      featured: category.featured,
      parentId: category.parentId,
      tokenGated: tokenGates.length > 0 || category.tokenGated,
      tokenGateType: category.tokenGateType,
      tokenGateQuantity: category.tokenGateQuantity,
      tokenGateNetwork: category.tokenGateNetwork,
      tokenGateContractAddress: category.tokenGateContractAddress,
      tokenGates,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    });
  } catch (err) {
    console.error("Admin category get error:", err);
    return NextResponse.json(
      { error: "Failed to load category" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = (await request.json()) as {
      name?: string;
      slug?: string | null;
      title?: string | null;
      metaDescription?: string | null;
      description?: string | null;
      imageUrl?: string | null;
      level?: number;
      featured?: boolean;
      parentId?: string | null;
      tokenGated?: boolean;
      tokenGateType?: string | null;
      tokenGateQuantity?: number | null;
      tokenGateNetwork?: string | null;
      tokenGateContractAddress?: string | null;
      tokenGates?: Array<{
        id?: string;
        tokenSymbol: string;
        quantity: number;
        network?: string | null;
        contractAddress?: string | null;
      }>;
    };

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.name === "string") updates.name = body.name;
    if (body.slug !== undefined) updates.slug = body.slug ?? null;
    if (body.title !== undefined) updates.title = body.title ?? null;
    if (body.metaDescription !== undefined)
      updates.metaDescription = body.metaDescription ?? null;
    if (body.description !== undefined)
      updates.description = body.description ?? null;
    if (body.imageUrl !== undefined) updates.imageUrl = body.imageUrl ?? null;
    if (typeof body.level === "number") updates.level = body.level;
    if (typeof body.featured === "boolean") updates.featured = body.featured;
    if (body.parentId !== undefined) updates.parentId = body.parentId ?? null;
    if (typeof body.tokenGated === "boolean")
      updates.tokenGated = body.tokenGated;
    if (body.tokenGateType !== undefined)
      updates.tokenGateType = body.tokenGateType ?? null;
    if (body.tokenGateQuantity !== undefined)
      updates.tokenGateQuantity = body.tokenGateQuantity ?? null;
    if (body.tokenGateNetwork !== undefined)
      updates.tokenGateNetwork = body.tokenGateNetwork ?? null;
    if (body.tokenGateContractAddress !== undefined)
      updates.tokenGateContractAddress = body.tokenGateContractAddress ?? null;

    if (body.tokenGates !== undefined) {
      updates.tokenGated = body.tokenGates.length > 0;
    }

    const [updated] = await db
      .update(categoriesTable)
      .set(updates as Record<string, unknown>)
      .where(eq(categoriesTable.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 },
      );
    }

    // When token gating is explicitly disabled, clear gate rows so the category is not gated
    // even if tokenGates was not sent (e.g. client only sent tokenGated: false).
    if (body.tokenGated === false) {
      await db
        .delete(categoryTokenGateTable)
        .where(eq(categoryTokenGateTable.categoryId, id));
    }

    if (body.tokenGates !== undefined) {
      await db
        .delete(categoryTokenGateTable)
        .where(eq(categoryTokenGateTable.categoryId, id));
      for (const gate of body.tokenGates) {
        const symbol = String(gate.tokenSymbol ?? "")
          .trim()
          .toUpperCase();
        const qty = Number(gate.quantity);
        if (!symbol || !Number.isInteger(qty) || qty < 1) continue;
        await db.insert(categoryTokenGateTable).values({
          id: gate.id ?? crypto.randomUUID(),
          categoryId: id,
          tokenSymbol: symbol,
          quantity: qty,
          network: gate.network?.trim() || null,
          contractAddress: gate.contractAddress?.trim() || null,
        });
      }
    }

    const tokenGatesRows = await db
      .select({
        id: categoryTokenGateTable.id,
        tokenSymbol: categoryTokenGateTable.tokenSymbol,
        quantity: categoryTokenGateTable.quantity,
        network: categoryTokenGateTable.network,
        contractAddress: categoryTokenGateTable.contractAddress,
      })
      .from(categoryTokenGateTable)
      .where(eq(categoryTokenGateTable.categoryId, id));

    const tokenGates = tokenGatesRows.map((r) => ({
      id: r.id,
      tokenSymbol: r.tokenSymbol,
      quantity: r.quantity,
      network: r.network ?? null,
      contractAddress: r.contractAddress ?? null,
    }));

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      title: updated.title,
      metaDescription: updated.metaDescription,
      description: updated.description,
      imageUrl: updated.imageUrl,
      level: updated.level,
      featured: updated.featured,
      parentId: updated.parentId,
      tokenGated: tokenGates.length > 0 || updated.tokenGated,
      tokenGateType: updated.tokenGateType,
      tokenGateQuantity: updated.tokenGateQuantity,
      tokenGateNetwork: updated.tokenGateNetwork,
      tokenGateContractAddress: updated.tokenGateContractAddress,
      tokenGates,
      updatedAt: updated.updatedAt,
    });
  } catch (err) {
    console.error("Admin category update error:", err);
    return NextResponse.json(
      { error: "Failed to update category" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: _request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // unlink children so we can delete the category
    await db
      .update(categoriesTable)
      .set({ parentId: null, updatedAt: new Date() })
      .where(eq(categoriesTable.parentId, id));

    const [deleted] = await db
      .delete(categoriesTable)
      .where(eq(categoriesTable.id, id))
      .returning({ id: categoriesTable.id });

    if (!deleted) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin category delete error:", err);
    return NextResponse.json(
      { error: "Failed to delete category" },
      { status: 500 },
    );
  }
}
