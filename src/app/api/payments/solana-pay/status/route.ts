import { findReference, validateTransfer } from "@solana/pay";
import { Connection, PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";
import BigNumber from "bignumber.js";

import {
  getSolanaRpcUrlServer,
  CRUST_MINT_MAINNET,
  PUMP_MINT_MAINNET,
  USDC_MINT_MAINNET,
  WHITEWHALE_MINT_MAINNET,
} from "~/lib/solana-pay";

export const dynamic = "force-dynamic";

/** check for a confirmed transfer to depositAddress (works for manual paste — no reference needed) */
async function findTransferToAddress(
  connection: Connection,
  depositAddress: PublicKey,
  amountBn: BigNumber,
  splTokenMint: string,
): Promise<string | null> {
  // Use "confirmed" commitment so we see the tx within ~1–2s of user sending,
  // instead of waiting for "finalized" (default), which can delay detection.
  const sigs = await connection.getSignaturesForAddress(
    depositAddress,
    { limit: 30 },
    "confirmed",
  );
  const splTokenPk = new PublicKey(splTokenMint);
  for (const { signature } of sigs) {
    try {
      await validateTransfer(connection, signature, {
        recipient: depositAddress,
        amount: amountBn,
        splToken: splTokenPk,
      });
      return signature;
    } catch {
      continue;
    }
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const depositAddressParam = searchParams.get("depositAddress");
  const reference = searchParams.get("reference");
  const recipient = searchParams.get("recipient");
  const amount = searchParams.get("amount");
  const splTokenParam = searchParams.get("splToken");

  const splTokenMint =
    splTokenParam === WHITEWHALE_MINT_MAINNET
      ? WHITEWHALE_MINT_MAINNET
      : splTokenParam === CRUST_MINT_MAINNET
        ? CRUST_MINT_MAINNET
        : splTokenParam === PUMP_MINT_MAINNET
          ? PUMP_MINT_MAINNET
          : USDC_MINT_MAINNET;

  if (!amount) {
    return NextResponse.json(
      { status: "error", message: "Missing amount" },
      { status: 400 },
    );
  }

  // Use "confirmed" commitment so we detect payments soon after they land, not after finalized delay
  const connection = new Connection(getSolanaRpcUrlServer(), {
    commitment: "confirmed",
  });
  const amountBn = new BigNumber(amount);

  if (depositAddressParam) {
    try {
      const depositPk = new PublicKey(depositAddressParam);
      const signature = await findTransferToAddress(
        connection,
        depositPk,
        amountBn,
        splTokenMint,
      );
      if (signature) {
        return NextResponse.json({ status: "confirmed", signature });
      }
      return NextResponse.json({ status: "pending" });
    } catch (err) {
      return NextResponse.json({
        status: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  if (!reference || !recipient) {
    return NextResponse.json(
      {
        status: "error",
        message: "Missing depositAddress or (reference and recipient)",
      },
      { status: 400 },
    );
  }

  const referencePk = new PublicKey(reference);
  const recipientPk = new PublicKey(recipient);

  try {
    const { signature } = await findReference(connection, referencePk, {
      finality: "confirmed",
    });
    await validateTransfer(connection, signature, {
      recipient: recipientPk,
      amount: amountBn,
      splToken: new PublicKey(splTokenMint),
    });
    return NextResponse.json({ status: "confirmed", signature });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "FindReferenceError") {
      return NextResponse.json({ status: "pending" });
    }
    return NextResponse.json({
      status: "error",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
