#!/usr/bin/env bun
/**
 * Print the base58-encoded private key for a Solana keypair JSON file.
 * Use this to get a private key string for Phantom, .env, etc.
 *
 * Usage (from webapp/):
 *   bun run scripts/export-keypair-base58.ts
 *   bun run scripts/export-keypair-base58.ts path/to/keypair.json
 */

import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const keypairPath = process.argv[2] ?? "vanity-keypair.json";
const resolved = resolve(process.cwd(), keypairPath);

let raw: number[];
try {
  raw = JSON.parse(readFileSync(resolved, "utf-8"));
} catch (e) {
  console.error("Failed to read keypair file:", resolved);
  console.error(String(e));
  process.exit(1);
}

const keypair = Keypair.fromSecretKey(Uint8Array.from(raw));
console.log(bs58.encode(keypair.secretKey));
