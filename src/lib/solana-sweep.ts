/**
 * Shared logic for sweeping SOL and SPL tokens from Solana Pay deposit addresses.
 * Used by the CLI script and by the admin API.
 */

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
import { and, eq, isNotNull, or } from "drizzle-orm";

import { db } from "~/db";
import { ordersTable } from "~/db/schema";
import { deriveDepositKeypair } from "~/lib/solana-deposit";
import {
  USDC_MINT_MAINNET,
  CRUST_MINT_MAINNET,
  PUMP_MINT_MAINNET,
  TROLL_MINT_MAINNET,
  WHITEWHALE_MINT_MAINNET,
} from "~/lib/solana-pay";

const LAMPORTS_PER_SOL = 1e9;
const MIN_SOL_TO_SWEEP = 5000;

/** Known mint addresses -> display symbol for sweep UI */
const KNOWN_MINT_LABELS: Record<string, string> = {
  [USDC_MINT_MAINNET]: "USDC",
  [CRUST_MINT_MAINNET]: "CRUST",
  [PUMP_MINT_MAINNET]: "PUMP",
  [TROLL_MINT_MAINNET]: "TROLL",
  [WHITEWHALE_MINT_MAINNET]: "WHITEWHALE",
};

export function getTokenLabel(mint: string): string {
  return KNOWN_MINT_LABELS[mint] ?? mint.slice(0, 8) + "…";
}

export type TokenSweepItem = {
  mint: string;
  amount: string;
  decimals: number;
  amountFormatted: number;
  /** Display symbol when mint is known (e.g. USDC, PUMP) */
  symbol?: string;
};

export type SweepOrderResult = {
  orderId: string;
  depositAddress: string;
  skipped?: string;
  solToSweepLamports?: number;
  solToSweepFormatted?: number;
  tokens?: TokenSweepItem[];
  txSignature?: string;
  error?: string;
};

export type SweepScope = "paid" | "pending" | "all";

export type SolanaSweepResult = {
  ok: boolean;
  dryRun: boolean;
  scope: SweepScope;
  configError?: string;
  recipient?: string;
  ordersCount: number;
  results: SweepOrderResult[];
};

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
      ok: false,
      dryRun,
      scope,
      configError:
        "Missing NEXT_PUBLIC_SOLANA_PAY_RECIPIENT or SOLANA_PAY_RECIPIENT",
      ordersCount: 0,
      results: [],
    };
  }
  if (!feePayer && !dryRun) {
    return {
      ok: false,
      dryRun,
      scope,
      configError:
        "Missing SOLANA_SWEEP_FEE_PAYER_SECRET (base58 secret key of keypair with SOL for fees)",
      ordersCount: 0,
      results: [],
    };
  }

  const connection = new Connection(getRpcUrl(), { commitment: "confirmed" });
  const recipient = new PublicKey(recipientStr);

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
        orderId,
        depositAddress: depositAddr,
        skipped: "Derived address does not match stored",
      });
      continue;
    }

    const solBalance = await connection.getBalance(keypair.publicKey);
    const solToSweep =
      solBalance > MIN_SOL_TO_SWEEP ? solBalance - MIN_SOL_TO_SWEEP : 0;

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
        orderId,
        depositAddress: depositAddr,
        skipped: "No SOL or SPL balance to sweep",
      });
      continue;
    }

    const tokensForResult: TokenSweepItem[] = tokenAccounts.map((t) => {
      const amountFormatted = Number(t.amount) / 10 ** t.decimals;
      return {
        mint: t.mint,
        amount: t.amount,
        decimals: t.decimals,
        amountFormatted,
        symbol: KNOWN_MINT_LABELS[t.mint],
      };
    });

    if (dryRun) {
      results.push({
        orderId,
        depositAddress: depositAddr,
        solToSweepLamports: solToSweep,
        solToSweepFormatted: solToSweep / LAMPORTS_PER_SOL,
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
      const { blockhash } =
        await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;

      const sig = await sendAndConfirmTransaction(
        connection,
        tx,
        [feePayer!, keypair],
        { commitment: "confirmed", preflightCommitment: "confirmed" },
      );

      results.push({
        orderId,
        depositAddress: depositAddr,
        solToSweepLamports: solToSweep,
        solToSweepFormatted: solToSweep / LAMPORTS_PER_SOL,
        tokens: tokensForResult,
        txSignature: sig,
      });
    } catch (err) {
      results.push({
        orderId,
        depositAddress: depositAddr,
        solToSweepLamports: solToSweep,
        solToSweepFormatted: solToSweep / LAMPORTS_PER_SOL,
        tokens: tokensForResult,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    ok: true,
    dryRun,
    scope,
    recipient: recipientStr,
    ordersCount: depositAddresses.size,
    results,
  };
}
