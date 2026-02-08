//! CULT token staking program.
//! Users stake CULT into a pool; staked balance counts for voting power. No lock period.

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, TransferChecked},
};

// Replace with your deployed program ID after `anchor build` / `anchor deploy`
declare_id!("11111111111111111111111111111111");

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
        Ok(())
    }

    /// Stake CULT: transfer from user's token account to pool vault.
    /// Creates or updates the user's stake account (amount is incremented).
    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        require!(amount > 0, StakingError::ZeroAmount);

        let pool = &ctx.accounts.pool;
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
        stake_account.amount = stake_account.amount.checked_add(amount).ok_or(StakingError::Overflow)?;
        stake_account.owner = ctx.accounts.owner.key();

        Ok(())
    }

    /// Unstake CULT: transfer from pool vault to user's token account.
    /// Pool PDA signs for the vault. Decrements user's stake amount.
    pub fn unstake(ctx: Context<Unstake>, amount: u64) -> Result<()> {
        require!(amount > 0, StakingError::ZeroAmount);

        let pool = &ctx.accounts.pool;
        let stake_account = &mut ctx.accounts.user_stake;
        require!(stake_account.amount >= amount, StakingError::InsufficientStake);

        let decimals = ctx.accounts.mint.decimals;
        let pool_seeds: &[&[&[u8]]] = &[&[b"pool", &[pool.bump]]];

        let cpi_accounts = TransferChecked {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.pool.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, pool_seeds);
        token::transfer_checked(cpi_ctx, amount, decimals)?;

        stake_account.amount = stake_account.amount.checked_sub(amount).ok_or(StakingError::Overflow)?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Pool PDA - holds config and owns the vault
    #[account(
        init,
        payer = payer,
        space = 8 + 32 + 32 + 1,
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
        space = 8 + 32 + 8,
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

#[account]
pub struct StakePool {
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub bump: u8,
}

#[account]
pub struct UserStake {
    pub owner: Pubkey,
    pub amount: u64,
}

#[error_code]
pub enum StakingError {
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Insufficient staked balance")]
    InsufficientStake,
    #[msg("Arithmetic overflow")]
    Overflow,
}
