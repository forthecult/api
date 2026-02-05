# EVM Payment Receiver Contracts

This directory contains the smart contracts for secure, tamper-proof EVM payments.

## Architecture

### Overview

The payment system uses a **Factory + Minimal Proxy (EIP-1167)** pattern:

1. **PaymentReceiverFactory** - Deployed once per chain, creates deterministic payment receivers
2. **PaymentReceiver** - Implementation contract; clones receive payments and forward to treasury

### Security Features

- **Deterministic Addresses**: Using CREATE2, payment addresses are computed off-chain before deployment
- **Immutable Contracts**: Once deployed, receiver code cannot be modified
- **Treasury-Only Withdrawals**: Only the configured treasury address can receive swept funds
- **No Private Keys**: No seed phrases or private keys needed for payment addresses
- **Tamper-Proof**: Contract code enforces all payment rules on-chain

### How It Works

```
1. Customer places order
   └─> Server computes deterministic address using CREATE2
   
2. Customer sees payment address
   └─> Address is valid even before contract deployment
   
3. Customer sends payment (ETH or ERC20)
   └─> Funds arrive at the deterministic address
   
4. Server detects payment
   └─> Verifies transaction on-chain
   └─> Marks order as paid
   
5. Store owner sweeps funds (batch or individual)
   └─> Calls sweepETH() or sweepToken() on receivers
   └─> Funds go to treasury
```

## Deployment

### Prerequisites

```bash
cd contracts
bun install
```

### Environment Variables

Create a `.env` file in the project root:

```env
# Deployer private key (use a dedicated deployment wallet)
DEPLOYER_PRIVATE_KEY=0x...

# Treasury address (receives all payments)
PAYMENT_TREASURY_ADDRESS=0x...

# RPC URLs (optional, defaults to public RPCs)
ETHEREUM_RPC_URL=https://rpc.ankr.com/eth
ARBITRUM_RPC_URL=https://rpc.ankr.com/arbitrum_one
BASE_RPC_URL=https://rpc.ankr.com/base
POLYGON_RPC_URL=https://rpc.ankr.com/polygon

# Block explorer API keys (for verification)
ETHERSCAN_API_KEY=...
ARBISCAN_API_KEY=...
BASESCAN_API_KEY=...
POLYGONSCAN_API_KEY=...
```

### Deploy to Networks

```bash
# Compile contracts
bun run compile

# Deploy to testnets first
bun run deploy:sepolia
bun run deploy:base-sepolia

# Deploy to mainnets
bun run deploy:ethereum
bun run deploy:arbitrum
bun run deploy:base
bun run deploy:polygon
bun run deploy:bnb
bun run deploy:optimism
```

### Export ABIs

After deployment, export ABIs and deployment addresses to the main app:

```bash
bun run export-abi
```

This updates:
- `src/lib/contracts/abis.ts` - Contract ABIs
- `src/lib/contracts/deployments.ts` - Deployed addresses per chain

### Update Factory Addresses

After deploying, update the factory addresses in `src/lib/contracts/evm-payment.ts`:

```typescript
export const FACTORY_ADDRESSES: Record<number, `0x${string}`> = {
  1: "0x...",      // Ethereum Mainnet - UPDATE THIS
  42161: "0x...",  // Arbitrum One - UPDATE THIS
  8453: "0x...",   // Base - UPDATE THIS
  // ... etc
};
```

## Contract Details

### PaymentReceiverFactory

```solidity
// Compute address before deployment
function computeAddress(bytes32 orderId) view returns (address)

// Deploy a receiver for an order
function deployReceiver(bytes32 orderId) returns (address)

// Get or deploy (idempotent)
function getOrDeployReceiver(bytes32 orderId) returns (address)

// Batch sweep ETH from multiple receivers
function batchSweepETH(bytes32[] orderIds)

// Batch sweep tokens from multiple receivers
function batchSweepToken(bytes32[] orderIds, address token)
```

### PaymentReceiver

```solidity
// Initialize (called by factory)
function initialize(address treasury, bytes32 orderId)

// Receive ETH (automatic via receive/fallback)
receive() external payable

// Sweep ETH to treasury (anyone can call)
function sweepETH()

// Sweep ERC20 to treasury (anyone can call)
function sweepToken(address token)

// Sweep multiple tokens at once
function sweepTokens(address[] tokens)

// View balances
function getETHBalance() view returns (uint256)
function getTokenBalance(address token) view returns (uint256)
```

## Gas Costs

Estimated gas costs (varies by network):

| Operation | Gas | Est. Cost (ETH @ $3500) |
|-----------|-----|------------------------|
| Deploy Receiver (first payment) | ~150,000 | ~$1.50 |
| ETH Transfer | ~21,000 | ~$0.20 |
| ERC20 Transfer | ~65,000 | ~$0.65 |
| Sweep ETH | ~30,000 | ~$0.30 |
| Sweep Token | ~50,000 | ~$0.50 |

Note: L2s (Arbitrum, Base, Polygon) are 10-100x cheaper.

## Testing

```bash
# Run local node
bun run node

# In another terminal, run tests
bun run test

# Deploy to local node
bun run deploy:local
```

## Security Considerations

1. **Treasury Address**: Use a multisig (like Gnosis Safe) for the treasury
2. **Deployer Key**: Use a dedicated wallet for deployment, not your main wallet
3. **Verification**: Always verify contracts on block explorers after deployment
4. **Monitoring**: Set up alerts for large payments and sweeps

## Auditing

Before deploying to mainnet with real funds:

1. Review the contracts thoroughly
2. Consider a professional audit for high-value deployments
3. Start with small amounts to test the flow
4. Use testnets extensively first

## Support

For issues or questions about the payment contracts:
- Check the main project's GitHub issues
- Review the contract source code and comments
