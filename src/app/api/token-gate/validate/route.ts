import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { NextResponse } from "next/server";

import {
  buildTokenGateSetCookie,
  COOKIE_NAME as TOKEN_GATE_COOKIE_NAME,
} from "~/lib/token-gate-cookie";
import {
  getTokenGateConfig,
  walletPassesTokenGates,
  type TokenGateResourceType,
} from "~/lib/token-gate";

const MESSAGE_PREFIX = "Sign to prove wallet ownership for token gate:\n";
const CHALLENGE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

function getSignatureBytes(params: {
  signature?: string;
  signatureBase58?: string;
}): Uint8Array | null {
  if (params.signatureBase58) {
    try {
      const decoded = bs58.decode(params.signatureBase58);
      if (decoded.length < 64) return null;
      return decoded.length === 64 ? decoded : decoded.slice(0, 64);
    } catch {
      return null;
    }
  }
  if (params.signature) {
    try {
      const buf = Buffer.from(params.signature, "base64");
      if (buf.length < 64) return null;
      return new Uint8Array(buf.length === 64 ? buf : buf.subarray(0, 64));
    } catch {
      return null;
    }
  }
  return null;
}

/** Parse challenge message: timestamp always; resourceType/resourceId when present (bound signature). */
function parseMessagePayload(message: string): {
  timestamp: number | null;
  resourceType: string | null;
  resourceId: string | null;
} {
  if (!message.startsWith(MESSAGE_PREFIX)) {
    return { timestamp: null, resourceType: null, resourceId: null };
  }
  const rest = message.slice(MESSAGE_PREFIX.length).trim();
  let timestamp: number | null = null;
  let resourceType: string | null = null;
  let resourceId: string | null = null;
  for (const line of rest.split("\n")) {
    const t = line.trim();
    if (t.startsWith("resourceType: ")) {
      resourceType = t.slice("resourceType: ".length).trim();
    } else if (t.startsWith("resourceId: ")) {
      resourceId = t.slice("resourceId: ".length).trim();
    } else if (t.startsWith("timestamp: ")) {
      const date = new Date(t.slice("timestamp: ".length).trim());
      timestamp = Number.isNaN(date.getTime()) ? null : date.getTime();
    }
  }
  if (timestamp === null && resourceType === null && resourceId === null) {
    const date = new Date(rest);
    timestamp = Number.isNaN(date.getTime()) ? null : date.getTime();
  }
  return { timestamp, resourceType, resourceId };
}

function verifySolanaSignature(params: {
  address: string;
  message: string;
  signature?: string;
  signatureBase58?: string;
}): boolean {
  const signature = getSignatureBytes(params);
  if (!signature || signature.length !== 64) return false;
  try {
    const publicKey = new PublicKey(params.address);
    const publicKeyBytes = publicKey.toBytes();
    const messageBytes = new TextEncoder().encode(params.message);
    return nacl.sign.detached.verify(
      messageBytes,
      signature,
      publicKeyBytes,
    );
  } catch {
    return false;
  }
}

/**
 * POST /api/token-gate/validate
 * Body: { address, message, signature?, signatureBase58?, resourceType, resourceId }
 * Verifies wallet ownership (signature) and checks token balance for gates.
 * Returns { valid: boolean, passedGate?: { tokenSymbol, quantity } }.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      address?: string;
      message?: string;
      signature?: string;
      signatureBase58?: string;
      resourceType?: string;
      resourceId?: string;
    };

    const address = typeof body.address === "string" ? body.address.trim() : "";
    const message = typeof body.message === "string" ? body.message : "";
    const resourceType = (body.resourceType ?? "").toLowerCase() as
      | TokenGateResourceType
      | "";
    const resourceId = typeof body.resourceId === "string" ? body.resourceId.trim() : "";

    if (!address || !message) {
      return NextResponse.json(
        { error: "address and message required" },
        { status: 400 },
      );
    }
    if (!body.signature && !body.signatureBase58) {
      return NextResponse.json(
        { error: "signature or signatureBase58 required" },
        { status: 400 },
      );
    }
    if (!resourceType || !resourceId) {
      return NextResponse.json(
        { error: "resourceType and resourceId required" },
        { status: 400 },
      );
    }
    if (!["product", "category", "page"].includes(resourceType)) {
      return NextResponse.json(
        { error: "resourceType must be product, category, or page" },
        { status: 400 },
      );
    }

    const payload = parseMessagePayload(message);
    if (payload.timestamp === null) {
      return NextResponse.json(
        { error: "Invalid message format" },
        { status: 400 },
      );
    }
    if (Date.now() - payload.timestamp > CHALLENGE_MAX_AGE_MS) {
      return NextResponse.json(
        { error: "Challenge expired. Please request a new one." },
        { status: 400 },
      );
    }
    if (payload.resourceType != null && payload.resourceId != null) {
      const msgType = payload.resourceType.toLowerCase();
      const bodyType = resourceType.toLowerCase();
      if (msgType !== bodyType || payload.resourceId !== resourceId) {
        return NextResponse.json(
          { error: "Challenge was for a different resource. Sign again for this page." },
          { status: 400 },
        );
      }
    }

    const validSig = verifySolanaSignature({
      address,
      message,
      signature: body.signature,
      signatureBase58: body.signatureBase58,
    });
    if (!validSig) {
      return NextResponse.json(
        { error: "Invalid signature", valid: false },
        { status: 401 },
      );
    }

    const config = await getTokenGateConfig(
      resourceType as TokenGateResourceType,
      resourceId,
    );
    if (!config.tokenGated || config.gates.length === 0) {
      return NextResponse.json({
        valid: true,
        passedGate: null,
        message: "Resource is not token gated",
      });
    }

    const { valid, passedGate } = await walletPassesTokenGates(
      address,
      config.gates,
    );

    if (!valid) {
      const splGates = config.gates.filter((g) => g.gateType === "spl" && g.mintOrContract);
      const checkedMints = splGates.map((g) => g.mintOrContract);
      if (process.env.NODE_ENV === "development" && checkedMints.length > 0) {
        console.info(
          "[token-gate] Validation failed for wallet. Checked mints:",
          checkedMints,
          "| Set CULT_TOKEN_MINT_SOLANA or gate Contract Address to the mint your token uses.",
        );
      }
      return NextResponse.json({
        valid: false,
        passedGate: null,
        error:
          "We couldn't verify your token balance. Connect the wallet that holds the required tokens and try again.",
      });
    }

    const currentCookie = request.headers.get("cookie") ?? "";
    const cookieMatch = currentCookie
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(`${TOKEN_GATE_COOKIE_NAME}=`));
    const currentValue = cookieMatch
      ? decodeURIComponent(cookieMatch.slice(TOKEN_GATE_COOKIE_NAME.length + 1).trim())
      : undefined;

    const setCookie = buildTokenGateSetCookie(
      currentValue,
      resourceType as TokenGateResourceType,
      resourceId,
    );

    const res = NextResponse.json({
      valid: true,
      passedGate: passedGate
        ? {
            tokenSymbol: passedGate.tokenSymbol,
            quantity: passedGate.quantity,
          }
        : null,
    });
    res.headers.append("Set-Cookie", setCookie);
    return res;
  } catch (err) {
    console.error("Token gate validate error:", err);
    return NextResponse.json(
      { error: "Validation failed", valid: false },
      { status: 500 },
    );
  }
}
