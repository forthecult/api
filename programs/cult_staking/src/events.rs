//! Program events for off-chain indexing.

use anchor_lang::prelude::*;

#[event]
pub struct StakeEvent {
    pub owner: Pubkey,
    /// Tokens added in this transaction.
    pub amount: u64,
    /// User's total staked balance after this stake.
    pub total_staked_user: u64,
    /// Effective lock duration applied (seconds).
    pub lock_duration: u64,
    /// Unix timestamp when the lock expires.
    pub locked_until: i64,
}

#[event]
pub struct UnstakeEvent {
    pub owner: Pubkey,
    /// Tokens withdrawn in this transaction.
    pub amount: u64,
    /// User's remaining staked balance after this unstake.
    pub remaining_stake: u64,
}

#[event]
pub struct SetPausedEvent {
    pub authority: Pubkey,
    pub paused: bool,
}
