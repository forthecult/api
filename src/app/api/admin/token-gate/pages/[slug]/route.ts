import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { pageTokenGateTable } from "~/db/schema";
import { getAdminAuth } from "~/lib/admin-api-auth";

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
    if (!authResult?.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug } = await params;
    const pageSlug = slug?.trim();
    if (!pageSlug) {
      return NextResponse.json(
        { error: "Slug required" },
        { status: 400 },
      );
    }

    const rows = await db
      .select({
        id: pageTokenGateTable.id,
        tokenSymbol: pageTokenGateTable.tokenSymbol,
        quantity: pageTokenGateTable.quantity,
        network: pageTokenGateTable.network,
        contractAddress: pageTokenGateTable.contractAddress,
      })
      .from(pageTokenGateTable)
      .where(eq(pageTokenGateTable.pageSlug, pageSlug));

    const gates = rows.map((r) => ({
      id: r.id,
      tokenSymbol: r.tokenSymbol,
      quantity: r.quantity,
      network: r.network ?? null,
      contractAddress: r.contractAddress ?? null,
    }));

    return NextResponse.json({ pageSlug, gates });
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
    if (!authResult?.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug } = await params;
    const pageSlug = slug?.trim();
    if (!pageSlug) {
      return NextResponse.json(
        { error: "Slug required" },
        { status: 400 },
      );
    }

    const body = (await request.json()) as {
      gates?: Array<{
        id?: string;
        tokenSymbol: string;
        quantity: number;
        network?: string | null;
        contractAddress?: string | null;
      }>;
    };

    const gates = Array.isArray(body.gates) ? body.gates : [];

    await db
      .delete(pageTokenGateTable)
      .where(eq(pageTokenGateTable.pageSlug, pageSlug));

    for (const gate of gates) {
      const symbol = String(gate.tokenSymbol ?? "").trim().toUpperCase();
      const qty = Number(gate.quantity);
      if (!symbol || !Number.isInteger(qty) || qty < 1) continue;
      await db.insert(pageTokenGateTable).values({
        id: gate.id ?? crypto.randomUUID(),
        pageSlug,
        tokenSymbol: symbol,
        quantity: qty,
        network: gate.network?.trim() || null,
        contractAddress: gate.contractAddress?.trim() || null,
      });
    }

    const rows = await db
      .select({
        id: pageTokenGateTable.id,
        tokenSymbol: pageTokenGateTable.tokenSymbol,
        quantity: pageTokenGateTable.quantity,
        network: pageTokenGateTable.network,
        contractAddress: pageTokenGateTable.contractAddress,
      })
      .from(pageTokenGateTable)
      .where(eq(pageTokenGateTable.pageSlug, pageSlug));

    const updatedGates = rows.map((r) => ({
      id: r.id,
      tokenSymbol: r.tokenSymbol,
      quantity: r.quantity,
      network: r.network ?? null,
      contractAddress: r.contractAddress ?? null,
    }));

    return NextResponse.json({ pageSlug, gates: updatedGates });
  } catch (err) {
    console.error("Admin page token gates patch error:", err);
    return NextResponse.json(
      { error: "Failed to save page token gates" },
      { status: 500 },
    );
  }
}
