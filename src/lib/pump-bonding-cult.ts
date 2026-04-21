/**
 * Pump.fun bonding curve (pre-migration) support for CULT swap.
 * When the token is still on the bonding curve (not yet migrated to PumpSwap),
 * we use the Pump program (6EF8...) buy/sell instructions instead of the AMM pool.
 */

import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  type Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { ComputeBudgetProgram } from "@solana/web3.js";

import { getCultSwapMint } from "~/lib/token-config";
import { TOKEN_2022_PROGRAM_ID_BASE58 } from "~/lib/token-config";

const CULT_DECIMALS = 6;

const PUMP_PROGRAM_ID = new PublicKey(
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
);
const FEE_PROGRAM_ID = new PublicKey(
  "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ",
);
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

const BUY_DISCRIMINATOR = Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]);
const SELL_DISCRIMINATOR = Buffer.from([51, 230, 133, 164, 1, 127, 131, 173]);

const FEE_SEED_CONST = new Uint8Array([
  1, 86, 224, 246, 147, 102, 90, 207, 68, 219, 21, 104, 191, 23, 91, 170, 81,
  137, 203, 151, 245, 210, 255, 59, 101, 93, 43, 182, 253, 109, 24, 176,
]);

const FEE_RECIPIENT = new PublicKey(
  "CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM",
);

const CULT_TOKEN_PROGRAM = new PublicKey(TOKEN_2022_PROGRAM_ID_BASE58);

export interface BondingCurveState {
  complete: boolean;
  creatorPublicKey: PublicKey;
  realSolReserves: bigint;
  realTokenReserves: bigint;
  virtualSolReserves: bigint;
  virtualTokenReserves: bigint;
}

/** SOL -> token amount (bonding curve formula). */
export function bondingBuyQuote(
  solLamports: bigint,
  state: BondingCurveState,
): bigint {
  if (state.complete || solLamports <= 0n) return 0n;
  const k = state.virtualTokenReserves * state.virtualSolReserves;
  const newSolReserves = state.virtualSolReserves + solLamports;
  const newTokenReserves = k / newSolReserves;
  const tokenOut = state.virtualTokenReserves - newTokenReserves;
  return tokenOut > state.realTokenReserves
    ? state.realTokenReserves
    : tokenOut;
}

/** Token amount -> SOL (bonding curve formula, before fee). */
export function bondingSellQuote(
  tokenAmount: bigint,
  state: BondingCurveState,
): bigint {
  if (state.complete || tokenAmount <= 0n) return 0n;
  const k = state.virtualTokenReserves * state.virtualSolReserves;
  const newTokenReserves = state.virtualTokenReserves + tokenAmount;
  const newSolReserves = k / newTokenReserves;
  return state.virtualSolReserves - newSolReserves;
}

export async function buildBondingBuyInstructions(
  connection: Connection,
  userPublicKey: PublicKey,
  solLamports: number,
  slippagePercent = 1.5,
): Promise<{
  estimatedCultRaw: string;
  instructions: TransactionInstruction[];
}> {
  const mint = new PublicKey(getCultSwapMint());
  const state = await getBondingCurveState(connection, mint);
  if (!state || state.complete) {
    throw new Error("Pool account not found");
  }
  const solBn = BigInt(solLamports);
  const tokenOut = bondingBuyQuote(solBn, state);
  if (tokenOut <= 0n) throw new Error("Insufficient liquidity");
  const slippageBps = BigInt(Math.floor(slippagePercent * 100));
  const maxSolCost = (solBn * (10000n + slippageBps)) / 10000n;

  const accs = getBondingCurveAccounts(mint, userPublicKey, state);

  const data = Buffer.alloc(25);
  BUY_DISCRIMINATOR.copy(data, 0);
  data.writeBigUInt64LE(tokenOut, 8);
  data.writeBigUInt64LE(maxSolCost, 16);
  data.writeUInt8(1, 24);

  const buyIx = new TransactionInstruction({
    data,
    keys: [
      { isSigner: false, isWritable: false, pubkey: accs.global },
      { isSigner: false, isWritable: true, pubkey: FEE_RECIPIENT },
      { isSigner: false, isWritable: false, pubkey: mint },
      { isSigner: false, isWritable: true, pubkey: accs.bondingCurve },
      {
        isSigner: false,
        isWritable: true,
        pubkey: accs.associatedBondingCurve,
      },
      { isSigner: false, isWritable: true, pubkey: accs.userAta },
      { isSigner: true, isWritable: true, pubkey: userPublicKey },
      { isSigner: false, isWritable: false, pubkey: SystemProgram.programId },
      { isSigner: false, isWritable: false, pubkey: CULT_TOKEN_PROGRAM },
      { isSigner: false, isWritable: true, pubkey: accs.creatorVault },
      { isSigner: false, isWritable: false, pubkey: accs.eventAuthority },
      { isSigner: false, isWritable: false, pubkey: PUMP_PROGRAM_ID },
      {
        isSigner: false,
        isWritable: true,
        pubkey: accs.globalVolumeAccumulator,
      },
      { isSigner: false, isWritable: true, pubkey: accs.userVolumeAccumulator },
      { isSigner: false, isWritable: false, pubkey: accs.feeConfig },
      { isSigner: false, isWritable: false, pubkey: FEE_PROGRAM_ID },
    ],
    programId: PUMP_PROGRAM_ID,
  });

  const instructions: TransactionInstruction[] = [];
  const ataInfo = await connection.getAccountInfo(accs.userAta);
  if (!ataInfo) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        userPublicKey,
        accs.userAta,
        userPublicKey,
        mint,
        CULT_TOKEN_PROGRAM,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    );
  }
  instructions.push(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
    buyIx,
  );
  return {
    estimatedCultRaw: tokenOut.toString(),
    instructions,
  };
}

export async function buildBondingSellInstructions(
  connection: Connection,
  userPublicKey: PublicKey,
  cultRaw: string,
  slippagePercent = 1.5,
): Promise<{
  estimatedSolLamports: number;
  instructions: TransactionInstruction[];
}> {
  const mint = new PublicKey(getCultSwapMint());
  const state = await getBondingCurveState(connection, mint);
  if (!state || state.complete) {
    throw new Error("Pool account not found");
  }
  const tokenBn = BigInt(cultRaw);
  if (tokenBn <= 0n) throw new Error("CULT amount must be positive");
  const solOut = bondingSellQuote(tokenBn, state);
  if (solOut <= 0n) throw new Error("Insufficient liquidity");
  const slippageBps = BigInt(Math.floor(slippagePercent * 100));
  const minSolOut = (solOut * (10000n - slippageBps)) / 10000n;

  const accs = getBondingCurveAccounts(mint, userPublicKey, state);

  const data = Buffer.alloc(24);
  SELL_DISCRIMINATOR.copy(data, 0);
  data.writeBigUInt64LE(tokenBn, 8);
  data.writeBigUInt64LE(minSolOut, 16);

  const sellIx = new TransactionInstruction({
    data,
    keys: [
      { isSigner: false, isWritable: false, pubkey: accs.global },
      { isSigner: false, isWritable: true, pubkey: FEE_RECIPIENT },
      { isSigner: false, isWritable: false, pubkey: mint },
      { isSigner: false, isWritable: true, pubkey: accs.bondingCurve },
      {
        isSigner: false,
        isWritable: true,
        pubkey: accs.associatedBondingCurve,
      },
      { isSigner: false, isWritable: true, pubkey: accs.userAta },
      { isSigner: true, isWritable: true, pubkey: userPublicKey },
      { isSigner: false, isWritable: false, pubkey: SystemProgram.programId },
      { isSigner: false, isWritable: true, pubkey: accs.creatorVault },
      { isSigner: false, isWritable: false, pubkey: CULT_TOKEN_PROGRAM },
      { isSigner: false, isWritable: false, pubkey: accs.eventAuthority },
      { isSigner: false, isWritable: false, pubkey: PUMP_PROGRAM_ID },
      { isSigner: false, isWritable: false, pubkey: accs.feeConfig },
      { isSigner: false, isWritable: false, pubkey: FEE_PROGRAM_ID },
    ],
    programId: PUMP_PROGRAM_ID,
  });

  return {
    estimatedSolLamports: Number(minSolOut),
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
      sellIx,
    ],
  };
}

export async function estimateCultFromSolBonding(
  connection: Connection,
  solLamports: number,
  slippagePercent = 1.5,
): Promise<null | { cultAmount: string; cultRaw: string }> {
  const mint = new PublicKey(getCultSwapMint());
  const state = await getBondingCurveState(connection, mint);
  if (!state || state.complete) return null;
  const solBn = BigInt(solLamports);
  const tokenOut = bondingBuyQuote(solBn, state);
  if (tokenOut <= 0n) return null;
  const slippageBps = BigInt(Math.floor(slippagePercent * 100));
  const minTokenOut = (tokenOut * (10000n - slippageBps)) / 10000n;
  const cultAmount = (Number(minTokenOut) / 10 ** CULT_DECIMALS).toFixed(
    CULT_DECIMALS,
  );
  return { cultAmount, cultRaw: minTokenOut.toString() };
}

export async function estimateSolFromCultBonding(
  connection: Connection,
  cultRaw: string,
  slippagePercent = 1.5,
): Promise<null | { solAmount: string; solLamports: number }> {
  const mint = new PublicKey(getCultSwapMint());
  const state = await getBondingCurveState(connection, mint);
  if (!state || state.complete) return null;
  const tokenBn = BigInt(cultRaw);
  if (tokenBn <= 0n) return null;
  const solOut = bondingSellQuote(tokenBn, state);
  if (solOut <= 0n) return null;
  const slippageBps = BigInt(Math.floor(slippagePercent * 100));
  const minSolOut = (solOut * (10000n - slippageBps)) / 10000n;
  const solAmount = (Number(minSolOut) / 1e9).toFixed(9);
  return { solAmount, solLamports: Number(minSolOut) };
}

export function getBondingCurvePda(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"), mint.toBuffer()],
    PUMP_PROGRAM_ID,
  );
  return pda;
}

export async function getBondingCurveState(
  connection: Connection,
  mint: PublicKey,
): Promise<BondingCurveState | null> {
  const bondingCurve = getBondingCurvePda(mint);
  const info = await connection.getAccountInfo(bondingCurve);
  if (!info?.data || info.data.length < 81) return null;
  const data = info.data;
  const virtualTokenReserves = data.readBigUInt64LE(8);
  const virtualSolReserves = data.readBigUInt64LE(16);
  const realTokenReserves = data.readBigUInt64LE(24);
  const realSolReserves = data.readBigUInt64LE(32);
  const complete = data[48] === 1;
  const creatorPublicKey = new PublicKey(data.subarray(49, 81));
  return {
    complete,
    creatorPublicKey,
    realSolReserves,
    realTokenReserves,
    virtualSolReserves,
    virtualTokenReserves,
  };
}

function getBondingCurveAccounts(
  mint: PublicKey,
  userPubkey: PublicKey,
  state: BondingCurveState,
) {
  const bondingCurve = getBondingCurvePda(mint);
  const [global] = PublicKey.findProgramAddressSync(
    [Buffer.from("global")],
    PUMP_PROGRAM_ID,
  );
  const [associatedBondingCurve] = PublicKey.findProgramAddressSync(
    [bondingCurve.toBuffer(), CULT_TOKEN_PROGRAM.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const [eventAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("__event_authority")],
    PUMP_PROGRAM_ID,
  );
  const [globalVolumeAccumulator] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_volume_accumulator")],
    PUMP_PROGRAM_ID,
  );
  const [userVolumeAccumulator] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_volume_accumulator"), userPubkey.toBuffer()],
    PUMP_PROGRAM_ID,
  );
  const [feeConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("fee_config"), FEE_SEED_CONST],
    FEE_PROGRAM_ID,
  );
  const [creatorVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("creator-vault"), state.creatorPublicKey.toBuffer()],
    PUMP_PROGRAM_ID,
  );
  const userAta = getAssociatedTokenAddressSync(
    mint,
    userPubkey,
    true,
    CULT_TOKEN_PROGRAM,
  );
  return {
    associatedBondingCurve,
    bondingCurve,
    creatorVault,
    eventAuthority,
    feeConfig,
    global,
    globalVolumeAccumulator,
    userAta,
    userVolumeAccumulator,
  };
}
