/**
 * Sweep SOL and all SPL tokens from Solana Pay order deposit addresses into your
 * main wallet (NEXT_PUBLIC_SOLANA_PAY_RECIPIENT).
 *
 * Payments go to a unique deposit address per order (derived from orderId +
 * SOLANA_DEPOSIT_SECRET). They do NOT go directly to NEXT_PUBLIC_SOLANA_PAY_RECIPIENT.
 * Run this script to move funds (SOL, USDC, USDT, PUMP, or any SPL) to your main wallet.
 *
 * Required env:
 *   DATABASE_URL
 *   SOLANA_DEPOSIT_SECRET (same as used by create-order)
 *   NEXT_PUBLIC_SOLANA_PAY_RECIPIENT (destination wallet base58)
 *   SOLANA_SWEEP_FEE_PAYER_SECRET (base58-encoded 64-byte secret key of a keypair with SOL for tx fees)
 *
 * Optional: NEXT_PUBLIC_SOLANA_RPC_URL or SOLANA_RPC_URL (defaults to Ankr).
 * Optional: SWEEP_SCOPE=paid|pending|all (default paid). Use "pending" only when
 *           no customer is on checkout to avoid racing their payment.
 *
 * Run: bun run scripts/sweep-solana-deposits.ts
 * Dry run (list only): DRY_RUN=1 bun run scripts/sweep-solana-deposits.ts
 * Sweep pending orders: SWEEP_SCOPE=pending bun run scripts/sweep-solana-deposits.ts
 */

import "dotenv/config";

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  getMint,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import bs58 from "bs58";
import { eq, and, isNotNull, or } from "drizzle-orm";

import { db } from "../src/db";
import { ordersTable } from "../src/db/schema";
import { deriveDepositKeypair } from "../src/lib/solana-deposit";

const LAMPORTS_PER_SOL = 1e9;
const MIN_SOL_TO_SWEEP = 5000; // leave dust for rent if needed

type TokenAccountInfo = {
  mint: string;
  amount: string;
  decimals: number;
  ata: PublicKey;
  programId: PublicKey;
};

function getRpcUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    process.env.SOLANA_RPC_URL ||
    "";
  return url.trim() || "https://rpc.ankr.com/solana";
}

function getRecipient(): string | null {
  const r =
    process.env.NEXT_PUBLIC_SOLANA_PAY_RECIPIENT ||
    process.env.SOLANA_PAY_RECIPIENT ||
    "";
  return r.trim() || null;
}

function getFeePayerKeypair(): Keypair | null {
  const secret = process.env.SOLANA_SWEEP_FEE_PAYER_SECRET?.trim();
  if (!secret) return null;
  try {
    const bytes = bs58.decode(secret);
    if (bytes.length !== 64) return null;
    return Keypair.fromSecretKey(bytes);
  } catch {
    return null;
  }
}

async function getTokenAccountsWithBalance(
  connection: Connection,
  owner: PublicKey,
  programId: PublicKey,
): Promise<TokenAccountInfo[]> {
  const out: TokenAccountInfo[] = [];
  const resp = await connection.getParsedTokenAccountsByOwner(owner, {
    programId,
  });
  for (const { pubkey, account } of resp.value) {
    const parsed = account.data.parsed?.info;
    if (!parsed?.mint || !parsed?.tokenAmount) continue;
    const amount = parsed.tokenAmount.amount;
    if (amount === "0" || !amount) continue;
    out.push({
      mint: parsed.mint,
      amount,
      decimals: parsed.tokenAmount.decimals ?? 0,
      ata: pubkey,
      programId,
    });
  }
  return out;
}

async function main() {
  const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
  const recipientStr = getRecipient();
  const feePayer = getFeePayerKeypair();

  if (!recipientStr) {
    console.error(
      "Missing NEXT_PUBLIC_SOLANA_PAY_RECIPIENT or SOLANA_PAY_RECIPIENT",
    );
    process.exit(1);
  }
  if (!feePayer && !dryRun) {
    console.error(
      "Missing SOLANA_SWEEP_FEE_PAYER_SECRET (base58 secret key of keypair with SOL for fees)",
    );
    process.exit(1);
  }

  const connection = new Connection(getRpcUrl(), { commitment: "confirmed" });
  const recipient = new PublicKey(recipientStr);

  const scope =
    process.env.SWEEP_SCOPE?.trim().toLowerCase() === "pending"
      ? "pending"
      : process.env.SWEEP_SCOPE?.trim().toLowerCase() === "all"
        ? "all"
        : "paid";
  const scopeCondition =
    scope === "paid"
      ? eq(ordersTable.paymentStatus, "paid")
      : scope === "pending"
        ? eq(ordersTable.status, "pending")
        : or(
            eq(ordersTable.paymentStatus, "paid"),
            eq(ordersTable.status, "pending"),
          );

  const rows = await db
    .select({
      id: ordersTable.id,
      solanaPayDepositAddress: ordersTable.solanaPayDepositAddress,
    })
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.paymentMethod, "solana_pay"),
        isNotNull(ordersTable.solanaPayDepositAddress),
        scopeCondition,
      ),
    );

  const depositAddresses = new Map<string, string>();
  for (const r of rows) {
    const addr = r.solanaPayDepositAddress?.trim();
    if (addr) depositAddresses.set(r.id, addr);
  }

  if (depositAddresses.size === 0) {
    console.log(`No Solana Pay orders (scope=${scope}) with deposit addresses found.`);
    return;
  }

  console.log(
    `Found ${depositAddresses.size} order(s) (scope=${scope}) with deposit addresses.`,
  );

  for (const [orderId, depositAddr] of depositAddresses) {
    const keypair = deriveDepositKeypair(orderId);
    if (keypair.publicKey.toBase58() !== depositAddr) {
      console.warn(
        `Order ${orderId}: derived address does not match stored ${depositAddr}, skipping.`,
      );
      continue;
    }

    // 1) Native SOL
    const solBalance = await connection.getBalance(keypair.publicKey);
    const solToSweep = solBalance > MIN_SOL_TO_SWEEP ? solBalance - MIN_SOL_TO_SWEEP : 0;

    // 2) All SPL tokens (Token Program + Token-2022)
    const tokenAccounts: TokenAccountInfo[] = [
      ...(await getTokenAccountsWithBalance(
        connection,
        keypair.publicKey,
        TOKEN_PROGRAM_ID,
      )),
      ...(await getTokenAccountsWithBalance(
        connection,
        keypair.publicKey,
        TOKEN_2022_PROGRAM_ID,
      )),
    ];

    const hasWork = solToSweep > 0 || tokenAccounts.length > 0;
    if (!hasWork) {
      console.log(`Order ${orderId}: no SOL or SPL balance to sweep, skipping.`);
      continue;
    }

    if (dryRun) {
      if (solToSweep > 0) {
        console.log(
          `[DRY RUN] Order ${orderId}: would sweep ${solToSweep / LAMPORTS_PER_SOL} SOL to ${recipientStr}`,
        );
      }
      for (const t of tokenAccounts) {
        const amountFormatted = Number(t.amount) / 10 ** t.decimals;
        console.log(
          `[DRY RUN] Order ${orderId}: would sweep ${amountFormatted} tokens (mint ${t.mint}) to ${recipientStr}`,
        );
      }
      continue;
    }

    const tx = new Transaction();

    try {
      if (solToSweep > 0) {
        tx.add(
          SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: recipient,
            lamports: solToSweep,
          }),
        );
      }

      for (const t of tokenAccounts) {
        const mintPk = new PublicKey(t.mint);
        const amountBigInt = BigInt(t.amount);
        const recipientAta = getAssociatedTokenAddressSync(
          mintPk,
          recipient,
          false,
          t.programId,
        );

        const recipientAtaInfo = await connection.getAccountInfo(recipientAta);
        if (!recipientAtaInfo) {
          tx.add(
            createAssociatedTokenAccountInstruction(
              feePayer!.publicKey,
              recipientAta,
              recipient,
              mintPk,
              t.programId,
            ),
          );
        }

        const mintInfo = await getMint(connection, mintPk, "confirmed", t.programId);
        tx.add(
          createTransferCheckedInstruction(
            t.ata,
            mintPk,
            recipientAta,
            keypair.publicKey,
            amountBigInt,
            mintInfo.decimals,
            [],
            t.programId,
          ),
        );
      }

      tx.feePayer = feePayer!.publicKey;
      const { blockhash } =
        await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;

      const sig = await sendAndConfirmTransaction(
        connection,
        tx,
        [feePayer!, keypair],
        { commitment: "confirmed", preflightCommitment: "confirmed" },
      );

      const parts: string[] = [];
      if (solToSweep > 0)
        parts.push(`${solToSweep / LAMPORTS_PER_SOL} SOL`);
      for (const t of tokenAccounts) {
        const amountFormatted = Number(t.amount) / 10 ** t.decimals;
        parts.push(`${amountFormatted} (mint ${t.mint.slice(0, 8)}…)`);
      }
      console.log(`Order ${orderId}: swept ${parts.join(", ")}. Tx: ${sig}`);
    } catch (err) {
      console.error(`Order ${orderId}: sweep failed`, err);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
