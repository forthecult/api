#!/usr/bin/env bun
/**
 * Read a keypair from a JSON file (array of 64 numbers) and print its base58
 * secret key. Use for BUYBACK_WALLET_SECRET_KEY etc.
 *
 * Usage: bun run scripts/json-keypair-to-base58.ts [path]
 * Default path: ~/address.json
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import bs58 from "bs58";

const path = process.argv[2] ?? resolve(process.env.HOME ?? "", "address.json");
const raw = readFileSync(path, "utf8");
const k = JSON.parse(raw) as number[];
const bytes = Uint8Array.from(k);
const encoded = bs58.encode(bytes);
console.log(encoded);
