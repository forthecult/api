<!-- INTERNAL — DO NOT PUBLISH. Contains sensitive configuration details. -->
<!-- If this repository is public, move this file outside the repo or add it to .gitignore. -->
# Buyback & Burn for Pump.fun Token

The token sends a share of trading volume (e.g. 1% or 5%) to a designated wallet. This doc describes how to use that wallet to **buy back** the token and **burn** it.

## Flow

1. **Fee wallet** receives SOL (or the quote asset) from pump.fun creator/volume fees.
2. **Buy back**: Swap that SOL for the project token (CULT) on the pump SOL pool.
3. **Burn**: Burn the bought tokens via SPL `burn` so supply decreases.

## Token-2022 (and standard SPL)

Yes — the script works with **Token-2022** as well as the legacy SPL Token Program. Pump.fun tokens can be either; the buyback script uses the **token program from the pool/mint** (from the pump-swap SDK’s `swapSolanaState`). So when your CULT mint is Token-2022, the swap and the burn instruction both use `Token-2022` program IDs; no extra config or env is required. Set `CULT_TOKEN_MINT_SOLANA` to your token’s mint address (the CA) and it will work for both standards.

## Options

| Approach | Pros | Cons |
|----------|------|------|
| **Automated script (recommended)** | Consistent, transparent, can run on cron | Needs a server or cron host; wallet key must be secure |
| **Manual** | No automation to secure | Easy to forget; inconsistent; you sign each time |
| **Third-party bot** | No code to run | Less control; trust and possible fees |

## Smart contract vs server

### Can a smart contract do buyback and burn automatically?

**In theory, yes** — but on Solana it usually still involves an off-chain trigger and some constraints.

- **Who receives the fees?** Pump.fun sends the creator-fee share to a **wallet address** you configure. That address is typically an EOA (keypair). Solana programs (smart contracts) don’t have a keypair; they have PDAs. So for a **program** to hold and spend that SOL, pump would need to send fees to a **PDA** owned by your program. Many fee systems only support “send to this pubkey”; if pump only supports EOA addresses, the fee recipient stays an EOA and a program can’t hold it directly.

- **What the program would do.** If fees could go to a PDA of your program, you’d write a program with an instruction that: (1) reads SOL (or wrapped SOL) from the PDA, (2) CPIs to a DEX (pump swap or Jupiter) to swap SOL → CULT, (3) burns the received CULT. The logic would be on-chain and verifiable.

- **Who triggers it?** Programs don’t run by themselves. Something has to send the transaction that calls your “buyback and burn” instruction. So you still need a **crank**: a bot, a cron job on a server, or an on-chain scheduler (e.g. Clockwork) that periodically sends that transaction. So “smart contract” doesn’t remove the need for a trigger; it only moves the swap+burn logic on-chain.

- **Trade-offs.**  
  - **Smart contract**: Logic is on-chain and auditable; fee recipient could be a PDA (if supported). You must write, deploy, and maintain a Solana program, and still run a crank (server or Clockwork).  
  - **Server + script**: No program to deploy or audit; the keypair stays in env on a server that runs the script on a schedule. Simpler operation; the “logic” is in your repo (the script). Single point of failure is the server and key storage.

**Recommendation:** Use the **server + cron script** unless you specifically want on-chain logic and are able to (1) have fees sent to a program PDA (if pump supports it) or (2) use a two-step flow (e.g. sweep from EOA to program first). For most pump.fun setups, the fee wallet is an EOA, so the script approach is the most straightforward and can run on a small instance (e.g. Railway).

## Recommended: Automated script

- Run a script on a **schedule** (e.g. daily or when balance &gt; threshold).
- Script: check fee wallet SOL balance → if above `MIN_SOL_BALANCE`, swap SOL → CULT on the **canonical pump pool**, then **burn** the received CULT in the same transaction (or immediately after).
- Use the **pump-swap SDK** for the swap (same pool as your token page) and **@solana/spl-token** `createBurnInstruction` for the burn.

### Swap vs burn in one tx

- **One transaction**: Swap instructions + burn instruction. You know the exact token amount from the swap math (`buyQuoteInput`), so you can burn that amount in the same tx. Fewer signatures and one block.
- **Two transactions**: Swap, then in a second tx burn the balance of the wallet’s CULT ATA. Simpler if you prefer “burn whatever we have” and don’t want to thread the exact amount.

### Security

- Store the fee wallet **private key** in env (e.g. `BUYBACK_WALLET_SECRET_KEY`) on a secure server; never commit it.
- Run the script in a **restricted environment** (e.g. single-purpose VM or serverless with minimal permissions).
- Leave a **SOL reserve** (e.g. 0.01 SOL) so the wallet can always pay for the next run’s fees.

## Script usage

From repo root:

```bash
# Required env (see .env.example):
# BUYBACK_WALLET_SECRET_KEY=base58_private_key
# CULT_TOKEN_MINT_SOLANA=your_cult_mint
# SOLANA_RPC_URL=https://api.mainnet-beta.solana.com  # or your RPC

bun run scripts/buyback-burn.ts
```

Optional env:

- `BUYBACK_MIN_SOL` – only run if balance ≥ this (default 0.05)
- `BUYBACK_SOL_RESERVE` – SOL to leave in wallet (default 0.01)
- `BUYBACK_SLIPPAGE_BPS` – slippage in basis points (default 100 = 1%)
- `DRY_RUN=true` – log what would be done without sending tx

Schedule with cron, e.g. daily at 00:00:

```cron
0 0 * * * cd /path/to/ftc && BUYBACK_WALLET_SECRET_KEY=... CULT_TOKEN_MINT_SOLANA=... bun run scripts/buyback-burn.ts
```

### Railway setup (step-by-step)

Use a **separate Railway service** that only runs the buyback script on a schedule. You can add all variables now except the token CA (mint address); add that after you deploy the token.

1. **Create a new service**
   - In your Railway project, click **+ New** → **GitHub Repo** (or **Empty Service** if you deploy another way).
   - If using the same repo as your main app: choose the same repo, then we’ll point this service at the `ftc` folder.

2. **Set root directory**
   - In the new service, go to **Settings** → **General**.
   - Set **Root Directory** to `ftc` (so the service uses the folder that has `package.json` and `scripts/buyback-burn.ts`).

3. **Build**
   - Under **Settings** → **Build**, set **Build Command** to:
     ```bash
     bun install --frozen-lockfile
     ```
   - We only need dependencies; no Next.js build. Leave **Output Directory** empty (or default).

4. **Start command (what runs each time)**
   - Under **Settings** → **Deploy**, set **Start Command** to:
     ```bash
     bun run buyback-burn
     ```
   - The script runs once and exits. For a cron job that’s correct: Railway will run this command on the schedule you set.

5. **Cron schedule**
   - In **Settings**, find **Cron Schedule** (or **Cron**).
   - Set it to run daily at midnight UTC, e.g.:
     ```
     0 0 * * *
     ```
   - (Minute 0, hour 0 = midnight UTC, every day.) Railway will start the service at that time, run the start command, and the process exits when the script finishes.

6. **Environment variables**
   - In the service, open **Variables** and add:
     - **Required (add now):**
       - `SKIP_NEXT_BUILD=true` – so Railway’s default `bun run build` step skips the Next.js build (this service only needs deps). Without this, the build will fail with `DATABASE_URL` not set.
       - `BUYBACK_WALLET_SECRET_KEY` – base58 or JSON-array private key for the fee/buyback wallet (the one that receives the % of volume). Keep this secret.
       - `SOLANA_RPC_URL` – e.g. `https://api.mainnet-beta.solana.com` or a paid RPC (Helius, QuickNode, etc.).
     - **Required (add after token is live):**
       - `CULT_TOKEN_MINT_SOLANA` – the token’s **mint address** (the “CA”). Once you have it from pump.fun, add this; until then the script will error with “Missing CULT_TOKEN_MINT_SOLANA” when the cron runs, which is expected.
     - **Optional:**
       - `BUYBACK_MIN_SOL` – only run buyback if wallet balance ≥ this (default `0.05`).
       - `BUYBACK_SOL_RESERVE` – SOL to leave in the wallet (default `0.01`).
       - `BUYBACK_SLIPPAGE_BPS` – e.g. `100` for 1%.
       - `DRY_RUN=true` – set to `true` to test without sending a real tx (script will log and exit).

7. **Deploy**
   - Trigger a deploy (push to the repo or **Deploy** in Railway). The first run will happen at the next cron time. Until you set `CULT_TOKEN_MINT_SOLANA`, the script will exit with a clear error when it runs; that’s fine.
   - After you have the token CA, add `CULT_TOKEN_MINT_SOLANA` in Variables and (if you want an immediate run) trigger a manual deploy or wait for the next scheduled run.

8. **Optional: limit redeploys**
   - If this service shares the repo with your main app, you may want redeploys only when buyback-related code changes. In **Settings** → **Build**, you can set **Watch Paths** to e.g. `ftc/package.json ftc/scripts/buyback-burn.ts ftc/bun.lock` so other changes don’t redeploy this service.

**Summary:** New service → root `ftc` → build `bun install --frozen-lockfile` → start `bun run buyback-burn` → cron `0 0 * * *` → add env vars (CA later). Once the CA is set, the next cron run will perform buyback and burn when the wallet has enough SOL.

## Alternative: Jupiter

For best execution across multiple DEXes (including pump), you can use **Jupiter’s Swap API** instead of only the pump-swap SDK:

1. **Quote**: `GET https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=<CULT_MINT>&amount=<lamports>&slippageBps=100`
2. **Swap**: `POST https://quote-api.jup.ag/v6/swap` with the quote and user pubkey to get a serialized transaction.
3. Sign and send with the fee wallet keypair, then burn the received CULT as above.

The repo script uses the **pump-swap SDK** only so you have no extra dependencies and behavior matches your existing pump price/display logic.

## Burn address vs SPL burn

- **SPL burn**: Use `createBurnInstruction` from `@solana/spl-token`. This reduces the token’s supply on-chain and is the preferred, verifiable approach.
- **Send to burn address**: Sending to an address no one controls (e.g. `1nc1nerator11111111111111111111111111111111`) removes tokens from circulation but does not reduce supply; many projects still call this “burn” for simplicity. For true supply reduction, use the burn instruction.
