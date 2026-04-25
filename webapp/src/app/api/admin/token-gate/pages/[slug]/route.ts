import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { pageTokenGateTable } from "~/db/schema";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";

/**
 * GET /api/admin/token-gate/pages/[slug]
 * Returns token gates for the page slug.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const authResult = await getAdminAuth(_request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const { slug } = await params;
    const pageSlug = slug?.trim();
    if (!pageSlug) {
      return NextResponse.json({ error: "Slug required" }, { status: 400 });
    }

    const rows = await db
      .select({
        contractAddress: pageTokenGateTable.contractAddress,
        id: pageTokenGateTable.id,
        network: pageTokenGateTable.network,
        quantity: pageTokenGateTable.quantity,
        tokenSymbol: pageTokenGateTable.tokenSymbol,
      })
      .from(pageTokenGateTable)
      .where(eq(pageTokenGateTable.pageSlug, pageSlug));

    const gates = rows.map((r) => ({
      contractAddress: r.contractAddress ?? null,
      id: r.id,
      network: r.network ?? null,
      quantity: r.quantity,
      tokenSymbol: r.tokenSymbol,
    }));

    return NextResponse.json({ gates, pageSlug });
  } catch (err) {
    console.error("Admin page token gates get error:", err);
    return NextResponse.json(
      { error: "Failed to load page token gates" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/admin/token-gate/pages/[slug]
 * Body: { gates: Array<{ id?: string; tokenSymbol: string; quantity: number; network?: string | null; contractAddress?: string | null }> }
 * Replaces all token gates for this page slug.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const { slug } = await params;
    const pageSlug = slug?.trim();
    if (!pageSlug) {
      return NextResponse.json({ error: "Slug required" }, { status: 400 });
    }

    const body = (await request.json()) as {
      gates?: {
        contractAddress?: null | string;
        id?: string;
        network?: null | string;
        quantity: number;
        tokenSymbol: string;
      }[];
    };

    const gates = Array.isArray(body.gates) ? body.gates : [];

    await db
      .delete(pageTokenGateTable)
      .where(eq(pageTokenGateTable.pageSlug, pageSlug));

    for (const gate of gates) {
      const symbol = String(gate.tokenSymbol ?? "")
        .trim()
        .toUpperCase();
      const qty = Number(gate.quantity);
      if (!symbol || !Number.isInteger(qty) || qty < 1) continue;
      await db.insert(pageTokenGateTable).values({
        contractAddress: gate.contractAddress?.trim() || null,
        id: gate.id ?? crypto.randomUUID(),
        network: gate.network?.trim() || null,
        pageSlug,
        quantity: qty,
        tokenSymbol: symbol,
      });
    }

    const rows = await db
      .select({
        contractAddress: pageTokenGateTable.contractAddress,
        id: pageTokenGateTable.id,
        network: pageTokenGateTable.network,
        quantity: pageTokenGateTable.quantity,
        tokenSymbol: pageTokenGateTable.tokenSymbol,
      })
      .from(pageTokenGateTable)
      .where(eq(pageTokenGateTable.pageSlug, pageSlug));

    const updatedGates = rows.map((r) => ({
      contractAddress: r.contractAddress ?? null,
      id: r.id,
      network: r.network ?? null,
      quantity: r.quantity,
      tokenSymbol: r.tokenSymbol,
    }));

    return NextResponse.json({ gates: updatedGates, pageSlug });
  } catch (err) {
    console.error("Admin page token gates patch error:", err);
    return NextResponse.json(
      { error: "Failed to save page token gates" },
      { status: 500 },
    );
  }
}
