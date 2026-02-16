/**
 * Event names for auth/wallet modal. Kept in a separate file so header and
 * other light components can import only these without pulling in the heavy
 * modal + wallet adapter bundle.
 */
export const OPEN_AUTH_WALLET_MODAL = "open-auth-wallet-modal";
/** Open modal with only Solana wallets (e.g. staking). */
export const OPEN_SOLANA_WALLET_MODAL = "open-solana-wallet-modal";
/** Open modal in link mode (connect wallet to current account). */
export const OPEN_LINK_WALLET_MODAL = "open-link-wallet-modal";
/** Dispatched when a wallet is successfully linked. */
export const WALLET_LINKED_EVENT = "wallet-linked";
/** Start preloading the wallet modal chunk (e.g. on hover over trigger). */
export const PRELOAD_AUTH_WALLET_MODAL = "preload-auth-wallet-modal";
