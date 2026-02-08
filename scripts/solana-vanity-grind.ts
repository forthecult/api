#!/usr/bin/env bun
/**
 * Grind a Solana vanity address that matches BOTH a prefix AND a suffix.
 * Unlike `solana-keygen grind`, this finds ONE keypair that satisfies both.
 *
 * Usage:
 *   bun run scripts/solana-vanity-grind.ts --starts-with CULT --ends-with G1VE
 *   bun run scripts/solana-vanity-grind.ts --starts-with For --ends-with 42
 *
 * Optional:
 *   --outfile <path>   Write keypair JSON here (default: vanity-keypair.json)
 *
 * Base58: avoid 0, O, I, l in your strings.
 */

import { Keypair } from "@solana/web3.js";
import { parseArgs } from "util";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    "starts-with": { type: "string" },
    "ends-with": { type: "string" },
    outfile: { type: "string", default: "vanity-keypair.json" },
  },
  allowPositionals: false,
});

const prefix = values["starts-with"] ?? "";
const suffix = values["ends-with"] ?? "";
const outfile = values.outfile ?? "vanity-keypair.json";

if (!prefix && !suffix) {
  console.error("Usage: bun run scripts/solana-vanity-grind.ts --starts-with <prefix> --ends-with <suffix>");
  console.error("  At least one of --starts-with or --ends-with is required.");
  process.exit(1);
}

console.log(`Grinding for 1 pubkey that starts with '${prefix}' and ends with '${suffix}'...`);
const start = Date.now();
let checked = 0;

while (true) {
  const kp = Keypair.generate();
  const addr = kp.publicKey.toBase58();
  checked += 1;

  const matchStart = !prefix || addr.startsWith(prefix);
  const matchEnd = !suffix || addr.endsWith(suffix);

  if (matchStart && matchEnd) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`${checked} keypairs in ${elapsed}s. Match found.`);
    console.log("Public key:", addr);

    const secret = Array.from(kp.secretKey);
    await Bun.write(outfile, JSON.stringify(secret));
    console.log("Keypair written to", outfile);
    process.exit(0);
  }

  if (checked % 100_000 === 0) {
    process.stderr.write(`\r  ${checked} keypairs checked...`);
  }
}
