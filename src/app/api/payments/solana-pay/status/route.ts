import { findReference, validateTransfer } from "@solana/pay";
import {
  Connection,
  PublicKey,
  SystemInstruction,
  SystemProgram,
  TransactionMessage,
} from "@solana/web3.js";
import BigNumber from "bignumber.js";
import { NextResponse } from "next/server";

import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
  rateLimitResponse,
} from "~/lib/rate-limit";
import {
  CRUST_MINT_MAINNET,
  CULT_MINT_MAINNET,
  getSolanaRpcUrlServer,
  PUMP_MINT_MAINNET,
  SKR_MINT_MAINNET,
  TROLL_MINT_MAINNET,
  USDC_MINT_MAINNET,
  WHITEWHALE_MINT_MAINNET,
} from "~/lib/solana-pay";
import { getTokenBalanceAnyProgram } from "~/lib/solana-token-utils";

export const dynamic = "force-dynamic";

const NATIVE_SOL_SENTINEL = "native";

export async function GET(request: Request) {
  const ip = getClientIp(request.headers);
  const rl = await checkRateLimit(
    `solana-status:${ip}`,
    RATE_LIMITS.orderStatus,
  );
  if (!rl.success) return rateLimitResponse(rl);

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
          : splTokenParam === CULT_MINT_MAINNET
            ? CULT_MINT_MAINNET
            : splTokenParam === PUMP_MINT_MAINNET
              ? PUMP_MINT_MAINNET
              : splTokenParam === TROLL_MINT_MAINNET
                ? TROLL_MINT_MAINNET
                : splTokenParam === SKR_MINT_MAINNET
                  ? SKR_MINT_MAINNET
                  : USDC_MINT_MAINNET;

  if (!amount) {
    return NextResponse.json(
      { message: "Missing amount", status: "error" },
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
          return NextResponse.json({ signature, status: "confirmed" });
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
        return NextResponse.json({ signature, status: "confirmed" });
      }
      return NextResponse.json({ status: "pending" });
    } catch (err) {
      return NextResponse.json({
        message: err instanceof Error ? err.message : "Unknown error",
        status: "error",
      });
    }
  }

  if (!reference || !recipient) {
    return NextResponse.json(
      {
        message: "Missing depositAddress or (reference and recipient)",
        status: "error",
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
    // Try standard validateTransfer first
    try {
      await validateTransfer(connection, signature, {
        amount: amountBn,
        recipient: recipientPk,
        splToken: new PublicKey(splTokenMint),
      });
      return NextResponse.json({ signature, status: "confirmed" });
    } catch {
      // Fallback: balance check for Token-2022 tokens
      const balance = await getTokenBalanceAnyProgram(
        connection,
        splTokenMint,
        recipientPk,
      );
      if (balance) {
        const expectedBaseUnits = BigInt(
          amountBn
            .times(new BigNumber(10).pow(balance.decimals))
            .integerValue(BigNumber.ROUND_FLOOR)
            .toString(),
        );
        if (balance.amount >= expectedBaseUnits) {
          return NextResponse.json({ signature, status: "confirmed" });
        }
      }
      // Neither validateTransfer nor balance check succeeded
      return NextResponse.json({ status: "pending" });
    }
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "FindReferenceError") {
      return NextResponse.json({ status: "pending" });
    }
    return NextResponse.json({
      message: err instanceof Error ? err.message : "Unknown error",
      status: "error",
    });
  }
}

/** Check for a confirmed native SOL (system) transfer to depositAddress. */
async function findNativeSolTransferToAddress(
  connection: Connection,
  depositAddress: PublicKey,
  expectedLamports: number,
): Promise<null | string> {
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
    } catch {}
  }
  return null;
}

/**
 * Check for a confirmed SPL token transfer to depositAddress.
 * Tries @solana/pay's validateTransfer first (standard Token Program),
 * then falls back to a balance check for Token-2022 tokens.
 */
async function findTransferToAddress(
  connection: Connection,
  depositAddress: PublicKey,
  amountBn: BigNumber,
  splTokenMint: string,
): Promise<null | string> {
  const sigs = await connection.getSignaturesForAddress(
    depositAddress,
    { limit: 30 },
    "confirmed",
  );

  // 1. Try validateTransfer from @solana/pay (works for standard Token Program)
  const splTokenPk = new PublicKey(splTokenMint);
  for (const { signature } of sigs) {
    try {
      await validateTransfer(connection, signature, {
        amount: amountBn,
        recipient: depositAddress,
        splToken: splTokenPk,
      });
      return signature;
    } catch {}
  }

  // 2. Fallback: check deposit address's token balance directly.
  //    This handles Token-2022 tokens (e.g. pump.fun tokens) that validateTransfer doesn't support.
  //    Also catches edge cases where getSignaturesForAddress misses the transaction
  //    (e.g. deposit wallet not in the instruction accounts).
  try {
    const balance = await getTokenBalanceAnyProgram(
      connection,
      splTokenMint,
      depositAddress,
    );
    if (balance) {
      // Convert expected amount from token units to base units for comparison
      const expectedBaseUnits = BigInt(
        amountBn
          .times(new BigNumber(10).pow(balance.decimals))
          .integerValue(BigNumber.ROUND_FLOOR)
          .toString(),
      );
      if (balance.amount >= expectedBaseUnits) {
        // Balance is sufficient — return the most recent signature if available,
        // or a sentinel indicating balance-verified
        return sigs.length > 0 ? sigs[0]!.signature : "balance-verified";
      }
    }
  } catch {
    // Balance check failed — fall through to return null
  }

  return null;
}
