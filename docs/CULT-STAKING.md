<!-- INTERNAL — DO NOT PUBLISH. Contains sensitive configuration details. -->
<!-- If this repository is public, move this file outside the repo or add it to .gitignore. -->
# CULT On-Chain Staking Program

Program-based staking for the CULT token on Solana. Users stake CULT into a pool; staked balance counts toward **voting power** on the Stake & Vote page.

## Overview

- **Program**: `programs/cult_staking` (Anchor 0.32). Layout follows [Anchor’s recommended structure](https://www.anchor-lang.com/docs/program-structure): `src/lib.rs` (entry point + account contexts), `src/constants.rs`, `src/error.rs`, `src/state/` (account state), `src/instructions/` (handlers).
- **Token**: CULT is a **Token-2022** mint. The program uses the SPL Token interface (`token_interface`), so it works with both legacy Token and Token-2022. When initializing the pool and when building stake/unstake transactions, pass the **Token-2022** program ID (`TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`) and the corresponding mint/vault/ATA accounts. The app’s token config (`token-config.ts`) sets `tokenProgram` for CULT to Token-2022 so prepare routes and any scripts use the correct program.
- **Instructions**: `initialize` (one-time pool setup), `stake`, `unstake`
- **Lock periods**: 30 days or 12 months (tokens locked until expiry; top-up extends lock).
- **Voting power**: App uses wallet CULT balance + staked balance from the program.

**Rollout:** We’re testing staking with **SOLUNA** (live token) now. When the **CULT** token launches, switch the active token to CULT in `token-config.ts`, set `CULT_TOKEN_MINT_SOLANA`, then deploy (or use a new program) and run the initialize script for the CULT mint. Same code path supports both; CULT will use Token-2022.

## Build & Deploy

### Prerequisites

- [Rust](https://rustup.rs/) — **Solana 2.3’s `cargo-build-sbf` uses its own Rust 1.84**, which does not support edition 2024. The workspace therefore **patches** two crates that require it: **`constant_time_eq`** and **`blake3`** are vendored under `programs/vendor/` and wired via `[patch.crates-io]` in `programs/Cargo.toml`. With that, **`anchor build`** and **`cargo build-sbf`** work from **`programs`** without needing Rust 1.85 for the SBF step. Optional: `rust-toolchain.toml` in `programs/` and `cult_staking/` pins 1.85.0 for host builds (e.g. `cargo build`); keep the `vendor/` directory in the repo so the patch applies for everyone.
- [Anchor](https://www.anchor-lang.com/docs/installation) 0.32.1 (matches `anchor-cli 0.32.1`):
  ```bash
  avm install 0.32.1 && avm use 0.32.1
  ```
  If installation fails with **"binary anchor already exists in destination"**, overwrite and retry:
  ```bash
  cargo install --git https://github.com/coral-xyz/anchor --tag v0.32.1 anchor-cli --force
  ```
  Then run `avm use 0.32.1` or use `anchor` directly.
- **Solana CLI 2.3.x** (required for `anchor build`). Anchor 0.32 is not compatible with Solana 3.x — the SBF toolchain and paths differ, so `anchor build` will fail or produce no `target/deploy` on 3.0.15. Use 2.3.0:
  ```bash
  sh -c "$(curl -sSfL https://release.anza.xyz/v2.3.0/install)"
  ```
  Then ensure the 2.3 install is active: `~/.local/share/solana/install/active_release` should point to the 2.3 install. Check with `solana --version` (should show 2.3.x). If you have 3.x and need to keep it for other work, use a separate terminal/env or switch with `solana-install init 2.3.0` (or the installer’s version-switch option) when building Anchor programs.

### Build

**Where to build:** Run **`anchor build`** from **`programs`** (the directory that contains `Anchor.toml` and the workspace `Cargo.toml`). Do **not** run it from `programs/cult_staking` — Anchor must be run from the workspace root. From the repo root:

```bash
cd programs
anchor build
```

A successful build creates **`programs/target/deploy/`** with:

- `cult_staking.so` — the program binary
- `cult_staking-keypair.json` — the program keypair (used for deploy and for `declare_id!`)

After the first successful build, run `anchor keys list` (from `programs`) to see the program ID. You can deploy with that keypair or put its public key in `cult_staking/src/lib.rs` (`declare_id!(...)`) and rebuild.

#### No `target/deploy` or `anchor keys list` does nothing

If `anchor build` finishes with no output and **`target/deploy` is missing**, the Solana SBF build did not run or failed. Anchor does not create `target/deploy` until the program compiles successfully.

1. **See the real error** — from `programs` run:
   ```bash
   cargo build-sbf --manifest-path cult_staking/Cargo.toml
   ```
   Any failure (e.g. missing platform-tools) will appear here. With the vendored `constant_time_eq` and `blake3` patches, the edition2024 error should be resolved.

2. **Platform-tools "not a directory" or "Failed to install platform-tools"** — the Solana SBF toolchain cache is incomplete or corrupted. From `programs`:
   ```bash
   rm -rf ~/.cache/solana
   cargo build-sbf --manifest-path cult_staking/Cargo.toml --install-only
   ```
   Then run `anchor build` again. If install still fails, reinstall the [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools) (e.g. `sh -c "$(curl -sSfL https://release.anza.xyz/v2.3.0/install)"`).

3. **`anchor keys list`** only shows keys for programs that have been built at least once (keypairs live in `target/deploy/`). If `target/deploy` is empty, there are no keys to list.

4. **"feature \`edition2024\` is required"** or **"that feature is not stabilized in this version of Cargo (1.84.0)"** — The workspace **patches** this by vendoring `constant_time_eq` and `blake3` under `programs/vendor/` (see `programs/Cargo.toml` `[patch.crates-io]`). Ensure the `vendor/` directory is present (do not delete it). Then from **`programs`** run `cargo build-sbf --manifest-path cult_staking/Cargo.toml` or `anchor build`. If you still see the error, run `cargo update -p blake3 -p constant_time_eq` from `programs` and try again.

5. **Solana CLI 3.x (e.g. 3.0.15): `anchor build` doesn’t work** — Anchor 0.32 expects the Solana 2.3.x toolchain. On 3.x, `anchor build` may exit with no output, fail with platform-tools errors, or never create `target/deploy`. Fix: install and use **Solana 2.3.0** for building:
   ```bash
   sh -c "$(curl -sSfL https://release.anza.xyz/v2.3.0/install)"
   ```
   Restart the terminal (or `source` your shell profile) so `solana` and `cargo build-sbf` point to the 2.3 install. Then from `programs` run `anchor build` again. To confirm: `solana --version` should show 2.3.x before building.

### Deploy (e.g. devnet)

From the repo root:

```bash
cd programs
solana config set --url https://api.mainnet-beta.solana.com
anchor deploy --provider.cluster mainnet
```

If the deploy output doesn’t show the **Program ID**, get it from the keypair (from `programs/`):

```bash
cd programs
solana-keygen pubkey target/deploy/cult_staking-keypair.json
```

Or run `anchor keys list` (from `programs/`) to see all built program IDs. Put that ID in your app’s `CULT_STAKING_PROGRAM_ID` and in `declare_id!(...)` in `cult_staking/src/lib.rs` if you haven’t already. As of Anchor 0.32, the IDL is uploaded automatically on deploy; use `anchor deploy --no-idl` to skip IDL upload.

### Initialize the pool

After deploy, call `initialize` **once**. The signer becomes the pool authority (can pause staking) and pays for the pool account and vault ATA. Use the script from the webapp:

**1. Set env** (in `.env` or the shell):

- **`CULT_STAKING_PROGRAM_ID`** — your deployed program ID (e.g. from `anchor keys list` or `declare_id!`).
- **`CULT_TOKEN_MINT_SOLANA`** — CULT mint address (Token-2022).
- **`SOLANA_RPC_URL`** (optional) — RPC URL; default is devnet. Use mainnet when you deploy to mainnet.

**2. Authority (payer)** — either:

- **Default:** No extra env. The script uses **`~/.config/solana/id.json`** (same as Anchor’s `wallet`). Ensure that keypair has enough SOL for rent + tx fees.
- **Or** set **`STAKING_INIT_AUTHORITY_KEYPAIR`** to the base58 secret key or JSON array of the wallet that should be the authority.

**3. Run from the webapp directory:**

```bash
cd webapp
bun run scripts/initialize-staking-pool.ts
```

To dry-run (build and log the tx without sending):

```bash
DRY_RUN=true bun run scripts/initialize-staking-pool.ts
```

The script uses Token-2022 for the vault ATA. After it succeeds, the pool is ready for stake/unstake. The app does not call `initialize`; this is a one-time admin step.

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

- **StakePool** (PDA `["pool"]`): `authority`, `mint`, `vault` (ATA of pool PDA for mint), `bump`, `total_stakers`, `total_staked`.
- **UserStake** (PDA `["stake", pool, user]`): `owner`, `amount` (raw u64), `staked_at`, `lock_duration`, `locked_until`.
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
   0 0 * * 0 cd /path/to/webapp && REWARD_SOL_TOTAL=0.5 STAKING_REWARDS_WALLET_SECRET_KEY=... CULT_STAKING_PROGRAM_ID=... bun run scripts/staking-rewards-distribute.ts
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
