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
  PaymentReceiverFactoryABI,
  PaymentReceiverABI,
  ERC20ABI,
} from "./abis";

// Payment utilities
export {
  // Factory and implementation addresses
  FACTORY_ADDRESSES,
  IMPLEMENTATION_ADDRESSES,
  // Token addresses
  USDC_ADDRESSES,
  USDT_ADDRESSES,
  TOKEN_DECIMALS,
  // Chain configuration
  CHAIN_NAMES,
  CHAIN_IDS,
  getRpcUrl,
  // Address computation
  computePaymentReceiverAddress,
  orderIdToBytes32,
  getPaymentReceiverAddress,
  // Amount calculations
  usdCentsToTokenAmount,
  formatTokenAmount,
  // Token helpers
  getTokenAddress,
  isTokenSupportedOnChain,
  isFactoryDeployed,
} from "./evm-payment";
