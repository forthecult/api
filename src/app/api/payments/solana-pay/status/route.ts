import { findReference, validateTransfer } from "@solana/pay";
import {
  Connection,
  PublicKey,
  SystemInstruction,
  SystemProgram,
  TransactionMessage,
} from "@solana/web3.js";
import { NextResponse } from "next/server";
import BigNumber from "bignumber.js";

import {
  getSolanaRpcUrlServer,
  CRUST_MINT_MAINNET,
  PUMP_MINT_MAINNET,
  TROLL_MINT_MAINNET,
  USDC_MINT_MAINNET,
  WHITEWHALE_MINT_MAINNET,
} from "~/lib/solana-pay";

export const dynamic = "force-dynamic";

const NATIVE_SOL_SENTINEL = "native";

/** Check for a confirmed native SOL (system) transfer to depositAddress. */
async function findNativeSolTransferToAddress(
  connection: Connection,
  depositAddress: PublicKey,
  expectedLamports: number,
): Promise<string | null> {
  const sigs = await connection.getSignaturesForAddress(
    depositAddress,
    { limit: 30 },
    "confirmed",
  );
  for (const { signature } of sigs) {
    try {
      const tx = await connection.getTransaction(signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      if (!tx?.transaction?.message) continue;
      const message = tx.transaction.message as Parameters<
        typeof TransactionMessage.decompile
      >[0];
      const txMessage = TransactionMessage.decompile(message);
      for (const ix of txMessage.instructions) {
        if (!ix.programId.equals(SystemProgram.programId)) continue;
        try {
          const decoded = SystemInstruction.decodeTransfer(ix);
          if (
            decoded.toPubkey.equals(depositAddress) &&
            decoded.lamports >= expectedLamports
          ) {
            return signature;
          }
        } catch {
          // not a transfer instruction
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

/** check for a confirmed transfer to depositAddress (works for manual paste — no reference needed) */
async function findTransferToAddress(
  connection: Connection,
  depositAddress: PublicKey,
  amountBn: BigNumber,
  splTokenMint: string,
): Promise<string | null> {
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
  const isNativeSol =
    splTokenParam === NATIVE_SOL_SENTINEL ||
    searchParams.get("nativeSol") === "1";

  const splTokenMint =
    splTokenParam === NATIVE_SOL_SENTINEL
      ? USDC_MINT_MAINNET // unused when isNativeSol
      : splTokenParam === WHITEWHALE_MINT_MAINNET
        ? WHITEWHALE_MINT_MAINNET
        : splTokenParam === CRUST_MINT_MAINNET
          ? CRUST_MINT_MAINNET
          : splTokenParam === PUMP_MINT_MAINNET
            ? PUMP_MINT_MAINNET
            : splTokenParam === TROLL_MINT_MAINNET
              ? TROLL_MINT_MAINNET
              : USDC_MINT_MAINNET;

  if (!amount) {
    return NextResponse.json(
      { status: "error", message: "Missing amount" },
      { status: 400 },
    );
  }

  const connection = new Connection(getSolanaRpcUrlServer(), {
    commitment: "confirmed",
  });
  const amountBn = new BigNumber(amount);

  if (depositAddressParam) {
    try {
      const depositPk = new PublicKey(depositAddressParam);
      if (isNativeSol) {
        const expectedLamports = amountBn.integerValue().toNumber();
        const signature = await findNativeSolTransferToAddress(
          connection,
          depositPk,
          expectedLamports,
        );
        if (signature) {
          return NextResponse.json({ status: "confirmed", signature });
        }
        return NextResponse.json({ status: "pending" });
      }
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
