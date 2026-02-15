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
    const message = buildMessage(resourceType, resourceId);
    return NextResponse.json({ message });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

/** Build challenge message; when resourceType/resourceId are provided, bind signature to that resource (replay protection). */
function buildMessage(resourceType: string, resourceId: string): string {
  const timestamp = new Date().toISOString();
  if (!resourceType || !resourceId) {
    return MESSAGE_PREFIX + timestamp;
  }
  return `${MESSAGE_PREFIX}resourceType: ${resourceType}\nresourceId: ${resourceId}\ntimestamp: ${timestamp}`;
}
