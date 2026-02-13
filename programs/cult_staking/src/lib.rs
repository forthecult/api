//! CULT token staking program.
//!
//! Users stake CULT into a pool vault. Staked balance counts for voting power.
//! Membership staking supports two lock durations:
//!   - 30 days  (2_592_000 seconds)
//!   - 12 months (31_536_000 seconds / 365 days)
//!
//! While locked, tokens cannot be unstaked. The lock period resets if the user
//! stakes additional tokens (top-up extends the lock from the current time).

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, TransferChecked},
};

// Replace with your deployed program ID after `anchor build` / `anchor deploy`
declare_id!("11111111111111111111111111111111");

/// 30 days in seconds.
pub const LOCK_30_DAYS: u64 = 30 * 24 * 60 * 60; // 2_592_000
/// 365 days in seconds (12 months).
pub const LOCK_12_MONTHS: u64 = 365 * 24 * 60 * 60; // 31_536_000

/// Allowed lock durations. Must be one of the predefined constants.
fn is_valid_lock_duration(duration: u64) -> bool {
    duration == LOCK_30_DAYS || duration == LOCK_12_MONTHS
}

#[program]
pub mod cult_staking {
    use super::*;

    /// Initialize the staking pool for a given CULT mint.
    /// Caller pays for pool account and vault ATA. Pool PDA owns the vault.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.mint = ctx.accounts.mint.key();
        pool.vault = ctx.accounts.vault.key();
        pool.bump = ctx.bumps.pool;
        pool.total_stakers = 0;
        pool.total_staked = 0;
        Ok(())
    }

    /// Stake CULT with a lock period.
    ///
    /// `amount`        — number of tokens (with decimals) to stake.
    /// `lock_duration` — lock period in seconds. Must be either `LOCK_30_DAYS`
    ///                    or `LOCK_12_MONTHS`.
    ///
    /// If the user already has a stake:
    ///   - The new tokens are added to their existing amount.
    ///   - The lock resets from the current timestamp with the new (or existing,
    ///     whichever is longer) lock duration.
    ///
    /// If this is a new stake, the account is initialized and the lock starts now.
    pub fn stake(ctx: Context<Stake>, amount: u64, lock_duration: u64) -> Result<()> {
        require!(amount > 0, StakingError::ZeroAmount);
        require!(
            is_valid_lock_duration(lock_duration),
            StakingError::InvalidLockDuration
        );

        let decimals = ctx.accounts.mint.decimals;

        // Transfer tokens from user → vault
        let cpi_accounts = TransferChecked {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.owner.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        anchor_spl::token_interface::transfer_checked(cpi_ctx, amount, decimals)?;

        let stake_account = &mut ctx.accounts.user_stake;
        let clock = Clock::get()?;
        let now = clock.unix_timestamp;

        // Track whether this is a new staker for the pool counter
        let is_new = stake_account.amount == 0 && stake_account.staked_at == 0;

        // On top-up: use the longer of old vs new lock duration, reset from now
        let effective_duration = if stake_account.lock_duration > lock_duration {
            stake_account.lock_duration
        } else {
            lock_duration
        };

        stake_account.owner = ctx.accounts.owner.key();
        stake_account.amount = stake_account
            .amount
            .checked_add(amount)
            .ok_or(StakingError::Overflow)?;
        stake_account.staked_at = now;
        stake_account.lock_duration = effective_duration;
        stake_account.locked_until = now
            .checked_add(effective_duration as i64)
            .ok_or(StakingError::Overflow)?;

        // Update pool totals
        let pool = &mut ctx.accounts.pool;
        pool.total_staked = pool
            .total_staked
            .checked_add(amount)
            .ok_or(StakingError::Overflow)?;
        if is_new {
            pool.total_stakers = pool
                .total_stakers
                .checked_add(1)
                .ok_or(StakingError::Overflow)?;
        }

        Ok(())
    }

    /// Unstake CULT: transfer from pool vault back to user.
    ///
    /// Fails if the lock period has not elapsed. Once unlocked, the user can
    /// withdraw any amount up to their staked balance.
    pub fn unstake(ctx: Context<Unstake>, amount: u64) -> Result<()> {
        require!(amount > 0, StakingError::ZeroAmount);

        let stake_account = &mut ctx.accounts.user_stake;
        require!(
            stake_account.amount >= amount,
            StakingError::InsufficientStake
        );

        // Enforce lock period
        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp >= stake_account.locked_until,
            StakingError::StillLocked
        );

        let pool = &ctx.accounts.pool;
        let decimals = ctx.accounts.mint.decimals;
        let pool_seeds: &[&[&[u8]]] = &[&[b"pool", &[pool.bump]]];

        // Transfer tokens from vault → user
        let cpi_accounts = TransferChecked {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.pool.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, pool_seeds);
        token::transfer_checked(cpi_ctx, amount, decimals)?;

        stake_account.amount = stake_account
            .amount
            .checked_sub(amount)
            .ok_or(StakingError::Overflow)?;

        // Update pool totals
        let pool = &mut ctx.accounts.pool;
        pool.total_staked = pool
            .total_staked
            .checked_sub(amount)
            .ok_or(StakingError::Overflow)?;
        if stake_account.amount == 0 {
            pool.total_stakers = pool.total_stakers.saturating_sub(1);
            // Reset stake metadata so re-staking is treated as new
            stake_account.staked_at = 0;
            stake_account.lock_duration = 0;
            stake_account.locked_until = 0;
        }

        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Account contexts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Pool PDA — holds config and owns the vault
    #[account(
        init,
        payer = payer,
        space = StakePool::SPACE,
        seeds = [b"pool"],
        bump
    )]
    pub pool: Account<'info, StakePool>,

    /// CULT token mint
    pub mint: Account<'info, Mint>,

    /// Vault: ATA(mint, pool). Pool PDA is the owner so program can sign for unstake.
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = pool,
        associated_token::token_program = token_program,
    )]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"pool"],
        bump = pool.bump,
        has_one = mint,
        has_one = vault,
    )]
    pub pool: Account<'info, StakePool>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        constraint = vault.key() == pool.vault,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_token_account.owner == owner.key(),
        constraint = user_token_account.mint == mint.key(),
    )]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = owner,
        space = UserStake::SPACE,
        seeds = [b"stake", pool.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub user_stake: Account<'info, UserStake>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"pool"],
        bump = pool.bump,
        has_one = mint,
        has_one = vault,
    )]
    pub pool: Account<'info, StakePool>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = vault.key() == pool.vault,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_token_account.owner == owner.key(),
        constraint = user_token_account.mint == mint.key(),
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"stake", pool.key().as_ref(), owner.key().as_ref()],
        bump,
        constraint = user_stake.owner == owner.key(),
    )]
    pub user_stake: Account<'info, UserStake>,

    pub token_program: Program<'info, Token>,
}

// ---------------------------------------------------------------------------
// State accounts
// ---------------------------------------------------------------------------

#[account]
pub struct StakePool {
    /// CULT token mint address.
    pub mint: Pubkey, // 32
    /// Vault token account (ATA owned by pool PDA).
    pub vault: Pubkey, // 32
    /// PDA bump seed.
    pub bump: u8, // 1
    /// Total number of unique stakers with amount > 0.
    pub total_stakers: u64, // 8
    /// Total tokens staked across all users.
    pub total_staked: u64, // 8
}

impl StakePool {
    /// 8 (discriminator) + 32 + 32 + 1 + 8 + 8 = 89
    pub const SPACE: usize = 8 + 32 + 32 + 1 + 8 + 8;
}

#[account]
pub struct UserStake {
    /// Wallet that owns this stake.
    pub owner: Pubkey, // 32
    /// Total staked amount (with token decimals).
    pub amount: u64, // 8
    /// Unix timestamp when the stake (or last top-up) was made.
    pub staked_at: i64, // 8
    /// Lock duration in seconds (LOCK_30_DAYS or LOCK_12_MONTHS).
    pub lock_duration: u64, // 8
    /// Unix timestamp when the lock expires and unstaking becomes available.
    pub locked_until: i64, // 8
}

impl UserStake {
    /// 8 (discriminator) + 32 + 8 + 8 + 8 + 8 = 72
    pub const SPACE: usize = 8 + 32 + 8 + 8 + 8 + 8;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[error_code]
pub enum StakingError {
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Insufficient staked balance")]
    InsufficientStake,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Lock duration must be 30 days (2592000s) or 12 months (31536000s)")]
    InvalidLockDuration,
    #[msg("Tokens are still locked — unstaking is not available until the lock period expires")]
    StillLocked,
}
