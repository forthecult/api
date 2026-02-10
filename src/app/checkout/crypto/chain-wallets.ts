/**
 * Maps payment token (URL param) to chain id for wallet filtering.
 * Only wallets that support the current chain are shown in Connect wallet modal.
 */
export type PaymentChain = "solana" | "ton" | "sui" | "evm";

const SOLANA_TOKENS = ["solana", "usdc", "whitewhale", "crust", "pump", "troll", "cult"] as const;

export function tokenToChain(token: string): PaymentChain | null {
  if (SOLANA_TOKENS.includes(token as (typeof SOLANA_TOKENS)[number]))
    return "solana";
  if (token === "ton") return "ton";
  if (token === "sui") return "sui";
  if (token === "evm" || token === "usdt") return "evm";
  return null;
}

/**
 * Wallet adapter names to show per chain.
 * Solana: Wallet Adapter names. EVM: WAGMI (injected + WalletConnect).
 */
export const CHAIN_WALLET_NAMES: Record<PaymentChain, string[]> = {
  solana: [
    "Phantom",
    "Solflare",
    "Backpack",
    "Coinbase Wallet",
    "Ctrl Wallet",
    "Trust",
    "Ronin",
    "Ronin Wallet",
    "Brave",
    "Brave Wallet",
    "Rabby",
    "WalletConnect",
  ],
  ton: [],
  sui: [],
  evm: [
    "MetaMask",
    "WalletConnect",
    "Brave",
    "Rabby",
    "Trust",
    "Coinbase Wallet",
  ],
};

/** wallets that support EVM + Solana but not Sui (hide Sui network option). */
export const EVM_SOLANA_ONLY_WALLETS = [
  "Solflare",
  "Backpack",
  "Ronin",
  "Ronin Wallet",
];
