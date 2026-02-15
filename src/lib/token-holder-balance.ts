/**
 * Check if a user has at least minBalance of a token in any linked wallet.
 * Used for token-holder free shipping (automatic coupons).
 */

import { Connection } from "@solana/web3.js";
import { eq } from "drizzle-orm";
import { createPublicClient, http, parseAbiItem } from "viem";
import { mainnet } from "viem/chains";

import { db } from "~/db";
import { userWalletsTable } from "~/db/schema";
import { getSolanaRpcUrlServer } from "~/lib/solana-pay";
import { getTokenBalanceAnyProgram } from "~/lib/solana-token-utils";

const SOLANA_DECIMALS = 6;
const EVM_DECIMALS = 18;

function parseMinBalanceHuman(
  minBalanceStr: string | null | undefined,
): number {
  if (!minBalanceStr || minBalanceStr.trim() === "") return 0;
  const parsed = Number.parseFloat(minBalanceStr.trim());
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

/**
 * Check Solana SPL token balance for a wallet. Returns raw amount (with decimals).
 * Supports both standard SPL tokens (Token Program) and Token-2022 tokens.
 */
async function getSolanaTokenBalance(
  connection: Connection,
  mintAddress: string,
  walletAddress: string,
): Promise<bigint> {
  const result = await getTokenBalanceAnyProgram(
    connection,
    mintAddress,
    walletAddress,
  );
  return result?.amount ?? 0n;
}

/**
 * Check EVM ERC20 balance for a wallet. Returns raw amount (with decimals).
 */
async function getEvmTokenBalance(
  chainId: number,
  tokenAddress: `0x${string}`,
  walletAddress: `0x${string}`,
): Promise<bigint> {
  try {
    const rpcUrl = process.env.ETHEREUM_RPC_URL ?? "https://rpc.ankr.com/eth";
    const client = createPublicClient({
      chain: mainnet, // could map chainId to chain
      transport: http(rpcUrl),
    });
    const balance = await client.readContract({
      address: tokenAddress,
      abi: [parseAbiItem("function balanceOf(address) view returns (uint256)")],
      functionName: "balanceOf",
      args: [walletAddress],
    });
    return balance as bigint;
  } catch {
    return 0n;
  }
}

/**
 * Returns true if the user has at least minBalance (human-readable, e.g. "1") of the token
 * in any linked wallet on the given chain.
 */
export async function userMeetsTokenHolderCondition(
  userId: string,
  chain: "solana" | "evm",
  tokenAddress: string,
  minBalanceStr: string,
): Promise<boolean> {
  const minHuman = parseMinBalanceHuman(minBalanceStr);
  if (minHuman <= 0) return false;

  const decimals = chain === "solana" ? SOLANA_DECIMALS : EVM_DECIMALS;
  const minRaw = BigInt(Math.floor(minHuman * 10 ** decimals));

  const wallets = await db
    .select({
      address: userWalletsTable.address,
      chain: userWalletsTable.chain,
    })
    .from(userWalletsTable)
    .where(eq(userWalletsTable.userId, userId));

  const chainFilter = chain === "solana" ? "solana" : "evm";
  const relevantWallets = wallets.filter((w) => w.chain === chainFilter);

  if (relevantWallets.length === 0) return false;

  if (chain === "solana") {
    const connection = new Connection(getSolanaRpcUrlServer());
    for (const w of relevantWallets) {
      const balance = await getSolanaTokenBalance(
        connection,
        tokenAddress,
        w.address,
      );
      if (balance >= minRaw) return true;
    }
    return false;
  }

  if (chain === "evm") {
    const chainId = 1; // default mainnet; could be passed or from coupon
    const token = tokenAddress.startsWith("0x")
      ? (tokenAddress as `0x${string}`)
      : (`0x${tokenAddress}` as `0x${string}`);
    for (const w of relevantWallets) {
      const addr = w.address.startsWith("0x")
        ? (w.address as `0x${string}`)
        : (`0x${w.address}` as `0x${string}`);
      const balance = await getEvmTokenBalance(chainId, token, addr);
      if (balance >= minRaw) return true;
    }
    return false;
  }

  return false;
}
