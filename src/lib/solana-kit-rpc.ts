/**
 * server-side helpers for talking to solana via @solana/kit.
 *
 * kit is the v2 rewrite of @solana/web3.js: functional, tree-shakeable, branded
 * Address strings, webcrypto-native signatures. this module is the single entry
 * point we use in rsc / route-handler code paths that have been migrated off v1.
 *
 * scope: read-only rpc. signing, instruction building and solana-pay flows are
 * still on v1 — those migrations are blocked on @solana/wallet-adapter v2 and
 * @solana/pay v2 landing upstream. adding new kit callers should prefer the
 * helpers here over sprinkling createSolanaRpc() around.
 */

import "server-only";
import {
  address,
  type Address,
  createSolanaRpc,
  getAddressEncoder,
  getProgramDerivedAddress,
  type Rpc,
  type SolanaRpcApi,
} from "@solana/kit";

import { getSolanaRpcUrlServer } from "~/lib/solana-pay";

/** classic spl-token program. owns mints created without extensions. */
export const TOKEN_PROGRAM_ADDRESS: Address = address(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);

/** token-2022 (token extensions) program. cult is a token-2022 mint. */
export const TOKEN_2022_PROGRAM_ADDRESS: Address = address(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
);

const ASSOCIATED_TOKEN_PROGRAM_ADDRESS: Address = address(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

// memoize one rpc client per process per endpoint — createSolanaRpc builds a
// http transport + codec chain that's safe to reuse across requests. if the
// env changes (test harness, etc.) we rebuild.
let cachedRpc: null | Rpc<SolanaRpcApi> = null;
let cachedUrl: null | string = null;

export interface KitTokenBalance {
  amount: bigint;
  decimals: number;
  programId: Address;
  /** display string straight from rpc, e.g. "1.234567". empty string if rpc omitted it. */
  uiAmountString: string;
}

/**
 * derive the associated-token-account pda for (owner, mint, tokenProgram).
 * pure address math, no rpc round trip. mirrors spl-token's
 * `getAssociatedTokenAddressSync` but with kit types.
 */
export async function getAssociatedTokenAddress(
  owner: Address | string,
  mint: Address | string,
  tokenProgram: Address = TOKEN_PROGRAM_ADDRESS,
): Promise<Address> {
  const enc = getAddressEncoder();
  const ownerAddr = typeof owner === "string" ? address(owner) : owner;
  const mintAddr = typeof mint === "string" ? address(mint) : mint;
  const [ata] = await getProgramDerivedAddress({
    programAddress: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
    seeds: [
      enc.encode(ownerAddr),
      enc.encode(tokenProgram),
      enc.encode(mintAddr),
    ],
  });
  return ata;
}

export function getSolanaKitRpc(): Rpc<SolanaRpcApi> {
  const url = getSolanaRpcUrlServer();
  if (cachedRpc && cachedUrl === url) return cachedRpc;
  cachedRpc = createSolanaRpc(url);
  cachedUrl = url;
  return cachedRpc;
}

/**
 * spl token balance lookup for (wallet, mint) that transparently handles
 * either token program. tries `preferredProgram` first (use when the caller
 * knows which program the mint lives under — cheaper, one rpc hop instead of
 * two), then falls back to the other.
 *
 * returns null when no ata exists under either program (which is also what
 * "zero balance with no account" looks like on chain).
 */
export async function getTokenBalanceAnyProgramKit(
  mint: Address | string,
  wallet: Address | string,
  preferredProgram?: Address,
): Promise<KitTokenBalance | null> {
  const rpc = getSolanaKitRpc();
  const order: Address[] =
    preferredProgram === TOKEN_2022_PROGRAM_ADDRESS
      ? [TOKEN_2022_PROGRAM_ADDRESS, TOKEN_PROGRAM_ADDRESS]
      : [TOKEN_PROGRAM_ADDRESS, TOKEN_2022_PROGRAM_ADDRESS];

  for (const programId of order) {
    try {
      const ata = await getAssociatedTokenAddress(wallet, mint, programId);
      const info = await rpc.getTokenAccountBalance(ata).send();
      return {
        amount: BigInt(info.value.amount),
        decimals: info.value.decimals,
        programId,
        uiAmountString: info.value.uiAmountString ?? "",
      };
    } catch {
      // account not found under this program — try the next one. rpc throws
      // AccountNotFound as a structured error, but we don't need to
      // distinguish it from network errors for this read path.
    }
  }
  return null;
}
