# Token Gating

Token gating restricts access to **products**, **categories**, and **pages** until the visitor proves they hold the required tokens (e.g. Solana SPL). It can also power **perks** like free shipping or order discounts for token holders.

## How it works

1. **Resource** (product, category, or page) has one or more **token gates** (e.g. “≥ 1000 CULT” or “≥ 1 WHALE on Solana”).
2. When a visitor opens a token-gated page, they see a **Connect wallet** prompt.
3. They connect a Solana wallet, then **sign a message** to prove they control it.
4. The server **verifies the signature** and checks the wallet’s **token balance**.
5. If they hold at least one of the required tokens (OR logic), they get access; otherwise they see an error and can try again.

## Where it applies

- **Products**: `product` table has `token_gated` and legacy single-gate fields; `product_token_gate` holds multiple gates per product.
- **Categories**: `category` table has `token_gated` and legacy fields; `category_token_gate` holds multiple gates per category.
- **Pages**: `page_token_gate` holds gates by **page slug** (e.g. `about`, `token`). Any slug with at least one row is token-gated.

The storefront uses `TokenGateGuard` on `[slug]` for both product and category views. You can wrap any route with `TokenGateGuard` by passing `resourceType` and `resourceId` (product id/slug, category id/slug, or page slug).

## APIs

- **GET** `/api/token-gate?resourceType=product|category|page&resourceId=...`  
  Returns `{ tokenGated, gates }` for the resource.

- **POST** `/api/token-gate/challenge`  
  Body: `{ address }` (Solana wallet). Returns `{ message }` to sign.

- **POST** `/api/token-gate/validate`  
  Body: `{ address, message, signature | signatureBase58, resourceType, resourceId }`.  
  Verifies signature and balance; returns `{ valid, passedGate? }`.

## Current implementation

- **Solana SPL tokens** are supported: the server resolves token symbol/network to a mint (e.g. CULT via `CULT_TOKEN_MINT_SOLANA` or default test mint), then checks SPL balance for the connected wallet.
- **Gate logic**: the user must satisfy **at least one** gate (OR). Each gate is “hold ≥ X of token Y”.

## Extensibility

### NFTs

- Add a gate type (e.g. `nft`) and in `walletPassesTokenGates` check NFT ownership (e.g. Solana Metaplex, EVM ERC-721) instead of fungible balance.
- Schema already has `network` and `contractAddress`; for NFTs you can store collection address or mint and implement a “holds at least one” check.

### EVM (ERC-20 and beyond)

- Reuse the same challenge/validate flow for an EVM address: add an EVM challenge endpoint that returns a message, verify signature (e.g. `personal_sign` / EIP-191), then check ERC-20 balance or NFT ownership on the given chain.
- `token-holder-balance.ts` already has `getEvmTokenBalance`; you can plug that into a new gate type (e.g. `erc20`) in `walletPassesTokenGates` and resolve `contractAddress` by network/symbol.

### Perks (free shipping, discounts)

- The same **gate resolution** (e.g. “does this user hold ≥ X of token Y?”) can drive perks:
  - **Free shipping**: In shipping calculation or coupon logic, call the same balance checks (e.g. `userMeetsTokenHolderCondition` in `token-holder-balance.ts` for **logged-in** users with linked wallets, or use the token-gate validate flow for **guest** visitors who just connected for the page).
  - **Order / product discount**: When applying a “token holder” coupon or a product-level discount, resolve the required token and min quantity, then check the payer’s linked wallet (or the wallet they used for token-gate validation) against that gate.
- No new tables are strictly required: reuse `product_token_gate`, `category_token_gate`, and coupon/configuration that references token + min balance. The token-gate lib’s `getTokenGateConfig` and balance helpers can be shared between “access” and “perks”.

## Database

- **New table**: `page_token_gate` (id, page_slug, token_symbol, quantity, network, contract_address). Create it with `bun run db:push` when the DB is available.
- Products and categories already have `product_token_gate` and `category_token_gate`; token gating uses those plus the new page table.

## Env

- **CULT_TOKEN_MINT_SOLANA**: Solana mint address for CULT/CRUST gates when the gate has no Contract Address (optional; falls back to a default pump.fun mint). If your community holds a different token (e.g. a different "Crustafarianism" mint), set this to that token’s mint so the gate checks the right one. You can copy the mint from your wallet (e.g. Phantom: open the token → Token address / Mint).
- **SOLANA_RPC_URL** / **NEXT_PUBLIC_SOLANA_RPC_URL**: Used for balance checks and wallet verification.

For **any SPL token**: create a gate with **Contract Address** set to the token’s mint (in admin). Then the gate uses that mint instead of the symbol-based default.
