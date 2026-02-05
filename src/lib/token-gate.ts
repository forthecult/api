/**
 * Token gating: resolve gates for products, categories, and pages.
 * Used for access control (view gated content) and future perks (free shipping, discounts).
 *
 * Gate types (extensible):
 * - spl: Solana SPL token balance (implemented)
 * - nft: Solana/EVM NFT ownership (future)
 * - erc20: EVM ERC20 balance (future)
 */

import { eq, or } from "drizzle-orm";

import { db } from "~/db";
import {
  categoryTokenGateTable,
  categoriesTable,
  pageTokenGateTable,
  productTokenGateTable,
  productsTable,
} from "~/db/schema";
import { getSolanaRpcUrlServer } from "~/lib/solana-pay";
import { CRUST_MINT_MAINNET } from "~/lib/solana-pay";
import { Connection, PublicKey } from "@solana/web3.js";

export type TokenGateResourceType = "product" | "category" | "page";

export type TokenGateRule = {
  tokenSymbol: string;
  quantity: number;
  network: string | null;
  contractAddress: string | null;
  /** Resolved mint (Solana) or contract address for balance check */
  mintOrContract: string;
  gateType: "spl" | "nft" | "erc20";
};

export type TokenGateConfig = {
  tokenGated: boolean;
  gates: TokenGateRule[];
};

/** CULT mint on Solana (env or default test mint). */
export function getCultMintSolana(): string {
  const env =
    typeof process.env.CULT_TOKEN_MINT_SOLANA === "string"
      ? process.env.CULT_TOKEN_MINT_SOLANA.trim()
      : "";
  return env || CRUST_MINT_MAINNET;
}

/**
 * Resolve token symbol + network to mint/contract for balance check.
 * For Solana SPL: any token is supported by setting contractAddress to the token's mint address.
 * When contractAddress is not set, only known symbols (CULT, CRUST) resolve to a default mint.
 */
function resolveMintOrContract(
  tokenSymbol: string,
  network: string | null,
  contractAddress: string | null,
): string {
  const trimmed = contractAddress?.trim();
  if (trimmed) return trimmed;
  if (network?.toLowerCase() === "solana") {
    const symbol = tokenSymbol.toUpperCase();
    if (symbol === "CULT" || symbol === "CRUST") return getCultMintSolana();
  }
  return "";
}

/** Fetch token gates for a product (by id or slug). */
export async function getProductTokenGates(
  productIdOrSlug: string,
): Promise<TokenGateConfig> {
  const [product] = await db
    .select({
      id: productsTable.id,
      tokenGated: productsTable.tokenGated,
    })
    .from(productsTable)
    .where(
      or(
        eq(productsTable.id, productIdOrSlug),
        eq(productsTable.slug, productIdOrSlug),
      ),
    )
    .limit(1);
  if (!product) return { tokenGated: false, gates: [] };

  const gateRows = await db
    .select({
      tokenSymbol: productTokenGateTable.tokenSymbol,
      quantity: productTokenGateTable.quantity,
      network: productTokenGateTable.network,
      contractAddress: productTokenGateTable.contractAddress,
    })
    .from(productTokenGateTable)
    .where(eq(productTokenGateTable.productId, product.id));

  const tokenGated =
    product.tokenGated || gateRows.length > 0;
  const gates: TokenGateRule[] = gateRows.map((g) => {
    const mintOrContract = resolveMintOrContract(
      g.tokenSymbol,
      g.network,
      g.contractAddress,
    );
    const network = (g.network ?? "solana").toLowerCase();
    const gateType: TokenGateRule["gateType"] =
      network === "solana" ? "spl" : "erc20";
    return {
      tokenSymbol: g.tokenSymbol,
      quantity: g.quantity,
      network: g.network,
      contractAddress: g.contractAddress,
      mintOrContract: (mintOrContract || g.contractAddress) ?? "",
      gateType,
    };
  });

  return { tokenGated, gates };
}

/** Fetch token gates for a category (by id or slug). */
export async function getCategoryTokenGates(
  categoryIdOrSlug: string,
): Promise<TokenGateConfig> {
  const [category] = await db
    .select({
      id: categoriesTable.id,
      tokenGated: categoriesTable.tokenGated,
    })
    .from(categoriesTable)
    .where(
      or(
        eq(categoriesTable.id, categoryIdOrSlug),
        eq(categoriesTable.slug, categoryIdOrSlug),
      ),
    )
    .limit(1);
  if (!category) return { tokenGated: false, gates: [] };

  const gateRows = await db
    .select({
      tokenSymbol: categoryTokenGateTable.tokenSymbol,
      quantity: categoryTokenGateTable.quantity,
      network: categoryTokenGateTable.network,
      contractAddress: categoryTokenGateTable.contractAddress,
    })
    .from(categoryTokenGateTable)
    .where(eq(categoryTokenGateTable.categoryId, category.id));

  const tokenGated = category.tokenGated || gateRows.length > 0;
  const gates: TokenGateRule[] = gateRows.map((g) => {
    const mintOrContract = resolveMintOrContract(
      g.tokenSymbol,
      g.network,
      g.contractAddress,
    );
    const network = (g.network ?? "solana").toLowerCase();
    const gateType: TokenGateRule["gateType"] =
      network === "solana" ? "spl" : "erc20";
    return {
      tokenSymbol: g.tokenSymbol,
      quantity: g.quantity,
      network: g.network,
      contractAddress: g.contractAddress,
      mintOrContract: (mintOrContract || g.contractAddress) ?? "",
      gateType,
    };
  });

  return { tokenGated, gates };
}

/** Fetch token gates for a page slug. */
export async function getPageTokenGates(
  pageSlug: string,
): Promise<TokenGateConfig> {
  const gateRows = await db
    .select({
      tokenSymbol: pageTokenGateTable.tokenSymbol,
      quantity: pageTokenGateTable.quantity,
      network: pageTokenGateTable.network,
      contractAddress: pageTokenGateTable.contractAddress,
    })
    .from(pageTokenGateTable)
    .where(eq(pageTokenGateTable.pageSlug, pageSlug));

  if (gateRows.length === 0) return { tokenGated: false, gates: [] };

  const gates: TokenGateRule[] = gateRows.map((g) => {
    const mintOrContract = resolveMintOrContract(
      g.tokenSymbol,
      g.network,
      g.contractAddress,
    );
    const network = (g.network ?? "solana").toLowerCase();
    const gateType: TokenGateRule["gateType"] =
      network === "solana" ? "spl" : "erc20";
    return {
      tokenSymbol: g.tokenSymbol,
      quantity: g.quantity,
      network: g.network,
      contractAddress: g.contractAddress,
      mintOrContract: (mintOrContract || g.contractAddress) ?? "",
      gateType,
    };
  });

  return { tokenGated: true, gates };
}

/** Get token gate config for a resource. */
export async function getTokenGateConfig(
  resourceType: TokenGateResourceType,
  resourceId: string,
): Promise<TokenGateConfig> {
  switch (resourceType) {
    case "product":
      return getProductTokenGates(resourceId);
    case "category":
      return getCategoryTokenGates(resourceId);
    case "page":
      return getPageTokenGates(resourceId);
    default:
      return { tokenGated: false, gates: [] };
  }
}

/** Default decimals when mint info is unavailable (e.g. no ATA). */
const DEFAULT_SPL_DECIMALS = 6;

/**
 * Check Solana SPL token balance for a wallet. Returns raw amount and mint decimals.
 * Supports both standard SPL tokens (Token Program) and Token-2022 tokens (Token Extensions).
 */
export async function getSolanaTokenBalance(
  mintAddress: string,
  walletAddress: string,
): Promise<{ amount: bigint; decimals: number }> {
  const { getTokenBalanceAnyProgram, TOKEN_2022_PROGRAM_ID } = await import(
    "~/lib/solana-token-utils"
  );
  const connection = new Connection(getSolanaRpcUrlServer());

  const result = await getTokenBalanceAnyProgram(connection, mintAddress, walletAddress);
  
  if (result) {
    if (process.env.NODE_ENV === "development") {
      const programName = result.programId.equals(TOKEN_2022_PROGRAM_ID) ? "Token-2022" : "Token";
      console.info(
        "[token-gate] Found balance via",
        programName,
        "program for mint:",
        mintAddress.slice(0, 8) + "...",
      );
    }
    return {
      amount: result.amount,
      decimals: result.decimals,
    };
  }

  // No balance found in either program
  return { amount: 0n, decimals: DEFAULT_SPL_DECIMALS };
}

/** Check if a Solana wallet passes the given SPL gate (balance >= quantity). Works for any SPL; uses mint decimals. */
export async function checkSolanaGate(
  walletAddress: string,
  gate: TokenGateRule,
): Promise<boolean> {
  if (gate.gateType !== "spl" || !gate.mintOrContract) return false;
  const { amount: balance, decimals } = await getSolanaTokenBalance(
    gate.mintOrContract,
    walletAddress,
  );
  const minRaw = BigInt(gate.quantity) * BigInt(10 ** decimals);
  const passed = balance >= minRaw;
  if (process.env.NODE_ENV === "development") {
    const mintShort =
      gate.mintOrContract.length > 12
        ? `${gate.mintOrContract.slice(0, 4)}…${gate.mintOrContract.slice(-4)}`
        : gate.mintOrContract;
    console.info(
      "[token-gate]",
      gate.tokenSymbol,
      "mint:",
      mintShort,
      "| need",
      gate.quantity,
      "| balance (raw):",
      balance.toString(),
      "decimals:",
      decimals,
      "minRaw:",
      minRaw.toString(),
      "|",
      passed ? "PASS" : "FAIL",
    );
  }
  return passed;
}

/**
 * Check if a wallet passes at least one of the given gates (OR).
 * Currently only Solana SPL is implemented; other gate types return false.
 */
export async function walletPassesTokenGates(
  walletAddress: string,
  gates: TokenGateRule[],
): Promise<{ valid: boolean; passedGate: TokenGateRule | null }> {
  for (const gate of gates) {
    if (gate.gateType === "spl") {
      const ok = await checkSolanaGate(walletAddress, gate);
      if (ok) return { valid: true, passedGate: gate };
    }
    // nft / erc20: future
  }
  return { valid: false, passedGate: null };
}
