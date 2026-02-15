import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { categoriesTable, categoryTokenGateTable } from "~/db/schema";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAdminAuth(_request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAdminAuth(_request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const { id } = await params;
    const [category] = await db
      .select({
        createdAt: categoriesTable.createdAt,
        description: categoriesTable.description,
        featured: categoriesTable.featured,
        id: categoriesTable.id,
        imageUrl: categoriesTable.imageUrl,
        level: categoriesTable.level,
        metaDescription: categoriesTable.metaDescription,
        name: categoriesTable.name,
        parentId: categoriesTable.parentId,
        seoOptimized: categoriesTable.seoOptimized,
        slug: categoriesTable.slug,
        title: categoriesTable.title,
        tokenGateContractAddress: categoriesTable.tokenGateContractAddress,
        tokenGated: categoriesTable.tokenGated,
        tokenGateNetwork: categoriesTable.tokenGateNetwork,
        tokenGateQuantity: categoriesTable.tokenGateQuantity,
        tokenGateType: categoriesTable.tokenGateType,
        updatedAt: categoriesTable.updatedAt,
        visible: categoriesTable.visible,
      })
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
        contractAddress: categoryTokenGateTable.contractAddress,
        id: categoryTokenGateTable.id,
        network: categoryTokenGateTable.network,
        quantity: categoryTokenGateTable.quantity,
        tokenSymbol: categoryTokenGateTable.tokenSymbol,
      })
      .from(categoryTokenGateTable)
      .where(eq(categoryTokenGateTable.categoryId, id));

    const tokenGates = tokenGatesRows.map((r) => ({
      contractAddress: r.contractAddress ?? null,
      id: r.id,
      network: r.network ?? null,
      quantity: r.quantity,
      tokenSymbol: r.tokenSymbol,
    }));

    return NextResponse.json({
      createdAt: category.createdAt,
      description: category.description,
      featured: category.featured,
      id: category.id,
      imageUrl: category.imageUrl,
      level: category.level,
      metaDescription: category.metaDescription,
      name: category.name,
      parentId: category.parentId,
      seoOptimized: category.seoOptimized,
      slug: category.slug,
      title: category.title,
      tokenGateContractAddress: category.tokenGateContractAddress,
      tokenGated: tokenGates.length > 0 || category.tokenGated,
      tokenGateNetwork: category.tokenGateNetwork,
      tokenGateQuantity: category.tokenGateQuantity,
      tokenGates,
      tokenGateType: category.tokenGateType,
      updatedAt: category.updatedAt,
      visible: category.visible ?? true,
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
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const { id } = await params;
    const body = (await request.json()) as {
      description?: null | string;
      featured?: boolean;
      imageUrl?: null | string;
      level?: number;
      metaDescription?: null | string;
      name?: string;
      parentId?: null | string;
      seoOptimized?: boolean;
      slug?: null | string;
      title?: null | string;
      tokenGateContractAddress?: null | string;
      tokenGated?: boolean;
      tokenGateNetwork?: null | string;
      tokenGateQuantity?: null | number;
      tokenGates?: {
        contractAddress?: null | string;
        id?: string;
        network?: null | string;
        quantity: number;
        tokenSymbol: string;
      }[];
      tokenGateType?: null | string;
      visible?: boolean;
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
    if (typeof body.visible === "boolean") updates.visible = body.visible;
    if (typeof body.seoOptimized === "boolean")
      updates.seoOptimized = body.seoOptimized;
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
          categoryId: id,
          contractAddress: gate.contractAddress?.trim() || null,
          id: gate.id ?? crypto.randomUUID(),
          network: gate.network?.trim() || null,
          quantity: qty,
          tokenSymbol: symbol,
        });
      }
    }

    const tokenGatesRows = await db
      .select({
        contractAddress: categoryTokenGateTable.contractAddress,
        id: categoryTokenGateTable.id,
        network: categoryTokenGateTable.network,
        quantity: categoryTokenGateTable.quantity,
        tokenSymbol: categoryTokenGateTable.tokenSymbol,
      })
      .from(categoryTokenGateTable)
      .where(eq(categoryTokenGateTable.categoryId, id));

    const tokenGates = tokenGatesRows.map((r) => ({
      contractAddress: r.contractAddress ?? null,
      id: r.id,
      network: r.network ?? null,
      quantity: r.quantity,
      tokenSymbol: r.tokenSymbol,
    }));

    return NextResponse.json({
      description: updated.description,
      featured: updated.featured,
      id: updated.id,
      imageUrl: updated.imageUrl,
      level: updated.level,
      metaDescription: updated.metaDescription,
      name: updated.name,
      parentId: updated.parentId,
      seoOptimized: updated.seoOptimized,
      slug: updated.slug,
      title: updated.title,
      tokenGateContractAddress: updated.tokenGateContractAddress,
      tokenGated: tokenGates.length > 0 || updated.tokenGated,
      tokenGateNetwork: updated.tokenGateNetwork,
      tokenGateQuantity: updated.tokenGateQuantity,
      tokenGates,
      tokenGateType: updated.tokenGateType,
      updatedAt: updated.updatedAt,
      visible: updated.visible ?? true,
    });
  } catch (err) {
    console.error("Admin category update error:", err);
    return NextResponse.json(
      { error: "Failed to update category" },
      { status: 500 },
    );
  }
}
