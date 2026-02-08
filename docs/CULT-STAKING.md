# CULT On-Chain Staking Program

Program-based staking for the CULT token on Solana. Users stake CULT into a pool; staked balance counts toward **voting power** on the Stake & Vote page.

## Overview

- **Program**: `programs/cult_staking` (Anchor 0.30)
- **Instructions**: `initialize` (one-time pool setup), `stake`, `unstake`
- **No lock period**: Users can unstake anytime.
- **Voting power**: App uses wallet CULT balance + staked balance from the program.

## Build & Deploy

### Prerequisites

- [Rust](https://rustup.rs/) (1.75+)
- [Anchor](https://www.anchor-lang.com/docs/installation) (`avm install 0.30.1 && avm use 0.30.1`)
- Solana CLI (`solana config set --url mainnet-beta` or devnet)

### Build

From the `relivator/programs` directory (Anchor workspace lives here so the app root stays Node-only for deployment):

```bash
cd programs && anchor build
```

The program binary is in `programs/target/deploy/`. The program ID is in `programs/cult_staking/src/lib.rs` (`declare_id!(...)`). After first build, run `anchor keys list` to see the keypair; deploy with that keypair or replace the ID in the code and rebuild.

### Deploy (e.g. devnet)

```bash
cd programs
solana config set --url devnet
anchor deploy --provider.cluster devnet
```

Note the **Program ID** from the deploy output (or from `declare_id!` if you used a custom keypair).

### Initialize the pool

After deploy, someone must call `initialize` once with the CULT mint and payer. You can use Anchor CLI or a script:

- **Payer**: Pays for the pool account and vault ATA creation.
- **Mint**: CULT token mint (same as `CULT_TOKEN_MINT_SOLANA`).
- **Token program**: Use `Token` (default) or `Token-2022` depending on your CULT mint.

Example (pseudo):

```bash
# Using anchor run or a custom script that invokes:
# initialize({ mint: CULT_MINT, ... })
```

The app does not call `initialize`; it is a one-time admin step.

## App configuration

Set in `.env`:

- **`CULT_STAKING_PROGRAM_ID`** (server): The deployed program ID. Required for voting power (wallet + staked), staked balance API, and stake/unstake prepare endpoints.
- **`NEXT_PUBLIC_CULT_STAKING_PROGRAM_ID`** (optional, client): Same ID if you need it in the browser (e.g. for display). Server uses `CULT_STAKING_PROGRAM_ID`.
- **`CULT_TOKEN_MINT_SOLANA`**: CULT mint (must match the mint used when initializing the pool).

If `CULT_STAKING_PROGRAM_ID` is not set, the app still works: voting power = wallet balance only, and the stake/unstake prepare APIs return 503.

## Flow

1. **Stake**: User enters amount → app calls `POST /api/governance/stake/prepare` → server builds transaction → client receives base64 tx → wallet signs and sends.
2. **Unstake**: Same with `POST /api/governance/unstake/prepare`.
3. **Voting power**: `GET /api/governance/voting-power?wallet=` returns wallet + staked balance (from program) and is used for proposal voting weight.

## Program accounts

- **StakePool** (PDA `["pool"]`): `mint`, `vault` (ATA of pool PDA for mint), `bump`.
- **UserStake** (PDA `["stake", pool, user]`): `owner`, `amount` (raw u64).
- **Vault**: ATA(mint, pool_pda) — holds all staked CULT; pool PDA is authority so the program can sign for unstake.

## Security

- Only the pool PDA can sign for vault transfers (unstake).
- One stake account per user per pool; amount is incremented on stake and decremented on unstake.
- No rewards or lock in this version; rewards (e.g. from creator fee) can be added later.
