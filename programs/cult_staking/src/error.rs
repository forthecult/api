//! Custom error definitions.

use anchor_lang::prelude::*;

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
    #[msg("Staking is currently paused by the pool authority")]
    Paused,
    #[msg("Cannot close a stake account that still has tokens staked")]
    StakeNotEmpty,
}
