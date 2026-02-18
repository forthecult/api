/**
 * Token gating: resolve gates for products, categories, and pages.
 * Used for access control (view gated content) and future perks (free shipping, discounts).
 *
 * Gate types (extensible):
 * - spl: Solana SPL token balance (implemented)
 * - nft: Solana/EVM NFT ownership (future)
 * - erc20: EVM ERC20 balance (future)
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { eq, or } from "drizzle-orm";

import { db } from "~/db";
import {
  categoriesTable,
  categoryTokenGateTable,
  pageTokenGateTable,
  productCategoriesTable,
  productsTable,
  productTokenGateTable,
} from "~/db/schema";
import { getSolanaRpcUrlServer } from "~/lib/solana-pay";
import { CRUST_MINT_MAINNET } from "~/lib/solana-pay";
import { hasValidTokenGateCookie } from "~/lib/token-gate-cookie";

export interface TokenGateConfig {
  gates: TokenGateRule[];
  tokenGated: boolean;
}

export type TokenGateResourceType = "category" | "page" | "product";

export interface TokenGateRule {
  contractAddress: null | string;
  gateType: "erc20" | "nft" | "spl";
  /** Resolved mint (Solana) or contract address for balance check */
  mintOrContract: string;
  network: null | string;
  quantity: number;
  tokenSymbol: string;
}

/**
 * Format token gate rules into a short display string for product cards and listings.
 * e.g. "≥ 1000 CULT on the Solana network" or "≥ 500 PUMP on Solana, or ≥ 100 WHALE on the Ethereum network"
 */
export function formatTokenGateSummaryToDisplay(
  gates: {
    network: null | string;
    quantity: number;
    tokenSymbol: string;
  }[],
): string {
  if (gates.length === 0) return "required tokens";
  function networkLabel(network: null | string): string {
    const n = (network ?? "solana").toLowerCase();
    const labels: Record<string, string> = {
      arbitrum: "the Arbitrum network",
      avalanche: "the Avalanche network",
      base: "the Base network",
      bnb: "the BNB Chain network",
      bsc: "the BNB Chain network",
      ethereum: "the Ethereum network",
      polygon: "the Polygon network",
      solana: "the Solana network",
    };
    return labels[n] ?? (n ? `the ${n} network` : "the required network");
  }
  const parts = gates.map(
    (g) => `≥ ${g.quantity} ${g.tokenSymbol} on ${networkLabel(g.network)}`,
  );
  return parts.length === 1 ? parts[0]! : parts.join(", or ");
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
  if (!category) return { gates: [], tokenGated: false };

  const gateRows = await db
    .select({
      contractAddress: categoryTokenGateTable.contractAddress,
      network: categoryTokenGateTable.network,
      quantity: categoryTokenGateTable.quantity,
      tokenSymbol: categoryTokenGateTable.tokenSymbol,
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
      contractAddress: g.contractAddress,
      gateType,
      mintOrContract: (mintOrContract || g.contractAddress) ?? "",
      network: g.network,
      quantity: g.quantity,
      tokenSymbol: g.tokenSymbol,
    };
  });

  return { gates, tokenGated };
}

/** CULT mint on Solana (env or default test mint). */
export function getCultMintSolana(): string {
  const env =
    typeof process.env.CULT_TOKEN_MINT_SOLANA === "string"
      ? process.env.CULT_TOKEN_MINT_SOLANA.trim()
      : "";
  return env || CRUST_MINT_MAINNET;
}

/** Fetch token gates for a page slug. */
export async function getPageTokenGates(
  pageSlug: string,
): Promise<TokenGateConfig> {
  const gateRows = await db
    .select({
      contractAddress: pageTokenGateTable.contractAddress,
      network: pageTokenGateTable.network,
      quantity: pageTokenGateTable.quantity,
      tokenSymbol: pageTokenGateTable.tokenSymbol,
    })
    .from(pageTokenGateTable)
    .where(eq(pageTokenGateTable.pageSlug, pageSlug));

  if (gateRows.length === 0) return { gates: [], tokenGated: false };

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
      contractAddress: g.contractAddress,
      gateType,
      mintOrContract: (mintOrContract || g.contractAddress) ?? "",
      network: g.network,
      quantity: g.quantity,
      tokenSymbol: g.tokenSymbol,
    };
  });

  return { gates, tokenGated: true };
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
  if (!product) return { gates: [], tokenGated: false };

  const gateRows = await db
    .select({
      contractAddress: productTokenGateTable.contractAddress,
      network: productTokenGateTable.network,
      quantity: productTokenGateTable.quantity,
      tokenSymbol: productTokenGateTable.tokenSymbol,
    })
    .from(productTokenGateTable)
    .where(eq(productTokenGateTable.productId, product.id));

  const tokenGated = product.tokenGated || gateRows.length > 0;
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
      contractAddress: g.contractAddress,
      gateType,
      mintOrContract: (mintOrContract || g.contractAddress) ?? "",
      network: g.network,
      quantity: g.quantity,
      tokenSymbol: g.tokenSymbol,
    };
  });

  return { gates, tokenGated };
}

/** Get token gate config for a resource. */
export async function getTokenGateConfig(
  resourceType: TokenGateResourceType,
  resourceId: string,
): Promise<TokenGateConfig> {
  switch (resourceType) {
    case "category":
      return getCategoryTokenGates(resourceId);
    case "page":
      return getPageTokenGates(resourceId);
    case "product":
      return getProductTokenGates(resourceId);
    default:
      return { gates: [], tokenGated: false };
  }
}

/**
 * Returns category IDs that a product belongs to (for token-gate passthrough from category).
 */
export async function getCategoryIdsForProduct(
  productId: string,
): Promise<string[]> {
  const rows = await db
    .select({ categoryId: productCategoriesTable.categoryId })
    .from(productCategoriesTable)
    .where(eq(productCategoriesTable.productId, productId));
  return rows.map((r) => r.categoryId).filter(Boolean);
}

/**
 * True if the product is token-gated and the user has passed a category gate that
 * satisfies the product's requirement (e.g. category ≥100 PUMP, product ≥50 PUMP).
 * Used on the product page so the user doesn't have to pass the product gate again
 * when they already passed the category gate.
 */
export async function productPassedViaCategoryGate(
  productId: string,
  tgCookieValue: string | undefined,
): Promise<boolean> {
  if (!tgCookieValue?.trim()) return false;
  const productConfig = await getProductTokenGates(productId);
  if (!productConfig.tokenGated || productConfig.gates.length === 0)
    return false;
  const categoryIds = await getCategoryIdsForProduct(productId);
  for (const categoryId of categoryIds) {
    if (!hasValidTokenGateCookie(tgCookieValue, "category", categoryId))
      continue;
    const categoryConfig = await getCategoryTokenGates(categoryId);
    if (
      categoryConfig.tokenGated &&
      categoryConfig.gates.length > 0 &&
      productGatesSatisfiedByCategory(
        productConfig.gates,
        categoryConfig.gates,
      )
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Whether a product's token gates are satisfied by a category's gates.
 * Used when the user has already passed the category gate: if the product
 * requires the same (or a weaker) token requirement, we treat the product as passed.
 * Product passes if at least one product gate is satisfied by some category gate
 * (same token: network + mint/contract or symbol, and category quantity >= product quantity).
 */
export function productGatesSatisfiedByCategory(
  productGates: TokenGateRule[],
  categoryGates: TokenGateRule[],
): boolean {
  if (productGates.length === 0) return true;
  const norm = (s: null | string) => (s ?? "solana").toLowerCase().trim();
  for (const pg of productGates) {
    const pNet = norm(pg.network);
    const pMint = (pg.mintOrContract ?? "").trim().toLowerCase();
    const pSym = (pg.tokenSymbol ?? "").trim().toUpperCase();
    for (const cg of categoryGates) {
      const cNet = norm(cg.network);
      const cMint = (cg.mintOrContract ?? "").trim().toLowerCase();
      const cSym = (cg.tokenSymbol ?? "").trim().toUpperCase();
      const sameToken =
        pNet === cNet &&
        (pMint && cMint ? pMint === cMint : pSym === cSym);
      if (sameToken && cg.quantity >= pg.quantity) return true;
    }
  }
  return false;
}

/**
 * Resolve token symbol + network to mint/contract for balance check.
 * For Solana SPL: any token is supported by setting contractAddress to the token's mint address.
 * When contractAddress is not set, only known symbols (CULT, CRUST) resolve to a default mint.
 */
function resolveMintOrContract(
  tokenSymbol: string,
  network: null | string,
  contractAddress: null | string,
): string {
  const trimmed = contractAddress?.trim();
  if (trimmed) return trimmed;
  if (network?.toLowerCase() === "solana") {
    const symbol = tokenSymbol.toUpperCase();
    if (symbol === "CULT" || symbol === "CRUST") return getCultMintSolana();
  }
  return "";
}

/** Default decimals when mint info is unavailable (e.g. no ATA). */
const DEFAULT_SPL_DECIMALS = 6;

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

  const result = await getTokenBalanceAnyProgram(
    connection,
    mintAddress,
    walletAddress,
  );

  if (result) {
    if (process.env.NODE_ENV === "development") {
      const programName = result.programId.equals(TOKEN_2022_PROGRAM_ID)
        ? "Token-2022"
        : "Token";
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

/**
 * Check if a wallet passes at least one of the given gates (OR).
 * Currently only Solana SPL is implemented; other gate types return false.
 */
export async function walletPassesTokenGates(
  walletAddress: string,
  gates: TokenGateRule[],
): Promise<{ passedGate: null | TokenGateRule; valid: boolean }> {
  for (const gate of gates) {
    if (gate.gateType === "spl") {
      const ok = await checkSolanaGate(walletAddress, gate);
      if (ok) return { passedGate: gate, valid: true };
    }
    // nft / erc20: future
  }
  return { passedGate: null, valid: false };
}
