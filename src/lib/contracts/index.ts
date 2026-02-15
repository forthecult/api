/**
 * EVM Payment Contracts Module
 *
 * This module provides everything needed for EVM-based crypto payments:
 * - Smart contract ABIs for PaymentReceiver and Factory
 * - Deterministic address computation using CREATE2
 * - Token addresses and utilities
 * - Chain configuration
 */

// ABIs
export {
  ERC20ABI,
  PaymentReceiverABI,
  PaymentReceiverFactoryABI,
} from "./abis";

// Payment utilities
export {
  CHAIN_IDS,
  // Chain configuration
  CHAIN_NAMES,
  // Address computation
  computePaymentReceiverAddress,
  // Factory and implementation addresses
  FACTORY_ADDRESSES,
  formatTokenAmount,
  getPaymentReceiverAddress,
  getRpcUrl,
  // Token helpers
  getTokenAddress,
  IMPLEMENTATION_ADDRESSES,
  isFactoryDeployed,
  isTokenSupportedOnChain,
  orderIdToBytes32,
  TOKEN_DECIMALS,
  // Token addresses
  USDC_ADDRESSES,
  // Amount calculations
  usdCentsToTokenAmount,
  USDT_ADDRESSES,
} from "./evm-payment";
