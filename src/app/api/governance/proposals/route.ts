/**
 * GET: list governance proposals (active + ended; exclude draft).
 * POST: create a new proposal (optional: restrict to admin later).
 */

import { createId } from "@paralleldrive/cuid2";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { db } from "~/db";
import { governanceProposalTable } from "~/db/schema";
import { getAdminAuth, adminAuthFailureResponse } from "~/lib/admin-api-auth";

const createProposalSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().min(1).max(10000),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  createdBy: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status"); // optional: "active" | "ended" | omit for both
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));
  const offset = (page - 1) * limit;

  try {
    // Lazy-update: mark active proposals as ended when endAt has passed
    const now = new Date();
    await db
      .update(governanceProposalTable)
      .set({ status: "ended", updatedAt: now })
      .where(
        and(
          eq(governanceProposalTable.status, "active"),
          lt(governanceProposalTable.endAt, now),
        ),
      );

    const where =
      status === "active"
        ? eq(governanceProposalTable.status, "active")
        : status === "ended"
          ? eq(governanceProposalTable.status, "ended")
          : inArray(governanceProposalTable.status, ["active", "ended"]);

    const proposals = await db
      .select()
      .from(governanceProposalTable)
      .where(where)
      .orderBy(desc(governanceProposalTable.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({ proposals, page, limit });
  } catch (e) {
    console.error("[governance] list proposals error:", e);
    return NextResponse.json(
      { error: "Failed to list proposals" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) return adminAuthFailureResponse(authResult);

  try {
    const body = await request.json();
    const parsed = createProposalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { title, description, startAt, endAt, createdBy } = parsed.data;
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (end <= start) {
      return NextResponse.json(
        { error: "endAt must be after startAt" },
        { status: 400 },
      );
    }
    const now = new Date();
    const id = createId();
    const status = start > now ? "draft" : end < now ? "ended" : "active";

    await db.insert(governanceProposalTable).values({
      id,
      title,
      description,
      status,
      startAt: start,
      endAt: end,
      createdAt: now,
      updatedAt: now,
      createdBy: createdBy ?? null,
    });

    return NextResponse.json({ id, status });
  } catch (e) {
    console.error("[governance] create proposal error:", e);
    return NextResponse.json(
      { error: "Failed to create proposal" },
      { status: 500 },
    );
  }
}
