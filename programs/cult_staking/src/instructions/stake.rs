//! Stake CULT with a lock period.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::TransferChecked;

use crate::constants::is_valid_lock_duration;
use crate::error::StakingError;
use crate::events::StakeEvent;
use crate::Stake;

/// Stake CULT with a lock period (30 days or 12 months).
/// On top-up, lock resets from now with the longer of old/new duration.
pub fn handler(ctx: Context<Stake>, amount: u64, lock_duration: u64) -> Result<()> {
    require!(!ctx.accounts.pool.paused, StakingError::Paused);
    require!(amount > 0, StakingError::ZeroAmount);
    require!(
        is_valid_lock_duration(lock_duration),
        StakingError::InvalidLockDuration
    );

    let decimals = ctx.accounts.mint.decimals;

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

    let is_new = stake_account.amount == 0 && stake_account.staked_at == 0;

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

    emit!(StakeEvent {
        owner: ctx.accounts.owner.key(),
        amount,
        total_staked_user: stake_account.amount,
        lock_duration: effective_duration,
        locked_until: stake_account.locked_until,
    });

    Ok(())
}
