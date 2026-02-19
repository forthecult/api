# Multi-Chain Crypto Payments

How to handle payments across different blockchain networks with the For the Cult API.

---

## Supported Networks

| Network | Tokens | Type |
|---------|--------|------|
| **Solana** | SOL, USDC, USDT, CULT | Native + SPL |
| **Ethereum** | ETH, USDC, USDT | Native + ERC-20 |
| **Base** | ETH, USDC | Native + ERC-20 |
| **Arbitrum** | ETH, USDC | Native + ERC-20 |
| **BNB Chain** | BNB, USDC | Native + BEP-20 |
| **Polygon** | MATIC, USDC | Native + ERC-20 |
| **Bitcoin** | BTC | Native |
| **Dogecoin** | DOGE | Native |
| **Monero** | XMR | Native |

---

## Step 1: Discover Available Chains and Tokens

```bash
curl https://forthecult.store/api/chains
```

**Response:**
```json
{
  "chains": [
    {
      "id": "solana",
      "name": "Solana",
      "tokens": [
        {
          "symbol": "SOL",
          "name": "Solana",
          "type": "native",
          "decimals": 9
        },
        {
          "symbol": "USDC",
          "name": "USD Coin",
          "type": "spl",
          "decimals": 6,
          "mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
        },
        {
          "symbol": "USDT",
          "name": "Tether",
          "type": "spl",
          "decimals": 6,
          "mint": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
        },
        {
          "symbol": "CULT",
          "name": "For the Cult Token",
          "type": "spl",
          "decimals": 9
        }
      ]
    },
    {
      "id": "ethereum",
      "name": "Ethereum",
      "tokens": [
        {
          "symbol": "ETH",
          "name": "Ethereum",
          "type": "native",
          "decimals": 18
        },
        {
          "symbol": "USDC",
          "name": "USD Coin",
          "type": "erc20",
          "decimals": 6,
          "mint": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
        }
      ]
    },
    {
      "id": "base",
      "name": "Base",
      "tokens": [
        {
          "symbol": "ETH",
          "name": "Ethereum",
          "type": "native",
          "decimals": 18
        },
        {
          "symbol": "USDC",
          "name": "USD Coin",
          "type": "erc20",
          "decimals": 6,
          "mint": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
        }
      ]
    }
  ]
}
```

---

## Step 2: Create Order with Specific Chain/Token

Use **productId** from GET /api/products/search or GET /api/products/{slug}. Request body uses **payment** and **shipping** (with address1, stateCode, zip, countryCode).

### Solana USDC Payment

```bash
curl -X POST https://forthecult.store/api/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{ "productId": "<id from API>", "quantity": 1 }],
    "email": "customer@example.com",
    "payment": { "chain": "solana", "token": "USDC" },
    "shipping": {
      "name": "John Doe",
      "address1": "123 Main St",
      "city": "New York",
      "stateCode": "NY",
      "zip": "10001",
      "countryCode": "US"
    }
  }'
```

**Response:**
```json
{
  "orderId": "order_sol_abc123",
  "payment": {
    "chain": "solana",
    "token": "USDC",
    "address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "amount": "84.99",
    "reference": "FortheCult_order_sol_abc123",
    "qrCode": "data:image/png;base64,iVBOR..."
  },
  "expiresAt": "2026-02-10T12:15:00Z",
  "statusUrl": "/api/orders/order_sol_abc123/status"
}
```

### Ethereum USDC Payment

```bash
curl -X POST https://forthecult.store/api/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{ "productId": "<id from API>", "quantity": 1 }],
    "email": "customer@example.com",
    "payment": { "chain": "ethereum", "token": "USDC" },
    "shipping": {
      "name": "John Doe",
      "address1": "123 Main St",
      "city": "New York",
      "stateCode": "NY",
      "zip": "10001",
      "countryCode": "US"
    }
  }'
```

**Response:**
```json
{
  "orderId": "order_eth_xyz789",
  "payment": {
    "chain": "ethereum",
    "token": "USDC",
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8",
    "amount": "84.99",
    "reference": "FortheCult_order_eth_xyz789"
  },
  "expiresAt": "2026-02-10T12:15:00Z",
  "statusUrl": "/api/orders/order_eth_xyz789/status"
}
```

### Bitcoin Payment

```bash
curl -X POST https://forthecult.store/api/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{ "productId": "<id from API>", "quantity": 1 }],
    "email": "customer@example.com",
    "payment": { "chain": "bitcoin", "token": "BTC" },
    "shipping": {
      "name": "Hal Finney",
      "address1": "123 Main St",
      "city": "New York",
      "stateCode": "NY",
      "zip": "10001",
      "countryCode": "US"
    }
  }'
```

**Response:**
```json
{
  "orderId": "order_btc_def456",
  "payment": {
    "chain": "bitcoin",
    "token": "BTC",
    "address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    "amount": "0.0012",
    "reference": "FortheCult_order_btc_def456"
  },
  "expiresAt": "2026-02-10T12:15:00Z",
  "statusUrl": "/api/orders/order_btc_def456/status"
}
```

---

## Step 3: Multi-Chain Payment Manager

```javascript
const API_BASE = 'https://forthecult.store/api';

class MultiChainPaymentManager {
  constructor() {
    this.supportedChains = null;
  }

  async initialize() {
    const response = await fetch(`${API_BASE}/chains`);
    const data = await response.json();
    this.supportedChains = data.chains;
  }

  getAvailablePaymentMethods() {
    const methods = [];

    for (const chain of this.supportedChains) {
      for (const token of chain.tokens) {
        methods.push({
          displayName: `${token.name} on ${chain.name}`,
          chainId: chain.id,
          tokenSymbol: token.symbol,
          tokenName: token.name,
          recommended: this.isRecommended(chain.id, token.symbol)
        });
      }
    }

    // Sort recommended first
    return methods.sort((a, b) => b.recommended - a.recommended);
  }

  isRecommended(chainId, tokenSymbol) {
    // Stablecoins: predictable pricing
    if (tokenSymbol === 'USDC' || tokenSymbol === 'USDT') return true;
    // Solana: fast and cheap fees
    if (chainId === 'solana') return true;
    return false;
  }

  async createOrder(orderData, chain, token) {
    const response = await fetch(`${API_BASE}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...orderData,
        chain,
        token
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Order creation failed');
    }

    return response.json();
  }

  async waitForPayment(orderId) {
    return new Promise((resolve) => {
      const interval = setInterval(async () => {
        const response = await fetch(
          `${API_BASE}/orders/${orderId}/status`
        );
        const status = await response.json();

        if (status.status === 'paid') {
          clearInterval(interval);
          resolve({ success: true, status });
        } else if (['expired', 'cancelled'].includes(status.status)) {
          clearInterval(interval);
          resolve({ success: false, status });
        }
      }, 5000);
    });
  }
}

// Usage
const pm = new MultiChainPaymentManager();
await pm.initialize();

// Show available payment methods
const methods = pm.getAvailablePaymentMethods();
console.log('Payment methods:', methods);

// Create order — use productId from search or product detail
const order = await pm.createOrder(
  {
    items: [{ productId: productIdFromApi, quantity: 1 }],
    email: 'user@example.com',
    payment: { chain: 'solana', token: 'USDC' },
    shipping: {
      name: 'John Doe',
      address1: '123 Main St',
      city: 'New York',
      stateCode: 'NY',
      zip: '10001',
      countryCode: 'US'
    }
  }
);

console.log(`Send ${order.payment.amount} ${order.payment.token}`);
console.log(`To: ${order.payment.address}`);

// Wait for payment
const result = await pm.waitForPayment(order.orderId);
if (result.success) {
  console.log('Payment confirmed!');
}
```

---

## Step 4: Solana Pay Integration

```javascript
import { createQR } from '@solana/pay';

async function handleSolanaPayment(order) {
  const { payment } = order;

  // The API provides a QR code as base64
  if (payment.qrCode) {
    // Display the QR code directly
    const img = document.createElement('img');
    img.src = payment.qrCode;
    document.getElementById('qr-container').appendChild(img);
  }

  // Or build your own Solana Pay URL
  // (The API returns the address and amount needed)
  console.log(`Send ${payment.amount} ${payment.token} to ${payment.address}`);

  // Poll for confirmation
  const checkPayment = setInterval(async () => {
    const status = await fetch(
      `https://forthecult.store/api/orders/${order.orderId}/status`
    ).then(r => r.json());

    if (status.status === 'paid') {
      clearInterval(checkPayment);
      console.log('Payment confirmed!');
    }
  }, 3000);
}
```

---

## Step 5: EVM (Ethereum/Base) Integration

```javascript
import { ethers } from 'ethers';

async function handleEVMPayment(order) {
  const { payment } = order;

  // Connect wallet
  const provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send('eth_requestAccounts', []);
  const signer = await provider.getSigner();

  if (payment.token === 'ETH') {
    // Native ETH transfer
    const tx = await signer.sendTransaction({
      to: payment.address,
      value: ethers.parseEther(payment.amount)
    });
    console.log('Transaction sent:', tx.hash);
    await tx.wait();
    console.log('Transaction confirmed');

  } else {
    // ERC-20 token transfer (USDC, etc.)
    // Get token contract address from /chains response
    const chains = await fetch('https://forthecult.store/api/chains').then(r => r.json());
    const chain = chains.chains.find(c => c.id === payment.chain);
    const token = chain.tokens.find(t => t.symbol === payment.token);

    const erc20 = new ethers.Contract(
      token.mint, // contract address
      ['function transfer(address to, uint256 amount) returns (bool)'],
      signer
    );

    const amount = ethers.parseUnits(payment.amount, token.decimals);
    const tx = await erc20.transfer(payment.address, amount);
    console.log('Transaction sent:', tx.hash);
    await tx.wait();
    console.log('Transaction confirmed');
  }

  // The API will detect the payment automatically
  // Poll /orders/{orderId}/status to confirm
}
```

---

## Best Practices

### 1. Always Verify Chain Support First

```javascript
const chains = await fetch('https://forthecult.store/api/chains').then(r => r.json());

const isSupported = chains.chains.some(
  c => c.id === selectedChain &&
       c.tokens.some(t => t.symbol === selectedToken)
);

if (!isSupported) {
  console.error('Payment method not supported');
}
```

### 2. Handle Chain-Specific Decimals

```javascript
// Different tokens have different decimal places
// The /chains response includes this info
const token = chain.tokens.find(t => t.symbol === 'USDC');
const decimals = token.decimals; // 6 for USDC, 9 for SOL, 18 for ETH
```

### 3. Recommend Stablecoins for Predictable Pricing

```javascript
// Stablecoins (USDC, USDT) provide predictable pricing
// Native tokens (SOL, ETH) are subject to price volatility
const recommendedTokens = ['USDC', 'USDT'];
```

### 4. Poll for Payment Confirmation

```javascript
// Always poll the API to confirm payment -- don't assume
const interval = setInterval(async () => {
  const status = await fetch(
    `https://forthecult.store/api/orders/${orderId}/status`
  ).then(r => r.json());

  if (status.status === 'paid') {
    clearInterval(interval);
    // Payment confirmed by the backend
  }
}, 5000);
```

---

## Next Steps

- Review [Order Tracking](./order-tracking.md) for monitoring shipment status
- Check [AI Agent Guide](../guides/ai-agents.md) for building intelligent payment flows
- See the [OpenAPI spec](../openapi.yaml) for complete payment API reference
