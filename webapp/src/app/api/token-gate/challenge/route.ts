import { NextResponse } from "next/server";

const MESSAGE_PREFIX = "Sign to prove wallet ownership for token gate:\n";

/**
 * POST /api/token-gate/challenge
 * Body: { address: string, resourceType?: string, resourceId?: string }
 * Returns a message to sign. Include resourceType and resourceId to bind the signature to one resource (recommended).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      address?: string;
      resourceId?: string;
      resourceType?: string;
    };
    const address = typeof body.address === "string" ? body.address.trim() : "";
    if (!address || address.length < 32) {
      return NextResponse.json(
        { error: "address required (Solana wallet)" },
        { status: 400 },
      );
    }
    const resourceType =
      typeof body.resourceType === "string" ? body.resourceType.trim() : "";
    const resourceId =
      typeof body.resourceId === "string" ? body.resourceId.trim() : "";
    // l1: bind every challenge to a resource. the validate route also enforces
    // this; rejecting here surfaces misuse earlier with a clearer error.
    if (!resourceType || !resourceId) {
      return NextResponse.json(
        { error: "resourceType and resourceId required" },
        { status: 400 },
      );
    }
    if (!["category", "page", "product"].includes(resourceType.toLowerCase())) {
      return NextResponse.json(
        { error: "resourceType must be product, category, or page" },
        { status: 400 },
      );
    }
    const message = buildMessage(resourceType, resourceId);
    return NextResponse.json({ message });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

function buildMessage(resourceType: string, resourceId: string): string {
  const timestamp = new Date().toISOString();
  return `${MESSAGE_PREFIX}resourceType: ${resourceType}\nresourceId: ${resourceId}\ntimestamp: ${timestamp}`;
}
