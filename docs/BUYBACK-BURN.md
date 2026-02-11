<!-- INTERNAL — DO NOT PUBLISH. Contains sensitive configuration details. -->
<!-- If this repository is public, move this file outside the repo or add it to .gitignore. -->
# Buyback & Burn for Pump.fun Token

The token sends a share of trading volume (e.g. 1% or 5%) to a designated wallet. This doc describes how to use that wallet to **buy back** the token and **burn** it.

## Flow

1. **Fee wallet** receives SOL (or the quote asset) from pump.fun creator/volume fees.
2. **Buy back**: Swap that SOL for the project token (CULT) on the pump SOL pool.
3. **Burn**: Burn the bought tokens via SPL `burn` so supply decreases.

## Options

| Approach | Pros | Cons |
|----------|------|------|
| **Automated script (recommended)** | Consistent, transparent, can run on cron | Needs a server or cron host; wallet key must be secure |
| **Manual** | No automation to secure | Easy to forget; inconsistent; you sign each time |
| **Third-party bot** | No code to run | Less control; trust and possible fees |

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
0 0 * * * cd /path/to/relivator && BUYBACK_WALLET_SECRET_KEY=... CULT_TOKEN_MINT_SOLANA=... bun run scripts/buyback-burn.ts
```

## Alternative: Jupiter

For best execution across multiple DEXes (including pump), you can use **Jupiter’s Swap API** instead of only the pump-swap SDK:

1. **Quote**: `GET https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=<CULT_MINT>&amount=<lamports>&slippageBps=100`
2. **Swap**: `POST https://quote-api.jup.ag/v6/swap` with the quote and user pubkey to get a serialized transaction.
3. Sign and send with the fee wallet keypair, then burn the received CULT as above.

The repo script uses the **pump-swap SDK** only so you have no extra dependencies and behavior matches your existing pump price/display logic.

## Burn address vs SPL burn

- **SPL burn**: Use `createBurnInstruction` from `@solana/spl-token`. This reduces the token’s supply on-chain and is the preferred, verifiable approach.
- **Send to burn address**: Sending to an address no one controls (e.g. `1nc1nerator11111111111111111111111111111111`) removes tokens from circulation but does not reduce supply; many projects still call this “burn” for simplicity. For true supply reduction, use the burn instruction.
