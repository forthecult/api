<!-- INTERNAL — DO NOT PUBLISH. Contains sensitive configuration details. -->
<!-- If this repository is public, move this file outside the repo or add it to .gitigunore. -->
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

From the `ftc/programs` directory (Anchor workspace lives here so the app root stays Node-only for deployment):

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

## Tier history (daily snapshots)

Tier and staked amount are recorded daily per linked Solana wallet in `membership_tier_history`. This powers the **Tier history** section in admin (customer detail → Membership & staking), e.g. “Tier 3 for 3 months, then Tier 2”.

### Snapshot script

Run once per day (e.g. cron at 00:05 UTC):

```bash
cd webapp && bun run scripts/membership-tier-history-snapshot.ts
```

- **Required env**: `DATABASE_URL`. Optional: `CULT_STAKING_PROGRAM_ID` (if unset, rows get tier=null, staked=0).
- **Optional**: `SNAPSHOT_DATE=YYYY-MM-DD` (default: today UTC), `DRY_RUN=true` (log only).

Cron example:

```bash
5 0 * * * cd /path/to/webapp && bun run scripts/membership-tier-history-snapshot.ts
```

Create the table first: `bun run db:push` (or run your migrations).

## Flow

1. **Stake**: User enters amount → app calls `POST /api/governance/stake/prepare` → server builds transaction → client receives base64 tx → wallet signs and sends.
2. **Unstake**: Same with `POST /api/governance/unstake/prepare`.
3. **Voting power**: `GET /api/governance/voting-power?wallet=` returns wallet + staked balance (from program) and is used for proposal voting weight.

## Program accounts

- **StakePool** (PDA `["pool"]`): `mint`, `vault` (ATA of pool PDA for mint), `bump`.
- **UserStake** (PDA `["stake", pool, user]`): `owner`, `amount` (raw u64).
- **Vault**: ATA(mint, pool_pda) — holds all staked CULT; pool PDA is authority so the program can sign for unstake.

## Auto-distribution of SOL to stakers

SOL (or other rewards) can be sent to stakers proportionally using a **cron job** and the script `scripts/staking-rewards-distribute.ts`.

### How it works

1. The script calls `getProgramAccounts` on the staking program to fetch all `UserStake` accounts (owner + amount).
2. It computes each staker’s share of a fixed SOL amount: `(staker_amount / total_staked) * reward_sol`.
3. It sends SOL from a dedicated **rewards wallet** to each staker’s wallet (the `owner` of each stake account) in batches of transactions.

### Setup

1. **Rewards wallet**  
   Create a Solana wallet used only for staking rewards. Fund it with SOL (e.g. from the “5% Staked holders” creator fee allocation).

2. **Environment** (for the machine that runs the script, e.g. cron or CI):

   - `STAKING_REWARDS_WALLET_SECRET_KEY` – base58 or JSON array private key of the rewards wallet.
   - `CULT_STAKING_PROGRAM_ID` – staking program ID.
   - `REWARD_SOL_TOTAL` – SOL to distribute in this run (e.g. `0.5`).
   - Optional: `MIN_STAKER_LAMPORTS` (default 1000) – skip stakers whose share is below this.
   - Optional: `SOLANA_RPC_URL`, `DRY_RUN=true`, `BATCH_SIZE` (default 8).

3. **Run manually**

   ```bash
   REWARD_SOL_TOTAL=0.5 STAKING_REWARDS_WALLET_SECRET_KEY=... CULT_STAKING_PROGRAM_ID=... bun run scripts/staking-rewards-distribute.ts
   ```

4. **Run automatically (cron)**  
   Example: weekly on Sunday at midnight:

   ```bash
   0 0 * * 0 cd /path/to/ftc && REWARD_SOL_TOTAL=0.5 STAKING_REWARDS_WALLET_SECRET_KEY=... CULT_STAKING_PROGRAM_ID=... bun run scripts/staking-rewards-distribute.ts
   ```

   Use your preferred way to inject env (e.g. a `.env` file only on the server, or your cron env).

5. **Where the SOL comes from**  
   Fund the rewards wallet from your treasury or from the share of fees you allocate to stakers (e.g. the 5% “Staked holders” creator fee). You can run a separate process that periodically sweeps that fee wallet into the rewards wallet, or send SOL manually before each distribution.

### Safety

- Use **DRY_RUN=true** first to log payouts without sending.
- Keep `STAKING_REWARDS_WALLET_SECRET_KEY` only on the server that runs the script; never commit it.
- Start with small `REWARD_SOL_TOTAL` to verify, then increase.

## Security

- Only the pool PDA can sign for vault transfers (unstake).
- One stake account per user per pool; amount is incremented on stake and decremented on unstake.
- Rewards are sent by an off-chain script from a dedicated wallet; the on-chain program does not hold or send SOL.
