/**
 * Shared logic for sweeping SOL and SPL tokens from Solana Pay deposit addresses.
 * Used by the CLI script and by the admin API.
 *
 * Security: SOLANA_SWEEP_FEE_PAYER_SECRET and SOLANA_DEPOSIT_SECRET are read
 * only from process.env on the server. They are never returned in API responses,
 * logged, or sent to the client. Sweep runs entirely server-side; the client
 * only receives non-sensitive result data (order ids, amounts, tx signatures).
 */

import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  getMint,
  TOKEN_PROGRAM_ID,
  unpackAccount,
  ACCOUNT_SIZE,
} from "@solana/spl-token";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { and, eq, isNotNull, or } from "drizzle-orm";

import { db } from "~/db";
import { ordersTable } from "~/db/schema";
import { deriveDepositKeypair } from "~/lib/solana-deposit";
import {
  CRUST_MINT_MAINNET,
  CULT_MINT_MAINNET,
  PUMP_MINT_MAINNET,
  TROLL_MINT_MAINNET,
  USDC_MINT_MAINNET,
  WHITEWHALE_MINT_MAINNET,
} from "~/lib/solana-pay";

const LAMPORTS_PER_SOL = 1e9;
/** Minimum lamports to leave so the account stays rent-exempt (Solana requires ~890880 for 0-byte account). */
const RENT_EXEMPT_MIN_LAMPORTS = 890_880;

/** Known mint addresses -> display symbol for sweep UI */
const KNOWN_MINT_LABELS: Record<string, string> = {
  [CRUST_MINT_MAINNET]: "CRUST",
  [CULT_MINT_MAINNET]: "CULT",
  [PUMP_MINT_MAINNET]: "PUMP",
  [TROLL_MINT_MAINNET]: "TROLL",
  [USDC_MINT_MAINNET]: "USDC",
  [WHITEWHALE_MINT_MAINNET]: "WHITEWHALE",
};

export interface SolanaSweepResult {
  configError?: string;
  dryRun: boolean;
  ok: boolean;
  ordersCount: number;
  recipient?: string;
  results: SweepOrderResult[];
  scope: SweepScope;
}

export interface SweepOrderResult {
  depositAddress: string;
  error?: string;
  orderId: string;
  skipped?: string;
  solToSweepFormatted?: number;
  solToSweepLamports?: number;
  tokens?: TokenSweepItem[];
  txSignature?: string;
}

export type SweepScope = "all" | "paid" | "pending";

export interface TokenSweepItem {
  amount: string;
  amountFormatted: number;
  decimals: number;
  mint: string;
  /** Display symbol when mint is known (e.g. USDC, PUMP) */
  symbol?: string;
}

interface TokenAccountInfo {
  amount: string;
  ata: PublicKey;
  decimals: number;
  mint: string;
  programId: PublicKey;
}

export function getTokenLabel(mint: string): string {
  return KNOWN_MINT_LABELS[mint] ?? mint.slice(0, 8) + "…";
}

/**
 * Run Solana Pay deposit sweep (dry run or actual). Call from API or script.
 * @param scope "paid" = only confirmed paid orders (safe, no race with customer paying);
 *              "pending" = only pending orders (run when no customer is on checkout);
 *              "all" = both (legacy; prefer separate paid/pending sweeps).
 */
export async function runSolanaSweep(
  dryRun: boolean,
  scope: SweepScope = "paid",
): Promise<SolanaSweepResult> {
  const recipientStr = getRecipient();
  const feePayer = getFeePayerKeypair();

  if (!recipientStr) {
    return {
      configError:
        "Missing NEXT_PUBLIC_SOLANA_PAY_RECIPIENT or SOLANA_PAY_RECIPIENT",
      dryRun,
      ok: false,
      ordersCount: 0,
      results: [],
      scope,
    };
  }
  if (!feePayer && !dryRun) {
    return {
      configError:
        "Missing SOLANA_SWEEP_FEE_PAYER_SECRET (base58 secret key of keypair with SOL for fees)",
      dryRun,
      ok: false,
      ordersCount: 0,
      results: [],
      scope,
    };
  }

  const connection = new Connection(getRpcUrl(), { commitment: "confirmed" });
  const recipient = new PublicKey(recipientStr);

  // Leave at least rent-exempt minimum so the sweep tx doesn't fail with "insufficient funds for rent"
  let minSolToLeave = RENT_EXEMPT_MIN_LAMPORTS;
  try {
    const exempt = await connection.getMinimumBalanceForRentExemption(0);
    minSolToLeave = Math.max(minSolToLeave, exempt);
  } catch {
    // use RENT_EXEMPT_MIN_LAMPORTS if RPC fails
  }

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

  const results: SweepOrderResult[] = [];

  for (const [orderId, depositAddr] of depositAddresses) {
    const keypair = deriveDepositKeypair(orderId);
    if (keypair.publicKey.toBase58() !== depositAddr) {
      results.push({
        depositAddress: depositAddr,
        orderId,
        skipped: "Derived address does not match stored",
      });
      continue;
    }

    const solBalance = await connection.getBalance(keypair.publicKey);
    const solToSweep =
      solBalance > minSolToLeave ? solBalance - minSolToLeave : 0;

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
      results.push({
        depositAddress: depositAddr,
        orderId,
        skipped: "No SOL or SPL balance to sweep",
      });
      continue;
    }

    const tokensForResult: TokenSweepItem[] = tokenAccounts.map((t) => {
      const amountFormatted = Number(t.amount) / 10 ** t.decimals;
      return {
        amount: t.amount,
        amountFormatted,
        decimals: t.decimals,
        mint: t.mint,
        symbol: KNOWN_MINT_LABELS[t.mint],
      };
    });

    if (dryRun) {
      results.push({
        depositAddress: depositAddr,
        orderId,
        solToSweepFormatted: solToSweep / LAMPORTS_PER_SOL,
        solToSweepLamports: solToSweep,
        tokens: tokensForResult,
      });
      continue;
    }

    const tx = new Transaction();
    try {
      if (solToSweep > 0) {
        tx.add(
          SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            lamports: solToSweep,
            toPubkey: recipient,
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

        const mintInfo = await getMint(
          connection,
          mintPk,
          "confirmed",
          t.programId,
        );
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
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;

      const sig = await sendAndConfirmTransaction(
        connection,
        tx,
        [feePayer!, keypair],
        { commitment: "confirmed", preflightCommitment: "confirmed" },
      );

      results.push({
        depositAddress: depositAddr,
        orderId,
        solToSweepFormatted: solToSweep / LAMPORTS_PER_SOL,
        solToSweepLamports: solToSweep,
        tokens: tokensForResult,
        txSignature: sig,
      });
    } catch (err) {
      results.push({
        depositAddress: depositAddr,
        error: err instanceof Error ? err.message : String(err),
        orderId,
        solToSweepFormatted: solToSweep / LAMPORTS_PER_SOL,
        solToSweepLamports: solToSweep,
        tokens: tokensForResult,
      });
    }
  }

  return {
    dryRun,
    ok: true,
    ordersCount: depositAddresses.size,
    recipient: recipientStr,
    results,
    scope,
  };
}

/** Server-only: builds fee-payer keypair from env. Never expose the key or keypair to the client. */
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

function getRecipient(): null | string {
  const r =
    process.env.NEXT_PUBLIC_SOLANA_PAY_RECIPIENT ||
    process.env.SOLANA_PAY_RECIPIENT ||
    "";
  return r.trim() || null;
}

function getRpcUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL || process.env.SOLANA_RPC_URL || "";
  return url.trim() || "https://rpc.ankr.com/solana";
}

/**
 * Fetch all token accounts with balance > 0 for an owner and program.
 * Uses parsed RPC response first; falls back to raw getTokenAccountsByOwner + decode
 * so Token-2022 tokens (e.g. CULT) are found when the RPC doesn't return parsed data.
 */
async function getTokenAccountsWithBalance(
  connection: Connection,
  owner: PublicKey,
  programId: PublicKey,
): Promise<TokenAccountInfo[]> {
  const byAta = new Map<string, TokenAccountInfo>();

  // 1) Parsed response (works for standard SPL on most RPCs)
  const parsedResp = await connection.getParsedTokenAccountsByOwner(owner, {
    programId,
  });
  for (const { account, pubkey } of parsedResp.value) {
    const parsed = account.data?.parsed?.info;
    if (!parsed?.mint || !parsed?.tokenAmount) continue;
    const amount = parsed.tokenAmount.amount;
    if (amount === "0" || !amount) continue;
    byAta.set(pubkey.toBase58(), {
      amount,
      ata: pubkey,
      decimals: parsed.tokenAmount.decimals ?? 0,
      mint: parsed.mint,
      programId,
    });
  }

  // 2) Fallback: raw accounts (catches Token-2022 when RPC doesn't parse)
  const rawResp = await connection.getTokenAccountsByOwner(owner, {
    programId,
  });
  for (const { account, pubkey } of rawResp.value) {
    if (byAta.has(pubkey.toBase58())) continue;
    let data: Buffer =
      typeof account.data === "string"
        ? Buffer.from(account.data, "base64")
        : Buffer.from(account.data);
    if (data.length < ACCOUNT_SIZE) continue;
    try {
      const unpacked = unpackAccount(
        pubkey,
        { ...account, data } as Parameters<typeof unpackAccount>[1],
        programId,
      );
      if (unpacked.amount <= 0n) continue;
      const mintInfo = await getMint(
        connection,
        unpacked.mint,
        "confirmed",
        programId,
      );
      byAta.set(pubkey.toBase58(), {
        amount: String(unpacked.amount),
        ata: pubkey,
        decimals: mintInfo.decimals,
        mint: unpacked.mint.toBase58(),
        programId,
      });
    } catch {
      // Skip invalid or unsupported account layout
    }
  }

  return Array.from(byAta.values());
}
